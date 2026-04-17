"""
Survey Processor Lambda Handler

Main entry point for processing survey uploads.
Triggered by S3 events when new CSV files are uploaded, or invoked directly.
"""

import json
import logging
import os
import traceback
from urllib.parse import unquote_plus

from processing.csv_ingestion import CSVIngestion
from processing.us_processor import USProcessor
from processing.international_processor import InternationalProcessor

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
S3_BUCKET = os.environ["S3_BUCKET"]

# Optional: DynamoDB for job tracking (set DYNAMODB_TABLE env var to enable)
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE")


def get_status_tracker():
    """Get status tracker if DynamoDB is configured."""
    if DYNAMODB_TABLE:
        from processing.status_tracker import StatusTracker

        return StatusTracker(DYNAMODB_TABLE)
    return None


def determine_upload_type(s3_key: str) -> str:
    """
    Determine upload type from S3 key path.

    Args:
        s3_key: S3 object key

    Returns:
        Upload type: 'labelled', 'unlabelled', or 'international'
    """
    key_lower = s3_key.lower()

    if "/labelled/" in key_lower or "_label." in key_lower or "_label_" in key_lower:
        return "labelled"
    elif "/unlabelled/" in key_lower:
        return "unlabelled"
    elif "/international/" in key_lower:
        return "international"
    else:
        # Default to labelled for US surveys
        if "dart0051" in key_lower:
            return "labelled"
        return "unknown"


def lambda_handler(event, context):
    """
    Main Lambda handler.

    Handles two types of events:
    1. S3 ObjectCreated events - automatic processing when CSV is uploaded
    2. Direct invocation - manual trigger for processing

    Args:
        event: Lambda event (S3 event or direct invocation payload)
        context: Lambda context

    Returns:
        Response dict with processing results
    """
    logger.info(f"Received event: {json.dumps(event)}")

    try:
        # Check if this is an S3 event or direct invocation
        if "Records" in event:
            # S3 event
            return handle_s3_event(event, context)
        elif "action" in event:
            # Direct invocation
            return handle_direct_invocation(event, context)
        else:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Invalid event format"}),
            }

    except Exception as e:
        logger.error(f"Handler error: {e}")
        logger.error(traceback.format_exc())
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e), "traceback": traceback.format_exc()}),
        }


def handle_s3_event(event, context):
    """
    Handle S3 ObjectCreated event.

    Processes uploaded CSV files: ingests into MySQL and runs analytics.
    """
    results = []
    tracker = get_status_tracker()

    for record in event["Records"]:
        bucket = record["s3"]["bucket"]["name"]
        key = unquote_plus(record["s3"]["object"]["key"])

        logger.info(f"Processing S3 object: s3://{bucket}/{key}")

        # Skip non-CSV files
        if not key.lower().endswith(".csv"):
            logger.info(f"Skipping non-CSV file: {key}")
            continue

        # Determine upload type
        upload_type = determine_upload_type(key)
        if upload_type == "unknown":
            logger.warning(f"Could not determine upload type for: {key}")
            continue

        logger.info(f"Upload type: {upload_type}")

        # Create job record if tracking is enabled
        job_id = None
        if tracker:
            job_id = tracker.create_job(key, upload_type, filename=key.split("/")[-1])

        try:
            # Step 1: Ingest CSV into MySQL
            if tracker:
                tracker.mark_ingesting(job_id)
            logger.info("Starting CSV ingestion...")

            ingestion = CSVIngestion()
            rows_inserted, metadata = ingestion.ingest(bucket, key, upload_type)
            ingestion.close()

            logger.info(
                f"Ingested {rows_inserted} rows into {metadata.get('table_name')}"
            )

            # Step 2: Run analytics pipeline
            if tracker:
                tracker.mark_processing(job_id, rows_inserted)
            logger.info("Starting analytics processing...")

            # Process based on upload type
            if upload_type in ("labelled", "unlabelled"):
                processor = USProcessor()
                processor.process()
                processor.close()

                # Also update international data since US data is used for comparison
                intl_processor = InternationalProcessor()
                intl_processor.process()
                intl_processor.close()
            else:
                # International upload
                intl_processor = InternationalProcessor()
                intl_processor.process()
                intl_processor.close()

            # Mark as completed
            if tracker:
                tracker.mark_completed(job_id, rows_inserted)

            results.append(
                {
                    "jobId": job_id,
                    "s3Key": key,
                    "uploadType": upload_type,
                    "status": "completed",
                    "rowsIngested": rows_inserted,
                    "metadata": metadata,
                }
            )

        except Exception as e:
            logger.error(f"Error processing {key}: {e}")
            logger.error(traceback.format_exc())
            if tracker and job_id:
                tracker.mark_failed(job_id, str(e))

            results.append(
                {
                    "jobId": job_id,
                    "s3Key": key,
                    "uploadType": upload_type,
                    "status": "failed",
                    "error": str(e),
                }
            )

    return {
        "statusCode": 200,
        "body": json.dumps(
            {"message": f"Processed {len(results)} file(s)", "results": results}
        ),
    }


