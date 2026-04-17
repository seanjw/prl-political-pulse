#!/usr/bin/env python3
"""
Process a single international survey wave ZIP file.
Extracts country CSVs, adds wave column, and merges with existing data in S3.

Usage:
    python process_international_wave.py /path/to/DART0055_W9.zip
    python process_international_wave.py /path/to/DART0055_W9.zip --wave 9
    python process_international_wave.py /path/to/DART0055_W9.zip --dry-run
"""

import os
import sys
import argparse
import re
import zipfile
import boto3
import pandas as pd
from io import StringIO

# Configuration
S3_BUCKET = os.environ["S3_BUCKET"]
S3_DATA_PREFIX = "data/international"

# Country codes we expect in the ZIP
COUNTRY_CODES = ["BR", "DE", "IL", "IN", "PL"]


def extract_wave_number(filename: str) -> int:
    """Extract wave number from filename like DART0055_W9.zip or DART0055_Wave_9.zip"""
    match = re.search(r"_W(\d+)\.zip$", filename, re.IGNORECASE)
    if match:
        return int(match.group(1))
    match = re.search(r"_Wave_(\d+)\.zip$", filename, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def find_csv_in_zip(zf: zipfile.ZipFile, country_code: str) -> str:
    """Find the strings CSV file for a country in the ZIP."""
    for name in zf.namelist():
        # Look for pattern like Data Files/BR/DART0055_BR_W9_OUTPUT_strings.csv
        if country_code in name and name.endswith("_strings.csv") and "OUTPUT" in name:
            return name
    return None


def download_existing_data(s3_client, country_code: str) -> pd.DataFrame:
    """Download existing all-waves data from S3 (CSV or ZIP format)."""
    csv_key = f"{S3_DATA_PREFIX}/{country_code}-all.csv"
    zip_key = f"{S3_DATA_PREFIX}/{country_code}-all.zip"

    # Try CSV first (newer format)
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=csv_key)
        csv_content = response["Body"].read().decode("utf-8")
        df = pd.read_csv(StringIO(csv_content), low_memory=False)
        print(f"  Downloaded existing CSV: {len(df)} rows")
        return df
    except Exception:
        pass

    # Fall back to ZIP format (historical data)
    try:
        from io import BytesIO

        response = s3_client.get_object(Bucket=S3_BUCKET, Key=zip_key)
        zip_content = response["Body"].read()

        with zipfile.ZipFile(BytesIO(zip_content)) as zf:
            csv_name = f"{country_code}-all.csv"
            with zf.open(csv_name) as f:
                df = pd.read_csv(f, low_memory=False)
        print(f"  Downloaded existing ZIP: {len(df)} rows")
        return df
    except Exception:
        pass

    print("  No existing data found, will create new")
    return None


def upload_merged_data(
    s3_client, country_code: str, df: pd.DataFrame, dry_run: bool = False
):
    """Upload merged CSV to S3."""
    key = f"{S3_DATA_PREFIX}/{country_code}-all.csv"

    csv_buffer = StringIO()
    df.to_csv(csv_buffer, index=False)
    csv_content = csv_buffer.getvalue()

    if dry_run:
        print(f"  [DRY RUN] Would upload {len(df)} rows to s3://{S3_BUCKET}/{key}")
        return

    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=csv_content.encode("utf-8"),
        ContentType="text/csv",
    )
    print(f"  Uploaded {len(df)} rows to s3://{S3_BUCKET}/{key}")


def upload_wave_zip(s3_client, zip_path: str, wave_num: int, dry_run: bool = False):
    """Upload the original wave ZIP to S3 for archival."""
    filename = os.path.basename(zip_path)
    key = f"{S3_DATA_PREFIX}/waves/{filename}"

    if dry_run:
        print(f"[DRY RUN] Would upload ZIP to s3://{S3_BUCKET}/{key}")
        return

    with open(zip_path, "rb") as f:
        s3_client.put_object(
            Bucket=S3_BUCKET, Key=key, Body=f, ContentType="application/zip"
        )
    print(f"Uploaded ZIP to s3://{S3_BUCKET}/{key}")


def process_wave_zip(zip_path: str, wave_num: int = None, dry_run: bool = False):
    """Process a wave ZIP file and merge with existing S3 data."""

    if not os.path.exists(zip_path):
        print(f"ERROR: File not found: {zip_path}")
        return False

    # Extract wave number from filename if not provided
    if wave_num is None:
        wave_num = extract_wave_number(os.path.basename(zip_path))
        if wave_num is None:
            print("ERROR: Could not determine wave number from filename. Use --wave N")
            return False

    wave_label = f"wave{wave_num}"
    print(f"\n{'=' * 60}")
    print(f"Processing International Survey Wave {wave_num}")
    print(f"{'=' * 60}")
    print(f"ZIP file: {zip_path}")
    print(f"Wave label: {wave_label}")
    if dry_run:
        print("MODE: DRY RUN (no changes will be made)")
    print()

    s3_client = boto3.client("s3")

    # First, upload the original ZIP for archival
    upload_wave_zip(s3_client, zip_path, wave_num, dry_run)

    with zipfile.ZipFile(zip_path, "r") as zf:
        print(f"ZIP contents: {len(zf.namelist())} files")

        for country_code in COUNTRY_CODES:
            print(f"\n--- Processing {country_code} ---")

            # Find the CSV file for this country
            csv_name = find_csv_in_zip(zf, country_code)
            if csv_name is None:
                print(f"  WARNING: No CSV found for {country_code}")
                continue

            print(f"  Found: {csv_name}")

            # Read the CSV from the ZIP
            with zf.open(csv_name) as csv_file:
                new_df = pd.read_csv(csv_file, low_memory=False)
            print(f"  New wave data: {len(new_df)} rows")

            # Add wave column
            new_df["wave"] = wave_label

            # Download existing data from S3
            existing_df = download_existing_data(s3_client, country_code)

            if existing_df is not None:
                # Check if this wave already exists
                if "wave" in existing_df.columns:
                    existing_waves = existing_df["wave"].unique()
                    print(f"  Existing waves: {sorted(existing_waves)}")

                    if wave_label in existing_waves:
                        # Remove old wave data and replace with new
                        print(f"  Replacing existing {wave_label} data")
                        existing_df = existing_df[existing_df["wave"] != wave_label]

                # Merge with existing data
                merged_df = pd.concat([existing_df, new_df], ignore_index=True)
                print(f"  Merged total: {len(merged_df)} rows")
            else:
                merged_df = new_df

            # Upload merged data back to S3
            upload_merged_data(s3_client, country_code, merged_df, dry_run)

    print(f"\n{'=' * 60}")
    print("Wave processing complete!")
    print()
    print("Next steps:")
    print("  1. Run generate_international_questions_data.py to update the database")
    print("     cd prl-frontend/scripts")
    print("     python generate_international_questions_data.py")
    print(f"{'=' * 60}")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Process international survey wave ZIP file"
    )
    parser.add_argument(
        "zip_file", help="Path to the wave ZIP file (e.g., DART0055_W9.zip)"
    )
    parser.add_argument(
        "--wave",
        "-w",
        type=int,
        help="Wave number (extracted from filename if not provided)",
    )
    parser.add_argument(
        "--dry-run",
        "-n",
        action="store_true",
        help="Show what would be done without making changes",
    )

    args = parser.parse_args()

    success = process_wave_zip(args.zip_file, args.wave, args.dry_run)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
