"""
Export cumulative elite data (rhetoric + profiles) to local .tmp/ directory.
Skips export if row counts unchanged.
"""

import gc
import os
import sys
import json
import zipfile

import pymysql
import pymysql.cursors

import dotenv

dotenv.load_dotenv("../../env")
dotenv.load_dotenv(os.environ["PATH_TO_SECRETS"])

import pandas as pd  # noqa: E402
import ibis  # noqa: E402
from ibis import _  # noqa: E402

# Columns to exclude from public elite data exports
ELITE_COLUMNS_TO_DROP = [
    "classified_backup",
    "openstates_id",
    "communication_policy_legislative_discussion_sum",
    "communication_policy_legislative_discussion_mean",
    "communication_policy_legislative_discussion_rank",
    "communication_attack_personal_count",
    "communication_outcome_creditclaiming_count",
    "communication_policy_count",
    "communication_policy_legislative_discussion_count",
    "communication_outcome_bipartisanship_count",
    "communication_attack_policy_count",
    "communication_attack_count",
    "communication_attack_sum",
    "communication_attack_mean",
    "communication_attack_rank",
]

# Setup
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROW_COUNTS_FILE = os.path.join(SCRIPT_DIR, ".row_counts.json")

conn = ibis.mysql.connect(
    host=os.environ["DB_HOST"],
    user=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    database="elite",
)


# Row count tracking functions
def load_row_counts():
    if os.path.exists(ROW_COUNTS_FILE):
        with open(ROW_COUNTS_FILE, "r") as f:
            return json.load(f)
    return {}


def save_row_counts(counts):
    with open(ROW_COUNTS_FILE, "w") as f:
        json.dump(counts, f, indent=2)


# Check row counts
row_counts = load_row_counts()

classifications = conn.table("classifications")
officials_table = conn.table("officials")
classifications_challengers = conn.table("classifications_challengers")

current_classifications_count = (
    classifications.filter(_.classified == 1).count().execute()
)
current_officials_count = (
    officials_table.filter([_.active == 1, _.level == "national"]).count().execute()
)
current_all_national_count = (
    officials_table.filter(_.level == "national").count().execute()
)
current_challengers_count = (
    classifications_challengers.filter(_.classified == 1).count().execute()
)

prev_classifications = row_counts.get("classifications", 0)
prev_officials = row_counts.get("officials", 0)
prev_all_national = row_counts.get("all_national", 0)
prev_challengers = row_counts.get("classifications_challengers", 0)

if (
    current_classifications_count == prev_classifications
    and current_officials_count == prev_officials
    and current_all_national_count == prev_all_national
    and current_challengers_count == prev_challengers
):
    print(
        f"No changes detected (classifications: {current_classifications_count}, "
        f"officials: {current_officials_count}, "
        f"all_national: {current_all_national_count}, "
        f"challengers: {current_challengers_count}). Skipping export."
    )
    sys.exit(0)

print("Changes detected:")
print(f"  classifications: {prev_classifications} -> {current_classifications_count}")
print(f"  officials: {prev_officials} -> {current_officials_count}")
print(f"  all_national: {prev_all_national} -> {current_all_national_count}")
print(
    f"  classifications_challengers: {prev_challengers} -> {current_challengers_count}"
)
print("Proceeding with export...")

# Setup tables
officials = (
    conn.table("officials")
    .mutate(full_name=(_.first_name + ibis.literal(" ") + _.last_name))
    .filter([_.active == 1, _.level == "national"])
)
officials_all_national = (
    conn.table("officials")
    .mutate(full_name=(_.first_name + ibis.literal(" ") + _.last_name))
    .filter(_.level == "national")
)
tweets = conn.table("tweets")

os.makedirs(".tmp", exist_ok=True)

# --- RHETORIC: All national (including former legislators, all dates) ---
# Run this first since it's the largest export; uses server-side cursor to stream
print("Exporting rhetoric data — all national legislators...")