def handle_direct_invocation(event, context):
    """
    Handle direct Lambda invocation.

    Supports actions:
    - 'process_us': Run US analytics pipeline
    - 'process_international': Run international analytics pipeline
    - 'process_all': Run both pipelines
    - 'get_status': Get job status by jobId
    """
    action = event.get("action")

    if action == "process_us":
        logger.info("Running US analytics pipeline...")
        processor = USProcessor()
        processor.process()
        processor.close()
        return {
            "statusCode": 200,
            "body": json.dumps({"message": "US analytics completed"}),
        }

    elif action == "process_international":
        logger.info("Running international analytics pipeline...")
        processor = InternationalProcessor()
        processor.process()
        processor.close()
        return {
            "statusCode": 200,
            "body": json.dumps({"message": "International analytics completed"}),
        }

    elif action == "process_policy_values":
        logger.info("Running policy values processing...")
        processor = USProcessor()
        us_labelled = processor.load_us_labelled()
        policy_data = processor.process_policy_values(us_labelled)
        processor.save_policy_values(policy_data)
        processor.close()
        return {
            "statusCode": 200,
            "body": json.dumps({"message": "Policy values processing completed"}),
        }

    elif action == "process_all":
        logger.info("Running full analytics pipeline...")

        # US first
        us_processor = USProcessor()
        us_processor.process()
        us_processor.close()

        # Then international
        intl_processor = InternationalProcessor()
        intl_processor.process()
        intl_processor.close()

        return {
            "statusCode": 200,
            "body": json.dumps({"message": "Full analytics completed"}),
        }

    elif action == "get_status":
        job_id = event.get("jobId")
        if not job_id:
            return {"statusCode": 400, "body": json.dumps({"error": "jobId required"})}

        tracker = get_status_tracker()
        if not tracker:
            return {
                "statusCode": 501,
                "body": json.dumps(
                    {"error": "Job tracking not configured (DYNAMODB_TABLE not set)"}
                ),
            }

        job = tracker.get_job(job_id)

        if not job:
            return {"statusCode": 404, "body": json.dumps({"error": "Job not found"})}

        return {"statusCode": 200, "body": json.dumps(job)}

    elif action == "debug_affpol":
        # Debug the affpol calculation step by step
        import pandas as pd
        import numpy as np
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
            cursorclass=pymysql.cursors.DictCursor,
        )

        # Check distinct engaged values and their counts
        cursor = conn.cursor()
        cursor.execute(
            "SELECT engaged, COUNT(*) as cnt FROM us_labelled GROUP BY engaged ORDER BY engaged LIMIT 10"
        )
        engaged_dist = [(r["engaged"], r["cnt"]) for r in cursor.fetchall()]

        # Get sample of actual data (skip any header-like rows)
        cursor.execute(
            "SELECT id, party, engaged, democrat_therm_1, republican_therm_1 FROM us_labelled WHERE democrat_therm_1 NOT LIKE '%therm%' LIMIT 10"
        )
        clean_sample = [dict(r) for r in cursor.fetchall()]

        # Check for header rows
        cursor.execute(
            "SELECT COUNT(*) as cnt FROM us_labelled WHERE democrat_therm_1 = 'democrat_therm_1'"
        )
        header_row_count = cursor.fetchone()["cnt"]

        conn.close()

        # Use cursor to fetch data, then convert to DataFrame
        conn2 = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
            cursorclass=pymysql.cursors.DictCursor,
        )
        cursor2 = conn2.cursor()
        cursor2.execute(
            "SELECT party, engaged, democrat_therm_1, republican_therm_1, weight FROM us_labelled WHERE democrat_therm_1 NOT LIKE %s LIMIT 1000",
            ("%therm%",),
        )
        rows = cursor2.fetchall()
        df = pd.DataFrame(rows)
        conn2.close()

        # Check actual raw values BEFORE conversion
        raw_sample = []
        if len(df) > 0:
            raw_sample = df.head(3).to_dict("records")

        # Convert to numeric
        df["engaged"] = pd.to_numeric(df["engaged"], errors="coerce")
        df["democrat_therm_1"] = pd.to_numeric(df["democrat_therm_1"], errors="coerce")
        df["republican_therm_1"] = pd.to_numeric(
            df["republican_therm_1"], errors="coerce"
        )

        debug_info = {
            "engaged_distribution": engaged_dist,
            "header_row_count": header_row_count,
            "clean_sample": clean_sample,
            "raw_sample_before_convert": raw_sample,
            "total_rows": len(df),
            "party_notna": int(df["party"].notna().sum()),
            "engaged_eq_1": int((df["engaged"] == 1).sum()),
            "party_and_engaged": int(
                (df["party"].notna() & (df["engaged"] == 1)).sum()
            ),
            "dem_therm_dtype": str(df["democrat_therm_1"].dtype),
            "rep_therm_dtype": str(df["republican_therm_1"].dtype),
            "dem_therm_sample": df["democrat_therm_1"].head(10).tolist(),
            "rep_therm_sample": df["republican_therm_1"].head(10).tolist(),
            "dem_therm_notna": int(df["democrat_therm_1"].notna().sum()),
            "rep_therm_notna": int(df["republican_therm_1"].notna().sum()),
        }

        # Try the affpol calculation
        filtered = df[df["party"].notna() & (df["engaged"] == 1)].copy()
        debug_info["filtered_rows"] = len(filtered)

        if len(filtered) > 0:
            # Convert therms to numeric
            filtered["democrat_therm_1"] = pd.to_numeric(
                filtered["democrat_therm_1"], errors="coerce"
            )
            filtered["republican_therm_1"] = pd.to_numeric(
                filtered["republican_therm_1"], errors="coerce"
            )

            filtered["affpol"] = np.where(
                filtered["party"] == "dems",
                filtered["democrat_therm_1"] - filtered["republican_therm_1"],
                filtered["republican_therm_1"] - filtered["democrat_therm_1"],
            )
            debug_info["affpol_notna"] = int(filtered["affpol"].notna().sum())
            debug_info["affpol_gte_0"] = int((filtered["affpol"] >= 0).sum())
            debug_info["affpol_sample"] = filtered["affpol"].head(10).tolist()

        return {"statusCode": 200, "body": json.dumps(debug_info, default=str)}

    elif action == "test_load_table":
        # Test if load_table works correctly
        # Note: InternationalProcessor is imported at module level
        processor = InternationalProcessor()

        try:
            df = processor.load_table("BR_labelled", "wave1")
            result = {
                "row_count": len(df),
                "columns": list(df.columns)[:10],
                "wave_values": df["wave"].unique().tolist()
                if "wave" in df.columns
                else [],
            }
            if len(df) > 0 and "party_affiliation" in df.columns:
                result["party_aff_sample"] = df["party_affiliation"].head(5).tolist()
        except Exception as e:
            result = {"error": str(e), "traceback": traceback.format_exc()}

        return {"statusCode": 200, "body": json.dumps(result, default=str)}

    elif action == "test_br_processing":
        # Test Brazil affpol processing step by step
        import pandas as pd
        import numpy as np
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
            cursorclass=pymysql.cursors.DictCursor,
        )
        cursor = conn.cursor()

        # Load BR_labelled for wave1
        cursor.execute("SELECT * FROM BR_labelled WHERE wave = %s", ("wave1",))
        rows = cursor.fetchall()
        data = pd.DataFrame(rows)
        conn.close()

        debug_info = {"row_count": len(data)}

        if len(data) > 0:
            # Config from international.json
            party_therm_map = {
                "PT": "pt_therm_1",
                "PL": "pl_therm_1",
                "PMDB/MDB": "mdb_therm_1",
                "PSDB": "psdb_therm_1",
                "PSOL": "psol_therm_1",
                "PDT": "pdt_therm_1",
                "NOVO": "novo_therm_1",
            }

            # Convert thermometer columns to numeric
            for party_therm in party_therm_map.values():
                if party_therm in data.columns:
                    data[party_therm] = pd.to_numeric(
                        data[party_therm].replace({"skipped": None, "": None}),
                        errors="coerce",
                    )

            debug_info["therm_converted"] = True
            debug_info["pt_therm_sample"] = (
                data["pt_therm_1"].head(5).tolist()
                if "pt_therm_1" in data.columns
                else []
            )

            # Get inparty rating
            def get_inparty_rating(row):
                party = row.get("party_affiliation")
                if party and party in party_therm_map:
                    therm_col = party_therm_map[party]
                    if therm_col in row.index:
                        return row[therm_col]
                return np.nan

            data["inparty_rating"] = data.apply(get_inparty_rating, axis=1)
            debug_info["inparty_notna"] = int(data["inparty_rating"].notna().sum())
            debug_info["inparty_sample"] = data["inparty_rating"].head(10).tolist()

            # Get outparty rating
            def get_outparty_rating(row):
                party = row.get("party_affiliation")
                other_therms = []
                for pt, therm_col in party_therm_map.items():
                    if pt != party and therm_col in row.index:
                        val = row[therm_col]
                        if pd.notna(val):
                            other_therms.append(val)
                return np.mean(other_therms) if other_therms else np.nan

            data["outparty_rating"] = data.apply(get_outparty_rating, axis=1)
            debug_info["outparty_notna"] = int(data["outparty_rating"].notna().sum())

            # Calculate affpol
            data["affpol"] = data["inparty_rating"] - data["outparty_rating"]
            debug_info["affpol_notna"] = int(data["affpol"].notna().sum())
            debug_info["affpol_mean"] = (
                float(data["affpol"].mean()) if data["affpol"].notna().any() else None
            )

        return {"statusCode": 200, "body": json.dumps(debug_info, default=str)}

    elif action == "test_intl_affpol":
        # Test international affpol processing for Brazil
        import pandas as pd
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
            cursorclass=pymysql.cursors.DictCursor,
        )
        cursor = conn.cursor()

        # Load BR_labelled for wave1
        cursor.execute(
            "SELECT * FROM BR_labelled WHERE wave = %s LIMIT 100", ("wave1",)
        )
        rows = cursor.fetchall()
        df = pd.DataFrame(rows)

        debug_info = {
            "row_count": len(df),
            "columns": list(df.columns)[:30] if len(df) > 0 else [],
        }

        if len(df) > 0:
            # Check party_affiliation values
            debug_info["party_affiliation_values"] = (
                df["party_affiliation"].unique().tolist()[:10]
                if "party_affiliation" in df.columns
                else "column not found"
            )

            # Check thermometer columns
            therm_cols = [c for c in df.columns if "therm" in c]
            debug_info["therm_columns"] = therm_cols

            # Sample values
            if "pt_therm_1" in df.columns:
                debug_info["pt_therm_sample"] = df["pt_therm_1"].head(5).tolist()
            if "party_affiliation" in df.columns:
                debug_info["party_aff_sample"] = (
                    df["party_affiliation"].head(5).tolist()
                )

        conn.close()
        return {"statusCode": 200, "body": json.dumps(debug_info, default=str)}

    elif action == "debug_intl":
        # Debug international tables
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
        )
        cursor = conn.cursor()

        # Check BR_labelled columns
        cursor.execute("DESCRIBE BR_labelled")
        br_columns = [row[0] for row in cursor.fetchall()]

        # Check if wave column exists and its values
        cursor.execute("SELECT DISTINCT wave FROM BR_labelled LIMIT 10")
        br_waves = [row[0] for row in cursor.fetchall()]

        # Sample row from BR_labelled
        cursor.execute("SELECT * FROM BR_labelled LIMIT 1")
        cursor.fetchone()
        br_sample_cols = [desc[0] for desc in cursor.description]

        conn.close()
        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "br_columns": br_columns[:20],
                    "br_waves": br_waves,
                    "br_sample_cols": br_sample_cols[:20],
                }
            ),
        }

    elif action == "list_tables":
        # List all tables in the surveys database
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
        )
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]

        # Get row counts for each table
        table_counts = {}
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM `{table}`")
            table_counts[table] = cursor.fetchone()[0]

        conn.close()
        return {
            "statusCode": 200,
            "body": json.dumps({"tables": tables, "table_counts": table_counts}),
        }

    elif action == "debug_tables":
        # Debug action to check database tables
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
        )
        cursor = conn.cursor()

        # Get columns for us_labelled
        cursor.execute("DESCRIBE us_labelled")
        us_labelled_columns = [row[0] for row in cursor.fetchall()]

        # Get sample data
        cursor.execute("SELECT COUNT(*) FROM us_labelled")
        row_count = cursor.fetchone()[0]

        # Check pid7 values
        cursor.execute("SELECT DISTINCT pid7 FROM us_labelled LIMIT 20")
        pid7_values = [row[0] for row in cursor.fetchall()]

        # Check engaged values
        cursor.execute("SELECT DISTINCT engaged FROM us_labelled LIMIT 10")
        engaged_values = [row[0] for row in cursor.fetchall()]

        # Check party values if column exists
        party_values = []
        if "party" in us_labelled_columns:
            cursor.execute("SELECT DISTINCT party FROM us_labelled LIMIT 10")
            party_values = [row[0] for row in cursor.fetchall()]

        # Count engaged rows
        cursor.execute("SELECT COUNT(*) FROM us_labelled WHERE engaged = 1")
        engaged_count = cursor.fetchone()[0]

        # Count rows with party not null and engaged = 1
        cursor.execute(
            "SELECT COUNT(*) FROM us_labelled WHERE party IS NOT NULL AND engaged = 1"
        )
        party_engaged_count = cursor.fetchone()[0]

        # Count by party
        cursor.execute(
            "SELECT party, COUNT(*) FROM us_labelled WHERE engaged = 1 GROUP BY party"
        )
        party_counts = {row[0]: row[1] for row in cursor.fetchall()}

        conn.close()
        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "us_labelled_columns": us_labelled_columns,
                    "row_count": row_count,
                    "pid7_values": pid7_values,
                    "engaged_values": engaged_values,
                    "party_values": party_values,
                    "engaged_count": engaged_count,
                    "party_engaged_count": party_engaged_count,
                    "party_counts": party_counts,
                }
            ),
        }

    elif action == "check_waves":
        # Check what waves exist in the international tables
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
            cursorclass=pymysql.cursors.DictCursor,
        )
        cursor = conn.cursor()

        result = {}
        for country in ["BR", "DE", "IL", "IN", "PL"]:
            # Check labelled table
            cursor.execute(
                f"SELECT DISTINCT wave FROM {country}_labelled ORDER BY wave"
            )
            labelled_waves = [r["wave"] for r in cursor.fetchall()]

            # Check unlabelled table
            cursor.execute(
                f"SELECT DISTINCT wave FROM {country}_unlabelled ORDER BY wave"
            )
            unlabelled_waves = [r["wave"] for r in cursor.fetchall()]

            # Count per wave for labelled
            cursor.execute(
                f"SELECT wave, COUNT(*) as cnt FROM {country}_labelled GROUP BY wave ORDER BY wave"
            )
            labelled_counts = {r["wave"]: r["cnt"] for r in cursor.fetchall()}

            result[country] = {
                "labelled_waves": labelled_waves,
                "unlabelled_waves": unlabelled_waves,
                "labelled_counts": labelled_counts,
            }

        # Also check all tables
        cursor.execute("SHOW TABLES")
        all_tables = [r["Tables_in_surveys"] for r in cursor.fetchall()]

        # Look for tables with wave9 or any wave-like data
        tables_with_wave9 = []
        for table in all_tables:
            try:
                cursor.execute(
                    f"SELECT COUNT(*) as cnt FROM `{table}` WHERE wave = 'wave9'"
                )
                cnt = cursor.fetchone()["cnt"]
                if cnt > 0:
                    tables_with_wave9.append({table: cnt})
            except Exception:
                pass

        # Check for recent uploads - look at row counts
        recent_tables = {}
        for table in all_tables:
            try:
                cursor.execute(f"SELECT COUNT(*) as cnt FROM `{table}`")
                recent_tables[table] = cursor.fetchone()["cnt"]
            except Exception:
                pass

        result["tables_with_wave9"] = tables_with_wave9
        result["all_tables"] = all_tables
        result["table_counts"] = recent_tables

        conn.close()
        return {"statusCode": 200, "body": json.dumps(result)}

    elif action == "check_intl_saved":
        # Check what international data was saved to pulse.data
        import dataset
        import urllib.parse
        import os

        password_encoded = urllib.parse.quote(os.environ.get("DB_PASSWORD"))
        db_params = (
            f"mysql+pymysql://{os.environ.get('DB_USER')}:{password_encoded}"
            f"@{os.environ.get('DB_HOST')}:{os.environ.get('DB_PORT', 3306)}/pulse"
        )

        dbx = dataset.connect(db_params)
        row = dbx["data"].find_one(endpoint="citizens/international")
        dbx.engine.dispose()
        dbx.close()

        if row:
            data = row["data"]
            # Summarize what's in the data
            result = {
                "sections": list(data.keys())
                if isinstance(data, dict)
                else "not a dict",
            }
            if "affpol" in data:
                result["affpol_countries"] = list(data["affpol"].keys())
                # Show sample for Brazil
                if "Brazil" in data["affpol"]:
                    result["brazil_affpol"] = data["affpol"]["Brazil"]
            if "violence" in data:
                result["violence_countries"] = list(data["violence"].keys())
            if "norms" in data:
                result["norms_countries"] = list(data["norms"].keys())
        else:
            result = {"error": "No data found for citizens/international"}

        return {"statusCode": 200, "body": json.dumps(result, default=str)}

    elif action == "check_country_questions":
        # Check what data exists for country-specific questions endpoint
        import dataset
        import urllib.parse
        import os

        password_encoded = urllib.parse.quote(os.environ.get("DB_PASSWORD"))
        db_params = (
            f"mysql+pymysql://{os.environ.get('DB_USER')}:{password_encoded}"
            f"@{os.environ.get('DB_HOST')}:{os.environ.get('DB_PORT', 3306)}/pulse"
        )

        dbx = dataset.connect(db_params)

        # List all endpoints related to international
        result = {"endpoints": []}
        for row in dbx["data"].find():
            endpoint = row.get("endpoint", "")
            if "international" in endpoint.lower():
                result["endpoints"].append(endpoint)

        # Check BR questions specifically
        br_row = dbx["data"].find_one(endpoint="citizens/international/br/questions")
        if br_row:
            br_data = br_row["data"]
            result["br_questions"] = {
                "keys": list(br_data.keys())
                if isinstance(br_data, dict)
                else "not dict",
            }
            # Get violence dates as sample
            if "violence" in br_data and "violence1" in br_data["violence"]:
                v1 = br_data["violence"]["violence1"]
                result["br_violence1_dates"] = [list(x.keys())[0] for x in v1]

        dbx.engine.dispose()
        dbx.close()

        return {"statusCode": 200, "body": json.dumps(result, default=str)}

    elif action == "ingest_file":
        # Manually ingest a specific file from S3
        s3_key = event.get("s3_key")
        upload_type = event.get("upload_type", "international")

        if not s3_key:
            return {"statusCode": 400, "body": json.dumps({"error": "s3_key required"})}

        logger.info(f"Manual ingestion of {s3_key} as {upload_type}")

        ingestion = CSVIngestion()
        rows_inserted, metadata = ingestion.ingest(S3_BUCKET, s3_key, upload_type)
        ingestion.close()

        return {
            "statusCode": 200,
            "body": json.dumps(
                {"message": f"Ingested {rows_inserted} rows", "metadata": metadata},
                default=str,
            ),
        }

    elif action == "check_us_dates":
        # Check latest dates in US data
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
        )
        cursor = conn.cursor()

        # Get distinct weeks
        cursor.execute(
            "SELECT DISTINCT week FROM us_labelled ORDER BY week DESC LIMIT 20"
        )
        weeks = [row[0] for row in cursor.fetchall()]

        # Get distinct years
        cursor.execute(
            "SELECT DISTINCT year FROM us_labelled ORDER BY year DESC LIMIT 10"
        )
        years = [row[0] for row in cursor.fetchall()]

        # Get row count per week (last 10)
        cursor.execute("""
            SELECT week, COUNT(*) as cnt
            FROM us_labelled
            GROUP BY week
            ORDER BY week DESC
            LIMIT 15
        """)
        week_counts = {row[0]: row[1] for row in cursor.fetchall()}

        conn.close()
        return {
            "statusCode": 200,
            "body": json.dumps(
                {"latest_weeks": weeks, "years": years, "week_counts": week_counts}
            ),
        }

    elif action == "check_policy_columns":
        # Check policy columns in latest weeks
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
            cursorclass=pymysql.cursors.DictCursor,
        )
        cursor = conn.cursor()

        # Check CPA1 column values and survey number for latest weeks
        # Check 2025 weeks with CPA1 data
        cursor.execute("""
            SELECT year, week,
                   COUNT(*) as total,
                   MIN(survey) as min_survey,
                   MAX(survey) as max_survey,
                   SUM(CASE WHEN CPA1 IS NOT NULL THEN 1 ELSE 0 END) as cpa1_count
            FROM us_labelled
            WHERE year = 2025 AND survey >= 124
            GROUP BY year, week
            ORDER BY week DESC
            LIMIT 10
        """)
        week_policy_data = list(cursor.fetchall())

        conn.close()
        return {
            "statusCode": 200,
            "body": json.dumps({"week_policy_data": week_policy_data}, default=str),
        }

    elif action == "fix_us_dates":
        # Fix missing year/week values in us_labelled by calculating from endtime
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
        )
        cursor = conn.cursor()

        # First check how many rows have NULL week
        cursor.execute("SELECT COUNT(*) FROM us_labelled WHERE week IS NULL")
        null_week_count = cursor.fetchone()[0]
        logger.info(f"Found {null_week_count} rows with NULL week")

        if null_week_count == 0:
            conn.close()
            return {
                "statusCode": 200,
                "body": json.dumps(
                    {"message": "No rows with NULL week found", "null_week_count": 0}
                ),
            }

        # Update year from endtime where NULL
        cursor.execute("""
            UPDATE us_labelled
            SET year = YEAR(STR_TO_DATE(endtime, '%Y-%m-%d %H:%i:%s'))
            WHERE year IS NULL AND endtime IS NOT NULL
        """)
        year_updated = cursor.rowcount
        logger.info(f"Updated {year_updated} rows with year")

        # Update week from endtime where NULL
        # Use WEEK(date, 1) which matches Python's %W format (Monday as first day, week 1 starts with first Monday)
        cursor.execute("""
            UPDATE us_labelled
            SET week = WEEK(STR_TO_DATE(endtime, '%Y-%m-%d %H:%i:%s'), 1)
            WHERE week IS NULL AND endtime IS NOT NULL
        """)
        week_updated = cursor.rowcount
        logger.info(f"Updated {week_updated} rows with week")

        conn.commit()

        # Verify the fix
        cursor.execute("SELECT COUNT(*) FROM us_labelled WHERE week IS NULL")
        remaining_null = cursor.fetchone()[0]

        # Check the new date range
        cursor.execute("SELECT MAX(year) as max_year FROM us_labelled")
        max_year = cursor.fetchone()[0]

        cursor.execute(
            "SELECT MAX(week) as max_week FROM us_labelled WHERE year = %s", (max_year,)
        )
        max_week = cursor.fetchone()[0]

        conn.close()

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Fixed missing dates",
                    "original_null_week_count": null_week_count,
                    "year_rows_updated": year_updated,
                    "week_rows_updated": week_updated,
                    "remaining_null_week": remaining_null,
                    "new_max_year": max_year,
                    "new_max_week": max_week,
                }
            ),
        }

    elif action == "fix_us_weeks_2026":
        # Fix week values for 2026 data to match Python's %W format
        # The data was stored with ISO weeks but processor uses %W format
        # For January 2026, ISO weeks are 1 higher than %W weeks:
        # - ISO week 4 (Jan 20-25) -> %W week 3
        # - ISO week 5 (Jan 26-27) -> %W week 4
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
        )
        cursor = conn.cursor()

        # Check current state
        cursor.execute(
            "SELECT week, COUNT(*) FROM us_labelled WHERE year = 2026 GROUP BY week"
        )
        before_counts = {str(row[0]): row[1] for row in cursor.fetchall()}
        logger.info(f"Before fix - 2026 week counts: {before_counts}")

        # Check the column type
        cursor.execute(
            "SELECT DATA_TYPE FROM information_schema.columns WHERE table_name = 'us_labelled' AND column_name = 'week'"
        )
        week_type_row = cursor.fetchone()
        week_type = week_type_row[0] if week_type_row else "unknown"
        logger.info(f"Week column type: {week_type}")

        # Subtract 1 from week values for 2026 data to convert from ISO to %W format
        # Use CAST to handle both string and numeric week columns
        cursor.execute("""
            UPDATE us_labelled
            SET week = CAST(week AS SIGNED) - 1
            WHERE year = 2026 AND CAST(week AS SIGNED) > 0
        """)
        rows_updated = cursor.rowcount
        logger.info(f"Updated {rows_updated} rows (week -= 1)")

        conn.commit()

        # Check after state
        cursor.execute(
            "SELECT week, COUNT(*) FROM us_labelled WHERE year = 2026 GROUP BY week"
        )
        after_counts = {str(row[0]): row[1] for row in cursor.fetchall()}
        logger.info(f"After fix - 2026 week counts: {after_counts}")

        conn.close()

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Fixed 2026 week values (ISO -> %W format)",
                    "rows_updated": rows_updated,
                    "week_column_type": week_type,
                    "before_week_counts": before_counts,
                    "after_week_counts": after_counts,
                }
            ),
        }

    elif action == "fix_2026_single_week":
        # Set all 2026 data to week 3 (single data point for the wave)
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
        )
        cursor = conn.cursor()

        # Check current state
        cursor.execute(
            "SELECT week, COUNT(*) FROM us_labelled WHERE year = 2026 GROUP BY week"
        )
        before_counts = {str(row[0]): row[1] for row in cursor.fetchall()}

        # Update all 2026 rows to week 3
        cursor.execute("""
            UPDATE us_labelled
            SET week = 3
            WHERE year = 2026
        """)
        rows_updated = cursor.rowcount
        conn.commit()

        # Check after state
        cursor.execute(
            "SELECT week, COUNT(*) FROM us_labelled WHERE year = 2026 GROUP BY week"
        )
        after_counts = {str(row[0]): row[1] for row in cursor.fetchall()}

        conn.close()

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Set all 2026 data to week 3",
                    "rows_updated": rows_updated,
                    "before_week_counts": before_counts,
                    "after_week_counts": after_counts,
                }
            ),
        }

    elif action == "fix_2026_engaged":
        # Fix the engaged column for 2026 data (set to 1)
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
        )
        cursor = conn.cursor()

        # Update engaged to 1 for 2026 rows where it's NULL
        cursor.execute("""
            UPDATE us_labelled
            SET engaged = 1
            WHERE year = 2026 AND engaged IS NULL
        """)
        rows_updated = cursor.rowcount
        logger.info(f"Updated {rows_updated} rows: set engaged=1 for 2026 data")

        conn.commit()

        # Verify
        cursor.execute(
            "SELECT engaged, COUNT(*) FROM us_labelled WHERE year = 2026 GROUP BY engaged"
        )
        after_counts = {str(row[0]): row[1] for row in cursor.fetchall()}

        conn.close()

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Fixed engaged column for 2026 data",
                    "rows_updated": rows_updated,
                    "after_engaged_counts": after_counts,
                }
            ),
        }

    elif action == "check_2026_data":
        # Check 2026 data quality
        import pymysql
        import os

        conn = pymysql.connect(
            host=os.environ.get("DB_HOST"),
            user=os.environ.get("DB_USER"),
            password=os.environ.get("DB_PASSWORD"),
            database="surveys",
            port=int(os.environ.get("DB_PORT", 3306)),
        )
        cursor = conn.cursor()

        # Check engaged values for 2026
        cursor.execute("""
            SELECT engaged, COUNT(*)
            FROM us_labelled
            WHERE year = 2026
            GROUP BY engaged
        """)
        engaged_counts = {str(row[0]): row[1] for row in cursor.fetchall()}

        # Check party values for 2026
        cursor.execute("""
            SELECT party, COUNT(*)
            FROM us_labelled
            WHERE year = 2026
            GROUP BY party
        """)
        party_counts = {str(row[0]): row[1] for row in cursor.fetchall()}

        # Check if thermometer values exist for 2026
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN democrat_therm_1 IS NOT NULL THEN 1 ELSE 0 END) as dem_therm,
                SUM(CASE WHEN republican_therm_1 IS NOT NULL THEN 1 ELSE 0 END) as rep_therm,
                SUM(CASE WHEN weight IS NOT NULL THEN 1 ELSE 0 END) as weight_present
            FROM us_labelled
            WHERE year = 2026
        """)
        row = cursor.fetchone()
        therm_info = {
            "total": row[0],
            "dem_therm_present": row[1],
            "rep_therm_present": row[2],
            "weight_present": row[3],
        }

        conn.close()

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "engaged_counts": engaged_counts,
                    "party_counts": party_counts,
                    "therm_info": therm_info,
                },
                default=str,
            ),
        }

    else:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": f"Unknown action: {action}"}),
        }
