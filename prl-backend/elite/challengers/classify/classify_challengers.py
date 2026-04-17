"""
Classify challenger rhetoric via OpenAI batch API.
Adapted from elite/rhetoric/classify/classify.py for the challengers pipeline.
"""

import os
import sys
import datetime
import argparse

import dotenv
import ibis
from ibis import _

# Add rhetoric classify module to path for shared modules
_project_root = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
sys.path.insert(0, os.path.join(_project_root, "elite", "rhetoric", "classify"))

import llms  # noqa: E402
import prompt  # noqa: E402
from batch_monitor import save_batch_ids  # noqa: E402

# Setup
dotenv.load_dotenv(os.path.join(_project_root, "env"))
if "PATH_TO_SECRETS" in os.environ:
    dotenv.load_dotenv(os.environ["PATH_TO_SECRETS"])

BATCH_IDS_FILE = os.path.join("logs", "challenger_batch_ids.json")


def get_db_connection():
    """Get database connection."""
    conn = ibis.mysql.connect(
        host=os.environ["DB_HOST"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database="elite",
    )
    return conn


def prepare_batch_data(data):
    """Prepare data for batch processing with system prompts."""
    initial_count = len(data)

    data = data[data["text"].notna()]
    data = data[data["text"].str.strip() != ""]

    filtered_count = len(data)
    if filtered_count < initial_count:
        print(
            f"  Filtered out {initial_count - filtered_count} items with empty/null text"
        )

    def safe_get_user_prompt(text):
        try:
            return prompt.get_user_prompt(text)
        except ValueError as e:
            print(f"  Skipping invalid text: {e}")
            return None

    data["user_message"] = data["text"].apply(safe_get_user_prompt)

    initial_with_messages = len(data)
    data = data[data["user_message"].notna()]
    if len(data) < initial_with_messages:
        print(
            f"  Removed {initial_with_messages - len(data)} items "
            f"due to prompt creation failures"
        )

    return data


def main():
    parser = argparse.ArgumentParser(
        description="Classify challenger text using OpenAI batch processing"
    )
    parser.add_argument(
        "--begin-date",
        type=str,
        default=(datetime.date.today() - datetime.timedelta(weeks=26)).strftime(
            "%Y-%m-%d"
        ),
    )
    parser.add_argument(
        "--end-date",
        type=str,
        default=datetime.date.today().strftime("%Y-%m-%d"),
    )
    parser.add_argument("--batch-size", type=int, default=15000)

    args = parser.parse_args()

    begin_date = datetime.datetime.strptime(args.begin_date, "%Y-%m-%d").date()
    end_date = datetime.datetime.strptime(args.end_date, "%Y-%m-%d").date()

    if begin_date > end_date:
        print(f"Begin date ({begin_date}) must be before end date ({end_date})")
        return

    if args.batch_size <= 0 or args.batch_size > 50000:
        print(f"Invalid batch size: {args.batch_size}")
        return

    conn = get_db_connection()

    unclassified_items = (
        conn.table("classifications_challengers")
        .select(
            [
                "id",
                "text",
                "date",
                "classified",
                "attack_personal",
                "attack_type",
                "attack_target",
                "attack_policy",
                "outcome_bipartisanship",
                "outcome_creditclaiming",
                "policy",
                "policy_area",
                "extreme_label",
                "extreme_target",
            ]
        )
        .filter(
            [
                _.date >= begin_date.strftime("%Y-%m-%d"),
                _.date <= end_date.strftime("%Y-%m-%d"),
                (_.classified != 1) | _.classified.isnull(),
            ]
        )
    )

    count = unclassified_items.count().execute()
    batch_size = args.batch_size

    print(
        f"Date range: {end_date} to {begin_date}\n"
        f"Unclassified items: {count:,}\n"
        f"Batch size: {batch_size:,}"
    )

    if count == 0:
        print("No unclassified items found.")
        return

    offset = 0
    total_processed = 0

    while offset < count:
        print(f"Processing batch starting at offset {offset}")

        batch_data = unclassified_items.limit(batch_size, offset=offset).execute()

        if batch_data.shape[0] == 0:
            break

        batch_data = prepare_batch_data(batch_data)

        print(f"Submitting batch of {batch_data.shape[0]} items...")
        batch_ids = llms.send_batch_with_system(
            batch_data, "challenger-classification", prompt.system_prompt, "gpt-4o"
        )

        print(f"Batch submitted with IDs: {batch_ids}")

        save_batch_ids(batch_ids, filename=BATCH_IDS_FILE)

        offset += batch_size
        total_processed += batch_data.shape[0]

        print(f"Submitted {total_processed} items for batch processing")

    print("==== CHALLENGER BATCH SUBMISSION COMPLETE ====")
    print(f"Total items submitted: {total_processed:,}")


if __name__ == "__main__":
    main()