all_national_sql = """
SELECT c.*, o.first_name, o.last_name, o.state, o.type, t.tweet_id
FROM classifications c
JOIN officials o ON c.bioguide_id = o.bioguide_id
JOIN tweets t ON c.source_id = t.id
WHERE c.classified = 1 AND o.level = 'national'
"""

streaming_conn = pymysql.connect(
    host=os.environ["DB_HOST"],
    user=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    database="elite",
    cursorclass=pymysql.cursors.SSCursor,
)

chunk_size = 100_000
total_rows = 0
first_chunk = True

try:
    cursor = streaming_conn.cursor()
    cursor.execute(all_national_sql)
    columns = [desc[0] for desc in cursor.description]

    with zipfile.ZipFile(
        ".tmp/rhetoric-all-national.zip", "w", zipfile.ZIP_DEFLATED, allowZip64=True
    ) as zf:
        with zf.open("rhetoric-all-national.csv", "w", force_zip64=True) as csv_file:
            while True:
                rows = cursor.fetchmany(chunk_size)
                if not rows:
                    break
                chunk = pd.DataFrame(rows, columns=columns)
                # Apply same transformations as active-only export
                chunk["tweet_id"] = chunk["tweet_id"].fillna("")
                chunk["url"] = None
                mask = (chunk["source"] == "tweets") & (chunk["tweet_id"] != "")
                chunk.loc[mask, "url"] = (
                    "https://twitter.com/00000000000/status/"
                    + chunk.loc[mask, "tweet_id"]
                )
                chunk.loc[chunk["source"] == "tweets", "text"] = ""
                chunk = chunk.drop(
                    columns=["errors", "dictionary", "valence"], errors="ignore"
                )
                chunk = chunk.drop(columns=ELITE_COLUMNS_TO_DROP, errors="ignore")
                csv_bytes = chunk.to_csv(index=False, header=first_chunk).encode(
                    "utf-8"
                )
                csv_file.write(csv_bytes)
                total_rows += len(chunk)
                first_chunk = False
                print(f"  Processed chunk: {total_rows} rows so far...", flush=True)
finally:
    streaming_conn.close()

print(f"  Saved rhetoric-all-national.zip ({total_rows} rows)")

# --- RHETORIC: Active-only export (current members, 2023+) ---
print("Exporting rhetoric data (active legislators, 2023+)...")

rhetoric_data = classifications.filter([_.date >= "2023-01-01", _.classified == 1])

joined_data = rhetoric_data.join(
    officials, rhetoric_data["bioguide_id"] == officials["bioguide_id"]
).select(
    rhetoric_data,
    officials["first_name"],
    officials["last_name"],
    officials["state"],
    officials["type"],
)

final_data = joined_data.join(tweets, joined_data["source_id"] == tweets["id"]).select(
    joined_data, tweets["tweet_id"]
)

final_data = final_data.mutate(
    tweet_id=ibis.ifelse(final_data["tweet_id"].isnull(), "", final_data["tweet_id"])
)

final_data = final_data.mutate(
    url=ibis.ifelse(
        (final_data["source"] == "tweets") & (final_data["tweet_id"] != ""),
        ibis.literal("https://twitter.com/00000000000/status/")
        + final_data["tweet_id"],
        None,
    ),
    text=final_data["source"].cases(
        ("tweets", ibis.literal("")), else_=final_data["text"]
    ),
)

result_data = final_data.execute()
result_data = result_data.drop(columns=["errors", "dictionary", "valence"])
orig_cols = len(result_data.columns)
result_data = result_data.drop(columns=ELITE_COLUMNS_TO_DROP, errors="ignore")
print(
    f"  Dropped {orig_cols - len(result_data.columns)} restricted columns from rhetoric data"
)

