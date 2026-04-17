"""
Insert unclassified challenger tweets into classifications_challengers table.
Adapted from elite/rhetoric/classify/insert_performance.py for the challengers pipeline.
"""

import os
import sys
import datetime
import time
import urllib.parse

import dotenv
import numpy as np
import pandas as pd
import dataset
import ibis
from ibis import _

# Add rhetoric classify module to path for text processing
_project_root = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
sys.path.insert(0, os.path.join(_project_root, "elite", "rhetoric", "classify"))
import text  # noqa: E402

# Setup
dotenv.load_dotenv(os.path.join(_project_root, "env"))
if "PATH_TO_SECRETS" in os.environ:
    dotenv.load_dotenv(os.environ["PATH_TO_SECRETS"])

# DB connection
db_host = os.environ.get("DB_HOST", "localhost")
params = (
    f"{os.environ['DB_DIALECT']}://{os.environ['DB_USER']}:"
    f"{urllib.parse.quote(os.environ['DB_PASSWORD'])}@{db_host}:"
    f"{os.environ['DB_PORT']}/elite"
)
conn = ibis.mysql.connect(
    host=os.environ["DB_HOST"],
    user=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    database="elite",
    connect_timeout=6000,
    read_timeout=3000,
    write_timeout=3000,
)

# Date range
today = datetime.date.today()
beginning_date = today - datetime.timedelta(weeks=26)


def process_source(start_date, end_date):
    """Process tweets_challengers to find unclassified items."""
    source = "tweets_challengers"
    print(f"Processing {source} for date range {start_date} to {end_date}...")
    max_retries = 3

    try:
        source_table = conn.table(source)

        # Step 1: Get all IDs for the date range
        retry_count = 0
        ids_for_range = None

        while retry_count < max_retries:
            try:
                ids_query = source_table.filter(
                    [_.date >= start_date, _.date <= end_date, _.text.notnull()]
                ).select([_.id, _.date])
                ids_for_range = ids_query.execute()
                break
            except Exception as e:
                retry_count += 1
                if (
                    "connection" in str(e).lower()
                    or "server has gone away" in str(e).lower()
                ):
                    if retry_count < max_retries:
                        wait_time = retry_count * 3
                        print(
                            f"  Query retry {retry_count}/{max_retries}: {str(e)[:60]}..."
                        )
                        time.sleep(wait_time)
                    else:
                        raise
                else:
                    raise

        if ids_for_range is None or ids_for_range.empty:
            print(f"  No items found for {source} in date range")
            return []

        print(f"  Found {len(ids_for_range)} total items")

        # Step 2: Check which IDs already exist in classifications_challengers
        id_list = ids_for_range["id"].tolist()
        existing_ids = []
        chunk_size = 50000

        id_chunks = [
            id_list[i : i + chunk_size] for i in range(0, len(id_list), chunk_size)
        ]

        for chunk_idx, id_chunk in enumerate(id_chunks):
            retry_count = 0
            while retry_count < max_retries:
                try:
                    classifications = conn.table("classifications_challengers")
                    chunk_clsf = (
                        classifications.filter(_.source == source)
                        .group_by(_.source_id)
                        .aggregate()
                        .filter(_.source_id.isin(id_chunk))
                        .execute()
                    )
                    if not chunk_clsf.empty:
                        existing_ids.extend(chunk_clsf["source_id"].tolist())
                    break
                except Exception as e:
                    retry_count += 1
                    if (
                        "connection" in str(e).lower()
                        or "server has gone away" in str(e).lower()
                    ):
                        if retry_count < max_retries:
                            time.sleep(retry_count * 3)
                        else:
                            raise
                    else:
                        raise

        print(f"  Found {len(existing_ids)} existing classifications")

        # Step 3: Find missing IDs
        missing_ids = ids_for_range[~ids_for_range["id"].isin(existing_ids)]

        if missing_ids.empty:
            print("  No new items found")
            return []

        print(f"  Found {len(missing_ids)} new items")

        # Step 4: Get full records for missing IDs
        missing_id_list = missing_ids["id"].tolist()
        chunk_size = 25000
        missing_chunks = [
            missing_id_list[i : i + chunk_size]
            for i in range(0, len(missing_id_list), chunk_size)
        ]

        all_missing_items = []
        for chunk_idx, missing_chunk in enumerate(missing_chunks):
            retry_count = 0
            while retry_count < max_retries:
                try:
                    items_query = source_table.filter(_.id.isin(missing_chunk)).select(
                        [_.id, _.candidate_id, _.text, _.date]
                    )
                    chunk_items = items_query.execute()
                    if not chunk_items.empty:
                        all_missing_items.append(chunk_items)
                    break
                except Exception as e:
                    retry_count += 1
                    if (
                        "connection" in str(e).lower()
                        or "server has gone away" in str(e).lower()
                    ):
                        if retry_count < max_retries:
                            time.sleep(retry_count * 3)
                        else:
                            raise
                    else:
                        raise

        if not all_missing_items:
            print("  No records retrieved")
            return []

        missing_items = pd.concat(all_missing_items, ignore_index=True)

        # Step 5: Process text chunks
        missing_items["text"] = missing_items["text"].apply(
            lambda x: text.process[source](x)
        )

        # Step 6: Expand so each chunk gets its own row
        missing_items = missing_items.explode("text", ignore_index=True)

        # Step 7: Add metadata
        missing_items["source"] = source
        missing_items.rename(columns={"id": "source_id"}, inplace=True)
        missing_items["errors"] = missing_items.apply(lambda row: {}, axis=1).astype(
            object
        )
        missing_items = missing_items.fillna(np.nan).replace([np.nan], [None])

        print(f"  Processed {len(missing_items)} text chunks")
        return missing_items.to_dict(orient="records")

    except Exception as e:
        print(f"  Error processing {source}: {str(e)[:100]}...")
        return []


def main():
    print("=" * 60)
    print("CHALLENGER CLASSIFICATION INSERT")
    print("=" * 60)
    print(f"Date range: {beginning_date} to {today}")

    all_new_records = process_source(beginning_date, today)

    if all_new_records:
        print(f"\nBULK INSERT: {len(all_new_records)} total records")

        batch_size = 10000
        total_inserted = 0
        max_retries = 3

        for i in range(0, len(all_new_records), batch_size):
            batch = all_new_records[i : i + batch_size]
            batch_num = (i // batch_size) + 1
            retry_count = 0

            while retry_count < max_retries:
                try:
                    dbx_batch = dataset.connect(
                        params
                        + "?charset=utf8mb4&connect_timeout=60&read_timeout=300&write_timeout=300"
                    )
                    dbx_batch["classifications_challengers"].insert_many(batch)
                    dbx_batch.engine.dispose()
                    dbx_batch.close()

                    total_inserted += len(batch)
                    print(
                        f"  Inserted batch {batch_num} "
                        f"({len(batch)} records, {total_inserted}/{len(all_new_records)} total)"
                    )
                    break
                except Exception as e:
                    retry_count += 1
                    if retry_count < max_retries:
                        print(
                            f"  Batch {batch_num} failed (attempt {retry_count}/{max_retries}): "
                            f"{str(e)[:100]}..."
                        )
                        time.sleep(retry_count * 2)
                    else:
                        raise

            if i + batch_size < len(all_new_records):
                time.sleep(0.1)

        print(f"Successfully inserted {total_inserted} new records")
    else:
        print("\nNo new records to insert")


if __name__ == "__main__":
    main()
