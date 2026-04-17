#!/usr/bin/env python3
"""
Regenerate all-data.zip from the surveys.us_labelled table.

This script exports the us_labelled table from the surveys database,
creates a CSV, and zips it into all-data.zip for public download.

Usage:
    python regenerate_all_data_zip.py
    python regenerate_all_data_zip.py --dry-run   # Preview columns and row count only
    python regenerate_all_data_zip.py --upload     # Also upload to S3
"""

import argparse
import os
import sys
import zipfile
from io import BytesIO

import pandas as pd
import pymysql

# Add project root to path so we can import shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.config import get_secrets


def _get_db_config(database="surveys"):
    """Build DB config dict from Secrets Manager."""
    secrets = get_secrets("prl/database")
    return {
        "host": secrets["DB_HOST"],
        "user": secrets["DB_USER"],
        "password": secrets["DB_PASSWORD"],
        "port": int(secrets["DB_PORT"]),
        "database": database,
    }


# Output paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "..", "public", "data")
OUTPUT_ZIP = os.path.join(OUTPUT_DIR, "all-data.zip")
CSV_FILENAME = "all-data.csv"

# S3 config
S3_BUCKET = os.environ["S3_BUCKET"]
S3_KEY = "data/all-data.zip"


def get_column_info(conn):
    """Get column names and types from us_labelled table."""
    cursor = conn.cursor(pymysql.cursors.DictCursor)
    cursor.execute("DESCRIBE us_labelled")
    columns = cursor.fetchall()
    cursor.close()
    return columns


# Columns to exclude from public download (PII, internal, sensitive)
COLUMNS_TO_DROP = [
    "inputzip",
    "inputzipdma_recode",
    "ranked_choice_voting_aware",
    "ranked_choice_voting_support",
    "proportional_representation_aware",
    "proportional_representation_support",
    "fusion_voting_aware",
    "fusion_voting_support",
    "open_primaries_aware",
    "open_primaries_support",
    "title",
    "firstname",
    "lastname",
    "event",
    "location",
    "outcome",
    "engagement_measure_profession",
    "engagement_measure_fullname",
    "engagement_measure_event",
    "engagement_measure_location",
    "resignation_2024_1",
    "resignation_2024_2",
    "w124_module_selection_1",
    "w124_module_selection_2",
    "w124_module_selection_3",
    "w124_module_selection_4",
    "w124_tarrifs2_treat",
    "jewish_murder",
    "Trump_approval",
    "Democrats_approval",
    "student_loans",
    "college_grad",
    "college_major",
    "college_regret_yes",
    "college_regret_no",
    # Higher education module (DART0059)
    "DART0059_Wave8_revseed",
    "DART0059_Wave9_revseed",
    "worth_it",
    "transparency",
    "transparency_major",
    "inst_neutrality",
    "prof_views",
    "prof_ideology",
    "faculty_ratio",
    "bias_grading",
    "why_imbalance_1",
    "why_imbalance_2",
    "why_imbalance_3",
    "why_imbalance_4",
    "imbalance_fix",
    "hire_diversity",
    "faculty_survey",
    "eval_bias_1",
    "eval_bias_2",
    "eval_bias_3",
    "eval_bias_4",
    "anonymous_report",
    "funding_neutrality",
    "ideal_a_pct",
    "test_required",
    "final_school_grid_order",
    "school_text_string",
    "has_loans",
    "has_child",
]
DROP_PREFIXES = ["QFire", "FIRE_", "AI", "CPA", "school_favorability_"]


def export_data(conn):
    """Export all data from us_labelled table, excluding restricted columns."""
    print("Querying us_labelled table...")
    query = "SELECT * FROM us_labelled"
    df = pd.read_sql(query, conn)
    original_col_count = len(df.columns)
    print(f"  Exported {len(df)} rows, {original_col_count} columns")

    # Drop excluded columns
    prefix_cols = [
        col for col in df.columns if any(col.startswith(p) for p in DROP_PREFIXES)
    ]
    all_drop = [col for col in COLUMNS_TO_DROP + prefix_cols if col in df.columns]
    df = df.drop(columns=all_drop)
    print(
        f"  Dropped {original_col_count - len(df.columns)} columns "
        f"({original_col_count} -> {len(df.columns)})"
    )

    return df


def create_zip(df, output_path):
    """Create a ZIP file containing the CSV data."""
    print(f"Creating ZIP at {output_path}...")

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Write CSV to buffer
    csv_buffer = BytesIO()
    df.to_csv(csv_buffer, index=False, encoding="utf-8")
    csv_data = csv_buffer.getvalue()

    # Create ZIP
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(CSV_FILENAME, csv_data)

    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"  Created {output_path} ({file_size_mb:.1f} MB)")
    return output_path


def upload_to_s3(zip_path):
    """Upload the ZIP file to S3."""
    import boto3

    print(f"Uploading to s3://{S3_BUCKET}/{S3_KEY}...")
    s3 = boto3.client("s3")
    s3.upload_file(
        zip_path, S3_BUCKET, S3_KEY, ExtraArgs={"ContentType": "application/zip"}
    )
    print("  Upload complete!")


def main():
    parser = argparse.ArgumentParser(
        description="Regenerate all-data.zip from database"
    )
    parser.add_argument(
        "--dry-run",
        "-n",
        action="store_true",
        help="Preview columns and row count only",
    )
    parser.add_argument(
        "--upload", "-u", action="store_true", help="Upload to S3 after generating"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Regenerate all-data.zip")
    print("=" * 60)

    # Connect to database
    db_config = _get_db_config()
    print(f"\nConnecting to {db_config['host']}...")
    conn = pymysql.connect(**db_config)

    try:
        # Show column info
        columns = get_column_info(conn)
        print(f"\nus_labelled table has {len(columns)} columns:")

        # Highlight geographic columns
        geo_cols = [
            "inputstate",
            "inputzip",
            "county_fips",
            "statecd_zip",
            "inputzipdma_recode",
        ]
        for col in columns:
            name = col["Field"]
            marker = " <-- GEOGRAPHIC/CD" if name in geo_cols else ""
            if args.dry_run:
                print(f"  {name} ({col['Type']}){marker}")

        # Check statecd_zip specifically
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute(
            "SELECT COUNT(*) as cnt FROM us_labelled WHERE statecd_zip IS NOT NULL AND statecd_zip != ''"
        )
        result = cursor.fetchone()
        non_null_count = result["cnt"]

        cursor.execute("SELECT COUNT(*) as cnt FROM us_labelled")
        total = cursor.fetchone()["cnt"]

        cursor.execute(
            "SELECT DISTINCT statecd_zip FROM us_labelled WHERE statecd_zip IS NOT NULL AND statecd_zip != '' LIMIT 10"
        )
        samples = [row["statecd_zip"] for row in cursor.fetchall()]
        cursor.close()

        print(f"\nstatecd_zip column: {non_null_count}/{total} rows have values")
        print(f"  Sample values: {samples}")

        if args.dry_run:
            print("\n[DRY RUN] Would export all data and create ZIP.")
            return

        # Export data
        print()
        df = export_data(conn)

        # Verify statecd_zip is present
        if "statecd_zip" in df.columns:
            non_null = df["statecd_zip"].notna().sum()
            print(f"  statecd_zip column present: {non_null} non-null values")
        else:
            print("  WARNING: statecd_zip column not found!")

        # Create ZIP
        create_zip(df, OUTPUT_ZIP)

        # Upload if requested
        if args.upload:
            upload_to_s3(OUTPUT_ZIP)

    finally:
        conn.close()

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == "__main__":
    main()