result_data.to_csv(".tmp/rhetoric-all.csv", index=False)
with zipfile.ZipFile(".tmp/rhetoric-all.zip", "w", zipfile.ZIP_DEFLATED) as zf:
    zf.write(".tmp/rhetoric-all.csv", "rhetoric-all.csv")
os.remove(".tmp/rhetoric-all.csv")
print(f"  Saved rhetoric-all.zip ({len(result_data)} rows)")

del result_data, final_data, joined_data
gc.collect()

# --- COMMUNICATION META ---
print("Exporting communication metadata...")
meta_data_query = """
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_COMMENT
FROM
    INFORMATION_SCHEMA.COLUMNS
WHERE
    TABLE_SCHEMA = 'elite'
    AND TABLE_NAME = '{table}';
"""

comm_meta = pd.DataFrame(
    conn.raw_sql(meta_data_query.format(table="classifications")),
    columns=["COLUMN_NAME", "DATA_TYPE", "DESCRIPTION"],
).query('COLUMN_NAME not in ["id", "dictionary", "errors", "valence"]')
comm_meta = comm_meta[~comm_meta["COLUMN_NAME"].isin(ELITE_COLUMNS_TO_DROP)]
comm_meta.to_csv(".tmp/communication-meta.csv", index=None)

# --- PROFILES ---
print("Exporting profiles...")
ideology = conn.table("ideology")
efficacy = conn.table("efficacy")
attendance = conn.table("attendance")
money = conn.table("money")
rhetoric = conn.table("rhetoric").filter(_.source == "all")

ideology = ideology.rename(
    **{
        f"ideology_{col}": col
        for col in ideology.columns
        if col not in ["id", "bioguide_id"]
    }
)
efficacy = efficacy.rename(
    **{
        f"efficacy_{col}": col
        for col in efficacy.columns
        if col not in ["id", "bioguide_id"]
    }
)
attendance = attendance.rename(
    **{
        f"attendance_{col}": col
        for col in attendance.columns
        if col not in ["id", "bioguide_id"]
    }
)
money = money.rename(
    **{f"money_{col}": col for col in money.columns if col not in ["id", "bioguide_id"]}
)
rhetoric = rhetoric.rename(
    **{
        f"communication_{col}": col
        for col in rhetoric.columns
        if col not in ["id", "bioguide_id"]
    }
)

# --- PROFILES: All national first (including former legislators) ---
print("Exporting profiles — all national legislators...")
profiles_all_national = (
    officials_all_national.select(["bioguide_id", "full_name"])
    .left_join(ideology, ideology.bioguide_id == _.bioguide_id)
    .drop(["id", "bioguide_id_right"])
    .left_join(efficacy, efficacy.bioguide_id == _.bioguide_id)
    .drop(["id", "bioguide_id_right"])
    .left_join(attendance, attendance.bioguide_id == _.bioguide_id)
    .drop(["id", "bioguide_id_right"])
    .left_join(money, money.bioguide_id == _.bioguide_id)
    .drop(["id", "bioguide_id_right"])
    .left_join(rhetoric, rhetoric.bioguide_id == _.bioguide_id)
    .drop(["id", "bioguide_id_right"])
    .execute()
)
orig_cols = len(profiles_all_national.columns)
profiles_all_national = profiles_all_national.drop(
    columns=ELITE_COLUMNS_TO_DROP, errors="ignore"
)
print(f"  Dropped {orig_cols - len(profiles_all_national.columns)} restricted columns")

profiles_all_national.to_csv(
    ".tmp/profiles-all-national.zip",
    index=None,
    compression={"method": "zip", "archive_name": "profiles-all-national.csv"},
)
print(f"  Saved profiles-all-national.zip ({len(profiles_all_national)} rows)")

