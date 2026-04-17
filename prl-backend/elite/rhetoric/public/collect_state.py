"""
Export cumulative state elite data (rhetoric + profiles) to local .tmp/ directory.
Skips export if row counts unchanged.
"""

import os
import sys
import json
import zipfile

import dotenv

dotenv.load_dotenv("../../env")
dotenv.load_dotenv(os.environ["PATH_TO_SECRETS"])

import pandas as pd  # noqa: E402
import ibis  # noqa: E402
from ibis import _  # noqa: E402

# Columns to exclude from public state data exports
STATE_COLUMNS_TO_DROP = [
    "classified_backup",
    "bioguide_id",
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

current_classifications_count = (
    classifications.filter([_.classified == 1, _.openstates_id.notnull()])
    .count()
    .execute()
)
current_officials_count = (
    officials_table.filter([_.active == 1, _.level == "state"]).count().execute()
)

prev_classifications = row_counts.get("state_classifications", 0)
prev_officials = row_counts.get("state_officials", 0)

if (
    current_classifications_count == prev_classifications
    and current_officials_count == prev_officials
):
    print(
        f"No changes detected (state classifications: {current_classifications_count}, "
        f"state officials: {current_officials_count}). Skipping export."
    )
    sys.exit(0)

print("Changes detected:")
print(
    f"  state classifications: {prev_classifications} -> {current_classifications_count}"
)
print(f"  state officials: {prev_officials} -> {current_officials_count}")
print("Proceeding with export...")

# Setup tables
officials = conn.table("officials").filter([_.active == 1, _.level == "state"])
tweets_state = conn.table("tweets_state")

# --- STATE RHETORIC: Export all classified state tweets ---
print("Exporting state rhetoric data...")

rhetoric_data = classifications.filter(
    [_.date >= "2023-01-01", _.classified == 1, _.openstates_id.notnull()]
)

# Join with officials
joined_data = rhetoric_data.join(
    officials, rhetoric_data["openstates_id"] == officials["openstates_id"]
).select(
    rhetoric_data,
    officials["name"],
    officials["state"],
    officials["party"],
    officials["position"],
    officials["district"],
)

# Left join with tweets_state for tweet IDs
final_data = joined_data.left_join(
    tweets_state, joined_data["source_id"] == tweets_state["id"]
).select(joined_data, tweets_state["tweet_id"])

# Mutate tweet_id and url
final_data = final_data.mutate(
    tweet_id=ibis.ifelse(final_data["tweet_id"].isnull(), "", final_data["tweet_id"])
)

final_data = final_data.mutate(
    url=ibis.ifelse(
        (final_data["source"] == "tweets_state") & (final_data["tweet_id"] != ""),
        ibis.literal("https://x.com/i/status/") + final_data["tweet_id"],
        None,
    ),
    text=final_data["source"].cases(
        ("tweets_state", ibis.literal("")), else_=final_data["text"]
    ),
)

# Execute and save
result_data = final_data.execute()
result_data = result_data.drop(
    columns=["id", "errors", "dictionary", "valence"], errors="ignore"
)
orig_cols = len(result_data.columns)
result_data = result_data.drop(columns=STATE_COLUMNS_TO_DROP, errors="ignore")
print(
    f"  Dropped {orig_cols - len(result_data.columns)} restricted columns from state rhetoric data"
)

os.makedirs(".tmp", exist_ok=True)

result_data.to_csv(".tmp/state-rhetoric-all.csv", index=False)
with zipfile.ZipFile(".tmp/state-rhetoric-all.zip", "w", zipfile.ZIP_DEFLATED) as zf:
    zf.write(".tmp/state-rhetoric-all.csv", "state-rhetoric-all.csv")
os.remove(".tmp/state-rhetoric-all.csv")
print(f"  Saved state-rhetoric-all.zip ({len(result_data)} rows)")

# --- STATE COMMUNICATION META ---
print("Exporting state communication metadata...")
state_meta_rows = [
    (
        "openstates_id",
        "varchar",
        "OpenStates unique identifier for the state legislator",
    ),
    ("source", "varchar", "Source type (tweets_state)"),
    (
        "text",
        "mediumtext",
        "The text snippet classified by the model (blanked for tweets)",
    ),
    ("date", "date", "Date the original text was published"),
    ("name", "varchar", "Legislator full name"),
    ("state", "varchar", "Two-letter state code"),
    ("party", "varchar", "Political party"),
    ("position", "varchar", "Legislative chamber (upper or lower)"),
    ("district", "varchar", "Legislative district identifier"),
    ("classified", "tinyint", "Classification status flag"),
    (
        "attack_personal",
        "bigint",
        "1 if text contains a personal attack on character or reputation",
    ),
    (
        "attack_type",
        "mediumtext",
        "Type of personal attack (character, integrity, etc.)",
    ),
    ("attack_target", "mediumtext", "Target of the personal attack"),
    ("attack_explanation", "mediumtext", "Model explanation for attack classification"),
    ("attack_policy", "bigint", "1 if text contains policy criticism"),
    (
        "outcome_bipartisanship",
        "bigint",
        "1 if text contains mention of bipartisanship",
    ),
    (
        "bipartisanship_explanation",
        "mediumtext",
        "Model explanation for bipartisanship classification",
    ),
    (
        "outcome_creditclaiming",
        "bigint",
        "1 if text claims credit for an accomplishment",
    ),
    (
        "creditclaiming_explanation",
        "mediumtext",
        "Model explanation for credit claiming classification",
    ),
    ("policy", "bigint", "1 if text discusses a policy area"),
    ("policy_area", "mediumtext", "JSON array of policy areas discussed"),
    ("policy_explanation", "mediumtext", "Model explanation for policy classification"),
    ("extreme_label", "mediumtext", "1 if text uses an extremist label"),
    ("extreme_target", "varchar", "Target of extremist labeling"),
    ("tweet_id", "varchar", "Original tweet ID"),
    ("url", "varchar", "URL to the original tweet"),
]
state_meta_df = pd.DataFrame(
    state_meta_rows, columns=["COLUMN_NAME", "DATA_TYPE", "DESCRIPTION"]
)
state_meta_df.to_csv(".tmp/state-meta.csv", index=None)
print("  Saved state-meta.csv")

# --- STATE PROFILES ---
print("Exporting state profiles...")
rhetoric_state = conn.table("rhetoric_state").filter(_.source == "all")

rhetoric_state = rhetoric_state.rename(
    **{
        f"communication_{col}": col
        for col in rhetoric_state.columns
        if col not in ["id", "openstates_id"]
    }
)

profiles = (
    officials.select(
        [
            "openstates_id",
            "name",
            "first_name",
            "last_name",
            "state",
            "party",
            "position",
            "district",
            "gender",
            "title",
            "email",
            "government_website",
            "campaign_website",
            "twitter_handle",
            "facebook",
            "instagram",
            "youtube",
            "linkedin",
            "birthday",
        ]
    )
    .left_join(rhetoric_state, rhetoric_state.openstates_id == _.openstates_id)
    .drop(["id", "openstates_id_right"])
    .execute()
)
orig_cols = len(profiles.columns)
profiles = profiles.drop(columns=STATE_COLUMNS_TO_DROP, errors="ignore")
print(
    f"  Dropped {orig_cols - len(profiles.columns)} restricted columns from state profiles"
)

profiles.to_csv(
    ".tmp/state-profiles.zip",
    index=None,
    compression={"method": "zip", "archive_name": "state-profiles.csv"},
)
print(f"  Saved state-profiles.zip ({len(profiles)} rows)")

# --- STATE PROFILES META ---
print("Exporting state profiles metadata...")
state_profiles_meta_rows = [
    (
        "openstates_id",
        "varchar",
        "OpenStates unique identifier for the state legislator",
    ),
    ("name", "varchar", "Full name"),
    ("first_name", "varchar", "First name"),
    ("last_name", "varchar", "Last name"),
    ("state", "varchar", "Two-letter state code"),
    ("party", "varchar", "Political party"),
    ("position", "varchar", "Legislative chamber (upper or lower)"),
    ("district", "varchar", "Legislative district identifier"),
    ("gender", "varchar", "Gender"),
    ("title", "varchar", "Official title"),
    ("email", "varchar", "Official email address"),
    ("government_website", "varchar", "Official government website URL"),
    ("campaign_website", "varchar", "Campaign website URL"),
    ("twitter_handle", "varchar", "Twitter/X handle"),
    ("facebook", "varchar", "Facebook page"),
    ("instagram", "varchar", "Instagram handle"),
    ("youtube", "varchar", "YouTube channel"),
    ("linkedin", "varchar", "LinkedIn profile"),
    ("birthday", "date", "Date of birth"),
    ("communication_source", "text", "Source of classified text (all)"),
    ("communication_count", "bigint", "Total number of classified text snippets"),
    ("communication_party", "text", "Political party (from rhetoric table)"),
    ("communication_state", "text", "State (from rhetoric table)"),
    (
        "communication_attack_personal_sum",
        "bigint",
        "Total number of personal attack classifications",
    ),
    (
        "communication_attack_personal_mean",
        "float",
        "Mean rate of personal attack classifications (0-100)",
    ),
    (
        "communication_attack_personal_rank",
        "float",
        "Within-state rank for personal attacks (1 = highest)",
    ),
    (
        "communication_attack_policy_sum",
        "bigint",
        "Total number of policy criticism classifications",
    ),
    (
        "communication_attack_policy_mean",
        "float",
        "Mean rate of policy criticism classifications (0-100)",
    ),
    (
        "communication_attack_policy_rank",
        "float",
        "Within-state rank for policy criticism (1 = highest)",
    ),
    (
        "communication_outcome_creditclaiming_sum",
        "float",
        "Total credit claiming classifications",
    ),
    (
        "communication_outcome_creditclaiming_mean",
        "float",
        "Mean rate of credit claiming classifications (0-100)",
    ),
    (
        "communication_outcome_creditclaiming_rank",
        "float",
        "Within-state rank for credit claiming (1 = highest)",
    ),
    (
        "communication_outcome_bipartisanship_sum",
        "float",
        "Total bipartisanship classifications",
    ),
    (
        "communication_outcome_bipartisanship_mean",
        "float",
        "Mean rate of bipartisanship classifications (0-100)",
    ),
    (
        "communication_outcome_bipartisanship_rank",
        "float",
        "Within-state rank for bipartisanship (1 = highest)",
    ),
    ("communication_policy_sum", "float", "Total policy discussion classifications"),
    (
        "communication_policy_mean",
        "float",
        "Mean rate of policy discussion classifications (0-100)",
    ),
    (
        "communication_policy_rank",
        "float",
        "Within-state rank for policy discussion (1 = highest)",
    ),
]
state_profiles_meta_df = pd.DataFrame(
    state_profiles_meta_rows, columns=["COLUMN_NAME", "DATA_TYPE", "DESCRIPTION"]
)
state_profiles_meta_df.to_csv(".tmp/state-profiles-meta.csv", index=None)
print("  Saved state-profiles-meta.csv")

# Update row counts
row_counts["state_classifications"] = current_classifications_count
row_counts["state_officials"] = current_officials_count
save_row_counts(row_counts)
print("Updated row count log.")
