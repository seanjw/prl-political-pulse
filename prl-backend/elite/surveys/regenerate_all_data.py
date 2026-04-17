"""Regenerate all-data.zip from surveys.us_labelled and upload to S3.

Callable as a function so it can be chained into the survey-upload pipeline.
"""

import os
import tempfile
import zipfile
from io import BytesIO

import boto3
import pandas as pd
import pymysql

from shared.config import get_secrets

S3_BUCKET = os.environ["S3_BUCKET"]
S3_KEY = "data/all-data.zip"
CSV_FILENAME = "all-data.csv"

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


def regenerate_all_data_zip():
    """Export us_labelled, create all-data.zip, and upload to S3.

    Returns:
        dict with rows_exported, columns, zip_size.
    """
    secrets = get_secrets("prl/database")
    conn = pymysql.connect(
        host=secrets["DB_HOST"],
        port=int(secrets["DB_PORT"]),
        user=secrets["DB_USER"],
        password=secrets["DB_PASSWORD"],
        database="surveys",
        connect_timeout=30,
    )

    try:
        print("Querying surveys.us_labelled...")
        df = pd.read_sql("SELECT * FROM us_labelled", conn)
        row_count = len(df)
        original_col_count = len(df.columns)
        print(f"  Exported {row_count} rows, {original_col_count} columns")

        # Drop excluded columns
        prefix_cols = [
            col for col in df.columns if any(col.startswith(p) for p in DROP_PREFIXES)
        ]
        all_drop = [col for col in COLUMNS_TO_DROP + prefix_cols if col in df.columns]
        df = df.drop(columns=all_drop)
        col_count = len(df.columns)
        print(
            f"  Dropped {original_col_count - col_count} columns "
            f"({original_col_count} -> {col_count})"
        )
    finally:
        conn.close()

    # Write CSV to buffer and create ZIP
    csv_buffer = BytesIO()
    df.to_csv(csv_buffer, index=False, encoding="utf-8")
    csv_data = csv_buffer.getvalue()

    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp_path = tmp.name
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(CSV_FILENAME, csv_data)

    zip_size = os.path.getsize(tmp_path)
    print(f"  Created ZIP: {zip_size / (1024 * 1024):.1f} MB")

    # Upload to S3
    print(f"  Uploading to s3://{S3_BUCKET}/{S3_KEY}...")
    s3 = boto3.client("s3")
    s3.upload_file(
        tmp_path,
        S3_BUCKET,
        S3_KEY,
        ExtraArgs={"ContentType": "application/zip"},
    )
    print("  Upload complete!")
    os.unlink(tmp_path)

    return {
        "rows_exported": row_count,
        "columns": col_count,
        "zip_size": zip_size,
    }
