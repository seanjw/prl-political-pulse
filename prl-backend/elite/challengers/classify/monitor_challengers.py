"""
Monitor and retrieve OpenAI batch results for challenger classifications.
Adapted from elite/rhetoric/classify/batch_monitor.py — writes to
classifications_challengers instead of classifications.
"""

import os
import sys
import json
import time
import datetime
import argparse
import urllib.parse

import boto3
import dotenv
import dataset
import hjson

# Add rhetoric classify module to path for shared helpers
_project_root = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
sys.path.insert(0, os.path.join(_project_root, "elite", "rhetoric", "classify"))

import batch_monitor  # noqa: E402
from batch_monitor import (  # noqa: E402
    check_batch_status,
    download_batch_results,
    setup_signal_handlers,
    log_message,
)

# Setup
LOGS_DIR = "logs"
os.makedirs(LOGS_DIR, exist_ok=True)

BATCH_IDS_FILE = os.path.join(LOGS_DIR, "challenger_batch_ids.json")

dotenv.load_dotenv(os.path.join(_project_root, "env"))
if "PATH_TO_SECRETS" in os.environ:
    dotenv.load_dotenv(os.environ["PATH_TO_SECRETS"])


def get_db_params():
    """Get database connection parameters."""
    db_host = os.environ.get("DB_HOST", "localhost")
    return (
        f"{os.environ['DB_DIALECT']}://{os.environ['DB_USER']}:"
        f"{urllib.parse.quote(os.environ['DB_PASSWORD'])}@{db_host}:"
        f"{os.environ['DB_PORT']}/elite"
    )