# --- PROFILES: Active only ---
print("Exporting profiles (active legislators)...")
profiles = (
    officials.select(["bioguide_id", "full_name"])
    .left_join(ideology, ideology.bioguide_id == _.bioguide_id)
    .drop(["id", "bioguide_id_right"])
    .left_join(efficacy, efficacy.bioguide_id == _.bioguide_id)
    .drop(["id", "bioguide_id_right"])
    .left_join(attendance, attendance.bioguide_id == _.bioguide_id)
    .drop(["id", "bioguide_id_right"])
    .left_join(money, money.bioguide_id == _.bioguide_id)
    .drop(["id", "bioguide_id_right"])
    .left_join(rhetoric, rhetoric.bioguide_id == _.bioguide_id)
    .drop(["id", "bioguide_id_right"])
    .execute()
)
orig_cols = len(profiles.columns)
profiles = profiles.drop(columns=ELITE_COLUMNS_TO_DROP, errors="ignore")
print(f"  Dropped {orig_cols - len(profiles.columns)} restricted columns from profiles")

profiles.to_csv(
    ".tmp/profiles.zip",
    index=None,
    compression={"method": "zip", "archive_name": "profiles.csv"},
)
print(f"  Saved profiles.zip ({len(profiles)} rows)")

# --- PROFILES META ---
print("Exporting profiles metadata...")
ideology_meta = pd.DataFrame(
    conn.raw_sql(meta_data_query.format(table="ideology")),
    columns=["COLUMN_NAME", "DATA_TYPE", "DESCRIPTION"],
).query('COLUMN_NAME != "id"')
efficacy_meta = (
    pd.DataFrame(
        conn.raw_sql(meta_data_query.format(table="efficacy")),
        columns=["COLUMN_NAME", "DATA_TYPE", "DESCRIPTION"],
    )
    .query('COLUMN_NAME != "id"')
    .query('COLUMN_NAME != "bioguide_id"')
)
attendance_meta = (
    pd.DataFrame(
        conn.raw_sql(meta_data_query.format(table="attendance")),
        columns=["COLUMN_NAME", "DATA_TYPE", "DESCRIPTION"],
    )
    .query('COLUMN_NAME != "id"')
    .query('COLUMN_NAME != "bioguide_id"')
)
money_meta = (
    pd.DataFrame(
        conn.raw_sql(meta_data_query.format(table="money")),
        columns=["COLUMN_NAME", "DATA_TYPE", "DESCRIPTION"],
    )
    .query('COLUMN_NAME != "id"')
    .query('COLUMN_NAME != "bioguide_id"')
)
rhetoric_meta = (
    pd.DataFrame(
        conn.raw_sql(meta_data_query.format(table="rhetoric")),
        columns=["COLUMN_NAME", "DATA_TYPE", "DESCRIPTION"],
    )
    .query('COLUMN_NAME != "id"')
    .query('COLUMN_NAME != "bioguide_id"')
)

ideology_meta["COLUMN_NAME"] = ideology_meta["COLUMN_NAME"].apply(
    lambda x: f"ideology_{x}" if x != "bioguide_id" else x
)
efficacy_meta["COLUMN_NAME"] = efficacy_meta["COLUMN_NAME"].apply(
    lambda x: f"efficacy_{x}"
)
attendance_meta["COLUMN_NAME"] = attendance_meta["COLUMN_NAME"].apply(
    lambda x: f"attendance_{x}"
)
money_meta["COLUMN_NAME"] = money_meta["COLUMN_NAME"].apply(lambda x: f"money_{x}")
rhetoric_meta["COLUMN_NAME"] = rhetoric_meta["COLUMN_NAME"].apply(
    lambda x: f"communication_{x}"
)

schema = pd.concat(
    [ideology_meta, efficacy_meta, attendance_meta, money_meta, rhetoric_meta],
    axis=0,
    ignore_index=True,
)
schema = schema[~schema["COLUMN_NAME"].isin(ELITE_COLUMNS_TO_DROP)]
schema.to_csv(".tmp/profiles-meta.csv", index=None)

# --- PRIMARY RHETORIC ---
print("Exporting primary candidate rhetoric data...")

