"""Process FEC candidate financial summaries and store for challengers + incumbents.

Reads the candidate_summary CSV downloaded by ingest.py, matches candidate IDs
against the challengers table AND the officials table (via fec_ids), and upserts
financial totals into the challenger_money table.
"""

import os
import urllib.parse

import dataset
import dotenv
import pandas as pd

# Setup — supports both Secrets Manager (ECS) and local dotenv
if os.environ.get("DB_USER"):
    pass
else:
    dotenv.load_dotenv("../env")
    dotenv.load_dotenv(os.environ.get("PATH_TO_SECRETS", ""))

CYCLE = os.environ.get("FEC_CYCLE", "26")
CYCLE_FULL = f"20{CYCLE}"

db_host = os.environ.get("DB_HOST", "localhost")
params = (
    f"{os.environ.get('DB_DIALECT', 'mysql')}://{os.environ['DB_USER']}"
    f":{urllib.parse.quote(os.environ['DB_PASSWORD'])}"
    f"@{db_host}:{os.environ['DB_PORT']}/elite"
)

# Load FEC candidate summary CSV
data_file = f".tmp/candidate_summary_{CYCLE_FULL}.csv"
print(f"Reading {data_file}...")
fec = pd.read_csv(data_file, dtype=str)
print(f"  Loaded {len(fec)} FEC candidate records")

# Convert numeric columns upfront on the full FEC dataframe
numeric_cols = [
    "Total_Receipt",
    "Total_Disbursement",
    "Cash_On_Hand_COP",
    "Debt_Owed_By_Committee",
    "Individual_Contribution",
    "Other_Committee_Contribution",
    "Party_Committee_Contribution",
    "Cand_Contribution",
    "Cand_Loan",
]
for col in numeric_cols:
    if col in fec.columns:
        fec[col] = pd.to_numeric(fec[col], errors="coerce").fillna(0)


def _build_record(row, key_id):
    """Build a money record dict from an FEC row."""
    cov_date = row.get("Coverage_End_Date")
    if pd.isna(cov_date):
        cov_date = None
    return {
        "candidate_id": key_id,
        "total_receipts": int(row.get("Total_Receipt", 0)),
        "total_disbursements": int(row.get("Total_Disbursement", 0)),
        "cash_on_hand": int(row.get("Cash_On_Hand_COP", 0)),
        "debts_owed": int(row.get("Debt_Owed_By_Committee", 0)),
        "individual_contributions": int(row.get("Individual_Contribution", 0)),
        "pac_contributions": int(row.get("Other_Committee_Contribution", 0)),
        "party_contributions": int(row.get("Party_Committee_Contribution", 0)),
        "candidate_contributions": int(row.get("Cand_Contribution", 0)),
        "candidate_loans": int(row.get("Cand_Loan", 0)),
        "coverage_end_date": cov_date,
    }


# ── Part 1: Challengers (keyed by FEC candidate_id) ──

with dataset.connect(params) as dbx:
    challengers = pd.DataFrame(dbx["challengers"].find(active=True))

all_money_data = []