def process_batch_results_to_db(batch_results, backup_file=None):
    """Process batch results and update classifications_challengers table.

    This is adapted from batch_monitor.process_batch_results_to_db() with
    the only difference being the target table name.
    """
    processed_data = []
    failed_responses = []
    error_log = []

    if len(batch_results) > 100:
        print(f"Processing {len(batch_results)} batch results...")

    created_files = []

    for i, result in enumerate(batch_results):
        try:
            custom_id = result.get("custom_id", f"unknown_{i}")
            original_id = custom_id.split("-")[-1] if "-" in custom_id else custom_id

            if "error" in result and result["error"] is not None:
                error_log.append(
                    {"id": original_id, "error": f"API Error: {result['error']}"}
                )
                continue

            if "response" not in result or "body" not in result["response"]:
                error_log.append(
                    {"id": original_id, "error": "Invalid response structure"}
                )
                continue

            response_status = result["response"].get("status_code", 0)
            if response_status != 200:
                error_log.append(
                    {"id": original_id, "error": f"HTTP {response_status}"}
                )
                continue

            response_body = result["response"]["body"]
            if "error" in response_body and response_body["error"] is not None:
                error_log.append(
                    {
                        "id": original_id,
                        "error": f"Response error: {response_body['error']}",
                    }
                )
                continue

            if "choices" not in response_body or len(response_body["choices"]) == 0:
                error_log.append({"id": original_id, "error": "No choices in response"})
                continue

            response_content = response_body["choices"][0]["message"]["content"]

            # Clean up JSON formatting
            cleaned_content = response_content
            if cleaned_content.lstrip().startswith("```json"):
                cleaned_content = cleaned_content.lstrip()[7:]
            if cleaned_content.rstrip().endswith("```"):
                cleaned_content = cleaned_content.rstrip()[:-3]

            if (
                "statement to analyze wasn't included" in response_content
                or "statement to analyze wasn\u2019t included" in response_content
            ):
                error_log.append(
                    {
                        "id": original_id,
                        "error": "Empty text error",
                        "error_type": "empty_text",
                    }
                )
                continue

            try:
                response = hjson.loads(cleaned_content)
            except Exception as json_error:
                error_log.append(
                    {
                        "id": original_id,
                        "error": f"JSON parse error: {json_error}",
                        "raw_content": response_content[:200],
                    }
                )
                continue

            def yesno(x):
                if x:
                    x = str(x).lower()
                    if x == "yes":
                        return 1
                    elif x == "no":
                        return 0
                return None

            row_data = {
                "id": int(original_id),
                "attack_personal": yesno(
                    response.get("attacks", {}).get("personal_attack")
                ),
                "attack_type": str(response.get("attacks", {}).get("attack_type", "")),
                "attack_target": str(
                    response.get("attacks", {}).get("personal_attack_target", "")
                ),
                "attack_policy": yesno(
                    response.get("policy_criticism", {}).get("policy_attack")
                ),
                "outcome_bipartisanship": yesno(
                    response.get("bipartisanship", {}).get("is_bipartisanship")
                ),
                "outcome_creditclaiming": yesno(
                    response.get("credit_claiming", {}).get("is_creditclaiming")
                ),
                "policy_area": str(response.get("policy", {}).get("policy_area", "[]")),
                "extreme_label": str(
                    response.get("extremism", {}).get("extreme_label", "")
                ),
                "extreme_target": str(
                    response.get("extremism", {}).get("extreme_target", "")
                ),
                "classified": 1,
            }

            try:
                policy_area_list = hjson.loads(row_data["policy_area"])
                row_data["policy"] = 1 if len(policy_area_list) > 0 else 0
            except Exception:
                row_data["policy"] = 0

            # Check for null critical fields
            critical_fields = [
                "attack_personal",
                "attack_policy",
                "outcome_bipartisanship",
                "outcome_creditclaiming",
            ]
            null_fields = [f for f in critical_fields if row_data[f] is None]

            if null_fields:
                error_log.append(
                    {"id": original_id, "error": f"Null fields: {null_fields}"}
                )
                failed_responses.append({"id": original_id, "reason": "null_fields"})
            else:
                processed_data.append(row_data)

        except Exception as e:
            error_log.append(
                {
                    "id": result.get("custom_id", f"unknown_{i}"),
                    "error": f"Unexpected error: {e}",
                }
            )

    # Save error log if there were errors
    if error_log:
        error_file = os.path.join(
            LOGS_DIR,
            f"challenger_errors_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
        )
        with open(error_file, "w") as f:
            json.dump(error_log, f, indent=2, default=str)
        print(f"Saved {len(error_log)} errors to {error_file}")
        created_files.append(error_file)

    # Update database — the key difference: classifications_challengers
    if processed_data:
        try:
            params = get_db_params()
            dbx = dataset.connect(params)
            dbx["classifications_challengers"].upsert_many(processed_data, "id")
            dbx.engine.dispose()
            dbx.close()

            if len(processed_data) > 100 or error_log:
                print(f"Updated {len(processed_data)} records in database")

            if not error_log and not failed_responses:
                for file_path in created_files:
                    try:
                        if os.path.exists(file_path):
                            os.remove(file_path)
                    except Exception:
                        pass
                if backup_file:
                    try:
                        if os.path.exists(backup_file):
                            os.remove(backup_file)
                    except Exception:
                        pass

        except Exception as db_error:
            print(f"Database update failed: {db_error}")
            backup_file_path = os.path.join(
                LOGS_DIR,
                f"challenger_db_backup_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
            )
            with open(backup_file_path, "w") as f:
                json.dump(processed_data, f, indent=2, default=str)
            print(f"Saved processed data to backup: {backup_file_path}")
            raise

    # Summary
    total_results = len(batch_results)
    successful = len(processed_data)
    failed = len(error_log)

    if failed > 0 or total_results > 100:
        print("\nPROCESSING SUMMARY:")
        print(f"  Total results: {total_results}")
        print(f"  Successful: {successful}")
        if failed > 0:
            print(f"  Failed: {failed}")

    return processed_data