challengers = conn.table("challengers").filter(_.active == 1)
tweets_challengers = conn.table("tweets_challengers")

primary_data = classifications_challengers.filter(_.classified == 1)

# Join with challengers for candidate metadata
primary_joined = primary_data.join(
    challengers, primary_data["candidate_id"] == challengers["candidate_id"]
).select(
    primary_data,
    challengers["name"],
    challengers["party"],
    challengers["state"],
    challengers["office_full"],
    challengers["district"],
    challengers["incumbent_challenge"],
)

# Join with tweets_challengers for tweet IDs
primary_final = primary_joined.join(
    tweets_challengers, primary_joined["source_id"] == tweets_challengers["id"]
).select(primary_joined, tweets_challengers["tweet_id"])

# Build tweet URLs
primary_final = primary_final.mutate(
    tweet_id=ibis.ifelse(
        primary_final["tweet_id"].isnull(), "", primary_final["tweet_id"]
    ),
)
primary_final = primary_final.mutate(
    url=ibis.ifelse(
        primary_final["tweet_id"] != "",
        ibis.literal("https://x.com/i/status/") + primary_final["tweet_id"],
        None,
    ),
)

primary_result = primary_final.execute()
primary_result = primary_result.drop(columns=["errors"], errors="ignore")

primary_result.to_csv(".tmp/primary-rhetoric.csv", index=False)
with zipfile.ZipFile(".tmp/primary-rhetoric.zip", "w", zipfile.ZIP_DEFLATED) as zf:
    zf.write(".tmp/primary-rhetoric.csv", "primary-rhetoric.csv")
os.remove(".tmp/primary-rhetoric.csv")
print(f"  Saved primary-rhetoric.zip ({len(primary_result)} rows)")

# --- PRIMARY META ---
print("Exporting primary metadata...")
primary_meta_rows = [
    ("candidate_id", "varchar", "FEC candidate ID"),
    ("source", "varchar", "Source type (tweets_challengers)"),
    ("text", "text", "Text chunk classified by the model"),
    ("date", "date", "Date of the original tweet"),
    ("name", "varchar", "Candidate full name"),
    ("party", "varchar", "Candidate party (REP, DEM, etc.)"),
    ("state", "varchar", "Two-letter state code"),
    ("office_full", "varchar", "Office sought (House, Senate)"),
    ("district", "varchar", "Congressional district number"),
    ("incumbent_challenge", "char", "C=challenger, I=incumbent, O=open seat"),
    ("attack_personal", "tinyint", "1 if text contains a personal attack"),
    ("attack_type", "varchar", "Type of personal attack (character, integrity, etc.)"),
    ("attack_target", "varchar", "Target of personal attack"),
    ("attack_policy", "tinyint", "1 if text contains a policy criticism"),
    ("outcome_bipartisanship", "tinyint", "1 if text expresses bipartisanship"),
    (
        "outcome_creditclaiming",
        "tinyint",
        "1 if text claims credit for an accomplishment",
    ),
    ("policy", "tinyint", "1 if text discusses a policy area"),
    ("policy_area", "text", "JSON array of policy areas discussed"),
    ("extreme_label", "varchar", "1 if text uses an extremist label"),
    ("extreme_target", "varchar", "Target of extremist labeling"),
    ("tweet_id", "varchar", "Original tweet ID"),
    ("url", "varchar", "URL to the original tweet"),
]
primary_meta_df = pd.DataFrame(
    primary_meta_rows, columns=["COLUMN_NAME", "DATA_TYPE", "DESCRIPTION"]
)
primary_meta_df.to_csv(".tmp/primary-meta.csv", index=None)
print("  Saved primary-meta.csv")

# Update row counts
row_counts["classifications"] = current_classifications_count
row_counts["officials"] = current_officials_count
row_counts["all_national"] = current_all_national_count
row_counts["classifications_challengers"] = current_challengers_count
save_row_counts(row_counts)
print("Updated row count log.")
