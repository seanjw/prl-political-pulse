"""
Download stats aggregator Lambda.

Queries the Athena table over CloudFront logs, aggregates download activity
for the last 90 days, and writes the summary as JSON to S3. The admin
dashboard reads the JSON via the monitoring Lambda's /downloads/stats route.

Triggered weekly via EventBridge; can also be invoked on-demand.
"""

import json
import logging
import os
import time
from datetime import datetime, timezone

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ATHENA_WORKGROUP = os.environ["ATHENA_WORKGROUP"]
ATHENA_DATABASE = os.environ["ATHENA_DATABASE"]
ATHENA_TABLE = os.environ["ATHENA_TABLE"]
OUTPUT_BUCKET = os.environ["OUTPUT_BUCKET"]
OUTPUT_KEY = os.environ["OUTPUT_KEY"]

athena = boto3.client("athena")
s3 = boto3.client("s3")


# Files we care about tracking — everything under these prefixes on the
# CloudFront origin is a downloadable asset. Excludes HTML/JS/CSS app assets.
DOWNLOADABLE_URI_FILTER = (
    "(uri LIKE '/data/%' OR uri LIKE '/toplines/%' OR uri LIKE '/files/%')"
)

# Bot filter — matches common crawlers so they're excluded from "real" downloads.
BOT_FILTER = (
    "LOWER(user_agent) NOT LIKE '%bot%' "
    "AND LOWER(user_agent) NOT LIKE '%crawl%' "
    "AND LOWER(user_agent) NOT LIKE '%spider%' "
    "AND LOWER(user_agent) NOT LIKE '%scrape%' "
    "AND LOWER(user_agent) NOT LIKE '%wget%' "
    "AND LOWER(user_agent) NOT LIKE '%curl%' "
    "AND LOWER(user_agent) NOT LIKE '%python-requests%'"
)

# Only count real downloads (200 OK or 206 Partial Content for range requests).
STATUS_FILTER = "status IN (200, 206)"

# 90-day window via log_date column (type=date from CloudFront standard logs).
DATE_FILTER = "log_date >= current_date - interval '90' day"

BASE_WHERE = (
    f"{DATE_FILTER} AND {DOWNLOADABLE_URI_FILTER} AND {STATUS_FILTER} AND {BOT_FILTER}"
)


def _run_query(sql: str) -> list[dict]:
    """Execute an Athena query and return result rows as list of dicts."""
    logger.info("Running Athena query: %s", sql.replace("\n", " ")[:300])
    execution = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": ATHENA_DATABASE},
        WorkGroup=ATHENA_WORKGROUP,
    )
    query_id = execution["QueryExecutionId"]

    # Poll for completion
    while True:
        status = athena.get_query_execution(QueryExecutionId=query_id)
        state = status["QueryExecution"]["Status"]["State"]
        if state in ("SUCCEEDED", "FAILED", "CANCELLED"):
            break
        time.sleep(1)

    if state != "SUCCEEDED":
        reason = status["QueryExecution"]["Status"].get("StateChangeReason", "unknown")
        raise RuntimeError(f"Athena query {state}: {reason}")

    # Collect all pages of results
    rows: list[dict] = []
    paginator = athena.get_paginator("get_query_results")
    columns: list[str] = []
    for page in paginator.paginate(QueryExecutionId=query_id):
        result_set = page["ResultSet"]
        if not columns:
            columns = [c["Name"] for c in result_set["ResultSetMetadata"]["ColumnInfo"]]
            # Skip the header row from the first page only
            data_rows = result_set["Rows"][1:]
        else:
            data_rows = result_set["Rows"]
        for row in data_rows:
            values = [col.get("VarCharValue", "") for col in row["Data"]]
            rows.append(dict(zip(columns, values)))

    return rows


def _totals() -> dict:
    sql = f"""
        SELECT
            COUNT(*) AS total_downloads,
            COUNT(DISTINCT request_ip) AS unique_ips,
            COALESCE(SUM(bytes), 0) AS total_bytes
        FROM {ATHENA_TABLE}
        WHERE {BASE_WHERE}
    """
    rows = _run_query(sql)
    if not rows:
        return {"total_downloads": 0, "unique_ips": 0, "total_bytes": 0}
    r = rows[0]
    return {
        "total_downloads": int(r.get("total_downloads") or 0),
        "unique_ips": int(r.get("unique_ips") or 0),
        "total_bytes": int(r.get("total_bytes") or 0),
    }


def _by_file() -> list[dict]:
    sql = f"""
        SELECT uri, COUNT(*) AS downloads, COALESCE(SUM(bytes), 0) AS bytes
        FROM {ATHENA_TABLE}
        WHERE {BASE_WHERE}
        GROUP BY uri
        ORDER BY downloads DESC
        LIMIT 20
    """
    rows = _run_query(sql)
    return [
        {
            "uri": r["uri"],
            "downloads": int(r["downloads"]),
            "bytes": int(r["bytes"]),
        }
        for r in rows
    ]


def _by_month() -> list[dict]:
    # Use the log_date column; group by first day of month
    sql = f"""
        SELECT
            date_format(log_date, '%Y-%m') AS month,
            COUNT(*) AS downloads
        FROM {ATHENA_TABLE}
        WHERE {BASE_WHERE.replace("interval '90' day", "interval '12' month")}
        GROUP BY date_format(log_date, '%Y-%m')
        ORDER BY month
    """
    rows = _run_query(sql)
    return [{"month": r["month"], "downloads": int(r["downloads"])} for r in rows]


def _by_referrer() -> list[dict]:
    sql = f"""
        SELECT referrer, COUNT(*) AS downloads
        FROM {ATHENA_TABLE}
        WHERE {BASE_WHERE}
          AND referrer <> '-'
          AND referrer NOT LIKE '%americaspoliticalpulse.com%'
        GROUP BY referrer
        ORDER BY downloads DESC
        LIMIT 15
    """
    rows = _run_query(sql)
    return [{"referrer": r["referrer"], "downloads": int(r["downloads"])} for r in rows]


def _by_country() -> list[dict]:
    """
    CloudFront standard logs do NOT include viewer country out of the box;
    that's a real-time logs feature. We approximate by the first three
    octets of the request IP (rough geographic cluster) — in practice, this
    is not useful. Instead, return an empty list and document that country
    data requires enabling CloudFront real-time logs in future.
    """
    return []


def lambda_handler(event, context):
    logger.info("Starting download stats aggregation")

    try:
        totals = _totals()
        by_file = _by_file()
        by_month = _by_month()
        by_referrer = _by_referrer()
        by_country = _by_country()
    except Exception as e:
        logger.exception("Athena query failed")
        return {"ok": False, "error": str(e)}

    summary = {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "window_days": 90,
        "totals": totals,
        "by_file": by_file,
        "by_month": by_month,
        "by_referrer": by_referrer,
        "by_country": by_country,
    }

    s3.put_object(
        Bucket=OUTPUT_BUCKET,
        Key=OUTPUT_KEY,
        Body=json.dumps(summary, indent=2).encode("utf-8"),
        ContentType="application/json",
        CacheControl="no-cache",
    )

    logger.info(
        "Wrote download stats to s3://%s/%s (totals=%s)",
        OUTPUT_BUCKET,
        OUTPUT_KEY,
        totals,
    )
    return {"ok": True, "summary": summary}