def monitor_batches(filename=BATCH_IDS_FILE, wait_minutes=30):
    """Monitor tracked batches and process completed ones."""
    if not os.path.exists(filename):
        print(f"No batch tracking file found: {filename}")
        return False

    with open(filename, "r") as f:
        data = json.load(f)

    incomplete_batches = []
    completed_count = 0

    print(f"Monitoring {len(data.get('batches', []))} batch groups...")

    for batch_group in data.get("batches", []):
        print(f"\nChecking batch group from {batch_group['created_at']}:")
        all_completed = True

        for batch_id in batch_group["batch_ids"]:
            try:
                status_info = check_batch_status(batch_id)
                print(f"  Batch {batch_id}: {status_info['status']}")

                if status_info["status"] == "completed":
                    print("    Downloading and processing results...")
                    results, backup_file = download_batch_results(batch_id)
                    if results and backup_file:
                        try:
                            s3_key = (
                                f"data/challengers/batch_results/"
                                f"{os.path.basename(backup_file)}"
                            )
                            s3_bucket = os.environ["S3_BUCKET"]
                            boto3.client("s3").upload_file(
                                backup_file, s3_bucket, s3_key
                            )
                            print(f"    Backed up to s3://{s3_bucket}/{s3_key}")
                        except Exception as s3_err:
                            print(f"    S3 backup failed: {s3_err}")
                    if results:
                        processed = process_batch_results_to_db(results, backup_file)
                        if len(processed) > 10:
                            print(f"    Processed {len(processed)} items")
                    else:
                        print(f"    No results downloaded for batch {batch_id}")
                        all_completed = False

                elif status_info["status"] in ["failed", "expired", "cancelled"]:
                    print(f"    Batch failed with status: {status_info['status']}")

                else:
                    print(f"    Status: {status_info['status']}")
                    if status_info.get("request_counts"):
                        counts = status_info["request_counts"]
                        print(
                            f"       Progress: {counts.get('completed', 0)}/"
                            f"{counts.get('total', 0)} completed"
                        )
                    all_completed = False

            except Exception as e:
                print(f"    Error checking batch {batch_id}: {e}")
                all_completed = False

        if all_completed:
            completed_count += 1
        else:
            incomplete_batches.append(batch_group)

    if incomplete_batches:
        data["batches"] = incomplete_batches
        with open(filename, "w") as f:
            json.dump(data, f, indent=2)
        print(f"\n{len(incomplete_batches)} batch groups still in progress")
        return True
    else:
        os.remove(filename)
        print("\nALL BATCHES COMPLETED! Removed tracking file.")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Monitor OpenAI batch processing for challengers"
    )
    parser.add_argument(
        "--action",
        choices=["list", "status", "download", "monitor"],
        default="monitor",
    )
    parser.add_argument("--batch-id")
    parser.add_argument("--monitor-file", default=BATCH_IDS_FILE)
    parser.add_argument("--wait", type=int, default=15)

    args = parser.parse_args()

    if args.action == "status":
        if not args.batch_id:
            print("Please provide --batch-id")
            return
        status = check_batch_status(args.batch_id)
        print(json.dumps(status, indent=2, default=str))

    elif args.action == "download":
        if not args.batch_id:
            print("Please provide --batch-id")
            return
        results, backup_file = download_batch_results(args.batch_id)
        if results:
            processed = process_batch_results_to_db(results, backup_file)
            print(f"Processed {len(processed)} results")

    elif args.action == "monitor":
        setup_signal_handlers()
        monitor_log = os.path.join(
            LOGS_DIR,
            f"challenger_monitor_{datetime.datetime.now().strftime('%Y%m%d')}.log",
        )

        log_message(
            f"Starting challenger batch monitoring (every {args.wait} min)...",
            monitor_log,
        )

        cycle_count = 0
        try:
            while not batch_monitor.shutdown_requested:
                cycle_count += 1
                try:
                    log_message(f"Monitoring cycle #{cycle_count}", monitor_log)

                    still_monitoring = monitor_batches(args.monitor_file, args.wait)
                    if not still_monitoring:
                        log_message("All batches completed!", monitor_log)
                        break

                    if batch_monitor.shutdown_requested:
                        break

                    log_message(
                        f"Waiting {args.wait} minutes before next check...", monitor_log
                    )

                    total_sleep_seconds = args.wait * 60
                    for i in range(0, total_sleep_seconds, 30):
                        if batch_monitor.shutdown_requested:
                            break
                        time.sleep(min(30, total_sleep_seconds - i))

                except Exception as cycle_error:
                    log_message(
                        f"Error in cycle #{cycle_count}: {cycle_error}", monitor_log
                    )
                    for _ in range(60):
                        if batch_monitor.shutdown_requested:
                            break
                        time.sleep(1)

        except KeyboardInterrupt:
            log_message("Monitoring stopped by KeyboardInterrupt", monitor_log)
        finally:
            log_message("Monitoring session ended", monitor_log)


if __name__ == "__main__":
    main()