if not challengers.empty:
    print(f"  Loaded {len(challengers)} active challengers")

    challenger_ids = set(challengers["candidate_id"].tolist())
    fec_matched = fec[fec["Cand_Id"].isin(challenger_ids)].copy()
    print(f"  Matched {len(fec_matched)} challengers to FEC financial data")

    records = []
    for _, row in fec_matched.iterrows():
        records.append(_build_record(row, row["Cand_Id"]))

    if records:
        records_df = pd.DataFrame(records)
        records_df["total_receipts_rank"] = records_df["total_receipts"].rank(
            ascending=False, method="dense"
        )

        race_info = challengers[["candidate_id", "state", "office", "district"]].copy()
        records_df = records_df.merge(race_info, on="candidate_id", how="left")
        records_df["district"] = records_df["district"].fillna("")
        records_df["race_rank"] = records_df.groupby(["state", "office", "district"])[
            "total_receipts"
        ].rank(ascending=False, method="dense")
        records_df["race_rank"] = records_df["race_rank"].fillna(0)

        for _, row in records_df.iterrows():
            all_money_data.append(
                {
                    "candidate_id": row["candidate_id"],
                    "total_receipts": int(row["total_receipts"]),
                    "total_disbursements": int(row["total_disbursements"]),
                    "cash_on_hand": int(row["cash_on_hand"]),
                    "debts_owed": int(row["debts_owed"]),
                    "individual_contributions": int(row["individual_contributions"]),
                    "pac_contributions": int(row["pac_contributions"]),
                    "party_contributions": int(row["party_contributions"]),
                    "candidate_contributions": int(row["candidate_contributions"]),
                    "candidate_loans": int(row["candidate_loans"]),
                    "coverage_end_date": row["coverage_end_date"],
                    "total_receipts_rank": int(row["total_receipts_rank"]),
                    "race_rank": int(row["race_rank"]),
                }
            )

    print(f"  Built {len(all_money_data)} challenger financial records")
else:
    print("  No active challengers found")


# ── Part 2: Incumbents from officials table (keyed by bioguide_id) ──
# build_primary.py injects incumbents using bioguide_id as candidate_id,
# so we store their FEC data under bioguide_id for lookup.

with dataset.connect(params) as dbx:
    officials = pd.DataFrame(
        dbx.query(
            "SELECT bioguide_id, fec_ids, state, type, district "
            "FROM officials WHERE level = 'national' AND active = 1 "
            "AND fec_ids IS NOT NULL AND fec_ids != ''"
        )
    )

incumbent_records = 0
if not officials.empty:
    print(f"  Loaded {len(officials)} active federal officials with FEC IDs")

    # Expand comma-separated fec_ids and find the best match per official
    fec_by_cand_id = fec.set_index("Cand_Id")

    already_keyed = {r["candidate_id"] for r in all_money_data}

    for _, off in officials.iterrows():
        bio_id = off["bioguide_id"]
        if bio_id in already_keyed:
            continue  # Already have data for this official via challengers table

        fec_ids = [fid.strip() for fid in str(off["fec_ids"]).split(",") if fid.strip()]

        # Find the FEC record with the highest total receipts (most recent/relevant)
        best_row = None
        best_receipts = -1
        for fid in fec_ids:
            if fid in fec_by_cand_id.index:
                row = fec_by_cand_id.loc[fid]
                # Handle duplicate CAND_IDs (take first if DataFrame)
                if isinstance(row, pd.DataFrame):
                    row = row.iloc[0]
                receipts = row.get("Total_Receipt", 0)
                if receipts > best_receipts:
                    best_receipts = receipts
                    best_row = row

        if best_row is not None:
            record = _build_record(best_row, bio_id)
            # No race ranking for officials (they'll get ranked in context later)
            record["total_receipts_rank"] = 0
            record["race_rank"] = 0
            all_money_data.append(record)
            incumbent_records += 1

    print(f"  Matched {incumbent_records} incumbents (officials) to FEC financial data")
else:
    print("  No federal officials with FEC IDs found")


# ── Upsert all records ──

if not all_money_data:
    print("No financial data to upsert")
    exit(0)

with dataset.connect(params) as dbx:
    table = dbx.create_table(
        "challenger_money",
        primary_id="id",
        primary_type=dbx.types.integer,
        primary_increment=True,
    )
    table.create_column(
        "candidate_id", dbx.types.string(20), unique=True, nullable=False
    )
    dbx["challenger_money"].upsert_many(all_money_data, "candidate_id")

print(f"Upserted {len(all_money_data)} total financial records")
print(
    f"  ({len(all_money_data) - incumbent_records} challengers + {incumbent_records} incumbents)"
)

# Summary stats
total_raised = sum(r["total_receipts"] for r in all_money_data)
avg_raised = total_raised / len(all_money_data) if all_money_data else 0
print(f"  Total raised: ${total_raised:,.0f}")
print(f"  Average raised: ${avg_raised:,.0f}")
