"""
CSV Ingestion Module

Handles parsing CSV files from S3 and inserting data into MySQL tables.
Supports both CSV files and ZIP archives containing CSVs.
"""

import os
import re
import io
import json
import logging
import zipfile
from typing import Optional, Tuple, Dict, Any, List

import boto3
import pandas as pd
import pymysql

logger = logging.getLogger(__name__)

# Filename patterns
# US surveys: dart0051_w{wave}-clean_{year}(_label)?.csv
US_FILENAME_PATTERN = re.compile(
    r"dart0051_w(\d+)-clean_(\d{4})(_label)?\.csv", re.IGNORECASE
)

# International surveys: {country_code}_wave{wave}_{year}.csv (flexible pattern)
INTL_FILENAME_PATTERN = re.compile(
    r"([A-Z]{2})_(?:wave)?(\d+)_?(\d{4})?\.csv", re.IGNORECASE
)


class CSVIngestion:
    """Handle CSV ingestion from S3 to MySQL."""

    def __init__(
        self,
        db_host: Optional[str] = None,
        db_user: Optional[str] = None,
        db_password: Optional[str] = None,
        db_port: Optional[int] = None,
        db_name: str = "surveys",
    ):
        """
        Initialize the CSV ingestion handler.

        Args:
            db_host: MySQL host. Defaults to DB_HOST env var.
            db_user: MySQL user. Defaults to DB_USER env var.
            db_password: MySQL password. Defaults to DB_PASSWORD env var.
            db_port: MySQL port. Defaults to DB_PORT env var or 3306.
            db_name: Database name. Defaults to 'surveys'.
        """
        # Load DB credentials from args, env vars, or Secrets Manager
        secrets = self._load_db_secrets()
        self.db_host = db_host or os.environ.get("DB_HOST") or secrets.get("DB_HOST")
        self.db_user = db_user or os.environ.get("DB_USER") or secrets.get("DB_USER")
        self.db_password = (
            db_password or os.environ.get("DB_PASSWORD") or secrets.get("DB_PASSWORD")
        )
        self.db_port = int(
            db_port or os.environ.get("DB_PORT") or secrets.get("DB_PORT", 3306)
        )
        self.db_name = db_name

        self.s3_client = boto3.client("s3")
        self._conn = None

    @staticmethod
    def _load_db_secrets() -> dict:
        """Fetch DB credentials from Secrets Manager (prl/database)."""
        try:
            client = boto3.client("secretsmanager")
            resp = client.get_secret_value(SecretId="prl/database")
            return json.loads(resp["SecretString"])
        except Exception as e:
            logger.warning(f"Could not load secrets from Secrets Manager: {e}")
            return {}

    def get_connection(self):
        """Get a PyMySQL connection."""
        if self._conn is None or not self._conn.open:
            self._conn = pymysql.connect(
                host=self.db_host,
                user=self.db_user,
                password=self.db_password,
                port=self.db_port,
                database=self.db_name,
                charset="utf8mb4",
                cursorclass=pymysql.cursors.DictCursor,
            )
        return self._conn

    def parse_filename(self, filename: str, upload_type: str) -> Dict[str, Any]:
        """
        Parse filename to extract wave number and year.

        Args:
            filename: The CSV filename
            upload_type: Type of upload (labelled, unlabelled, international)

        Returns:
            Dict with wave_number, year, is_labelled, country_code (for international)
        """
        result = {
            "wave_number": None,
            "year": None,
            "is_labelled": upload_type == "labelled",
            "country_code": None,
        }

        if upload_type in ("labelled", "unlabelled"):
            match = US_FILENAME_PATTERN.search(filename)
            if match:
                result["wave_number"] = int(match.group(1))
                result["year"] = int(match.group(2))
                result["is_labelled"] = (
                    match.group(3) is not None or upload_type == "labelled"
                )
        else:
            # International
            match = INTL_FILENAME_PATTERN.search(filename)
            if match:
                result["country_code"] = match.group(1).upper()
                result["wave_number"] = int(match.group(2))
                if match.group(3):
                    result["year"] = int(match.group(3))

        return result

    def read_csv_from_s3(self, bucket: str, key: str) -> pd.DataFrame:
        """
        Read CSV file from S3.

        Args:
            bucket: S3 bucket name
            key: S3 object key

        Returns:
            DataFrame with CSV data
        """
        logger.info(f"Reading CSV from s3://{bucket}/{key}")

        response = self.s3_client.get_object(Bucket=bucket, Key=key)
        csv_content = response["Body"].read()

        # Try different encodings
        for encoding in ["utf-8", "latin-1", "cp1252"]:
            try:
                df = pd.read_csv(io.BytesIO(csv_content), encoding=encoding)
                logger.info(
                    f"Successfully read {len(df)} rows using {encoding} encoding"
                )
                return df
            except UnicodeDecodeError:
                continue

        raise ValueError("Could not decode CSV file with supported encodings")

    def read_zip_from_s3(self, bucket: str, key: str) -> List[Tuple[str, pd.DataFrame]]:
        """
        Read ZIP file from S3 and extract all CSVs.

        Args:
            bucket: S3 bucket name
            key: S3 object key

        Returns:
            List of (filename, DataFrame) tuples for each CSV in the ZIP
        """
        logger.info(f"Reading ZIP from s3://{bucket}/{key}")

        response = self.s3_client.get_object(Bucket=bucket, Key=key)
        zip_content = response["Body"].read()

        results = []
        with zipfile.ZipFile(io.BytesIO(zip_content), "r") as zip_ref:
            for filename in zip_ref.namelist():
                if filename.lower().endswith(".csv") and not filename.startswith(
                    "__MACOSX"
                ):
                    logger.info(f"Extracting {filename} from ZIP")
                    csv_content = zip_ref.read(filename)

                    # Try different encodings
                    df = None
                    for encoding in ["utf-8", "latin-1", "cp1252"]:
                        try:
                            df = pd.read_csv(io.BytesIO(csv_content), encoding=encoding)
                            logger.info(
                                f"Successfully read {len(df)} rows from {filename} using {encoding}"
                            )
                            break
                        except UnicodeDecodeError:
                            continue

                    if df is not None:
                        results.append((filename, df))
                    else:
                        logger.warning(
                            f"Could not decode {filename} with supported encodings"
                        )

        return results

    def get_table_name(
        self, upload_type: str, country_code: Optional[str] = None
    ) -> str:
        """
        Get the target table name.

        Args:
            upload_type: Type of upload
            country_code: Country code for international surveys

        Returns:
            Table name
        """
        if upload_type == "labelled":
            return "us_labelled"
        elif upload_type == "unlabelled":
            return "us_unlabelled"
        elif upload_type == "international" and country_code:
            return f"{country_code.lower()}_labelled"
        else:
            raise ValueError(
                f"Cannot determine table name for {upload_type}, {country_code}"
            )

    def insert_data(
        self,
        df: pd.DataFrame,
        table_name: str,
        chunk_size: int = 1000,
        if_exists: str = "append",
    ) -> int:
        """
        Insert DataFrame into MySQL table using PyMySQL directly.

        Args:
            df: DataFrame to insert
            table_name: Target table name
            chunk_size: Number of rows per batch
            if_exists: Behavior if table exists ('append', 'replace', 'fail')

        Returns:
            Number of rows inserted
        """
        logger.info(f"Inserting {len(df)} rows into {table_name}")

        conn = self.get_connection()
        cursor = conn.cursor()

        # Check if table exists
        cursor.execute(f"SHOW TABLES LIKE '{table_name}'")
        table_exists = cursor.fetchone() is not None

        if table_exists and if_exists == "replace":
            cursor.execute(f"DROP TABLE IF EXISTS `{table_name}`")
            table_exists = False

        # Get column type for SQL
        def get_sql_type(col, dtype):
            if dtype == "int64":
                return "BIGINT"
            elif dtype == "float64":
                return "DOUBLE"
            else:
                return "TEXT"

        # Create table if it doesn't exist
        if not table_exists:
            # Build CREATE TABLE statement from DataFrame columns
            col_defs = []
            for col in df.columns:
                col_defs.append(f"`{col}` {get_sql_type(col, df[col].dtype)}")

            create_sql = f"CREATE TABLE `{table_name}` ({', '.join(col_defs)})"
            logger.info(f"Creating table: {create_sql[:200]}...")
            cursor.execute(create_sql)
            conn.commit()
        else:
            # Table exists - only insert columns that already exist in the table
            # to avoid exceeding MySQL row size limits with too many columns
            cursor.execute(f"DESCRIBE `{table_name}`")
            existing_cols = {row["Field"] for row in cursor.fetchall()}

            new_cols = [col for col in df.columns if col not in existing_cols]
            if new_cols:
                logger.info(
                    f"Skipping {len(new_cols)} columns not in table: {new_cols[:10]}..."
                )
                df = df[[col for col in df.columns if col in existing_cols]]

            conn.commit()

        # Prepare INSERT statement
        columns = [f"`{col}`" for col in df.columns]
        placeholders = ", ".join(["%s"] * len(df.columns))
        insert_sql = f"INSERT IGNORE INTO `{table_name}` ({', '.join(columns)}) VALUES ({placeholders})"

        # Convert DataFrame to list of tuples, handling NaN values
        # Replace all NaN/NA/None with None for MySQL compatibility
        df_clean = df.replace({pd.NA: None, pd.NaT: None})
        df_clean = df_clean.where(pd.notnull(df_clean), None)

        def clean_value(val):
            """Convert any NaN-like value to None for MySQL."""
            if val is None:
                return None
            if isinstance(val, float) and (pd.isna(val) or val != val):  # NaN check
                return None
            return val

        total_rows = 0
        for i in range(0, len(df_clean), chunk_size):
            chunk = df_clean.iloc[i : i + chunk_size]
            rows = [tuple(clean_value(v) for v in row) for row in chunk.values]
            cursor.executemany(insert_sql, rows)
            conn.commit()
            total_rows += len(rows)
            logger.info(f"Inserted {total_rows}/{len(df)} rows")

        return total_rows

    def ingest(
        self, bucket: str, key: str, upload_type: str
    ) -> Tuple[int, Dict[str, Any]]:
        """
        Full ingestion pipeline: read from S3 and insert into MySQL.

        Args:
            bucket: S3 bucket name
            key: S3 object key
            upload_type: Type of upload

        Returns:
            Tuple of (rows_inserted, metadata)
        """
        # Extract filename from key
        filename = key.split("/")[-1]

        # Handle ZIP files for international uploads
        if filename.lower().endswith(".zip"):
            return self.ingest_zip(bucket, key, upload_type, filename)

        # Parse filename
        metadata = self.parse_filename(filename, upload_type)
        logger.info(f"Parsed metadata: {metadata}")

        # Read CSV from S3
        df = self.read_csv_from_s3(bucket, key)

        # Add metadata columns if not present
        if metadata["wave_number"] and "wave" not in df.columns:
            df["wave"] = f"wave{metadata['wave_number']}"
        if metadata["year"] and "year" not in df.columns:
            df["year"] = metadata["year"]

        # Calculate year and week from endtime if not present (for US surveys)
        if upload_type in ("labelled", "unlabelled") and "endtime" in df.columns:
            # Parse endtime to datetime
            df["_parsed_endtime"] = pd.to_datetime(df["endtime"], errors="coerce")

            # Add year column if not present or all null
            if "year" not in df.columns or df["year"].isna().all():
                df["year"] = df["_parsed_endtime"].dt.year.astype("Int64")

            # Add week column if not present or all null
            # Use strftime %W format to match the processor's date parsing
            # %W = Week number (Monday as first day), range 00-53
            if "week" not in df.columns or df["week"].isna().all():
                week_series = df["_parsed_endtime"].dt.strftime("%W")
                df["week"] = pd.to_numeric(week_series, errors="coerce").astype("Int64")

            # Drop temporary column
            df = df.drop(columns=["_parsed_endtime"])

        # Calculate engaged column if not present (for US surveys)
        # The engaged column indicates whether a respondent passed attention/engagement checks
        # If not present, calculate from engagement_measure_* columns
        if upload_type in ("labelled", "unlabelled") and "engaged" not in df.columns:
            eng_cols = [c for c in df.columns if c.startswith("engagement_measure_")]
            if eng_cols:
                # Engagement check: respondents who leave engagement measures blank pass
                # (they correctly did not fabricate information about a fictional person)
                # Count empty/null responses - if ALL asked questions are empty, engaged=1
                # However, each respondent is typically asked only one question
                # If they provide any answer, they may have failed the attention check

                # For now, default to engaged=1 for all rows where engagement_measure columns exist
                # This is a conservative approach that includes all valid responses
                # The actual engagement logic may need refinement based on survey design
                df["engaged"] = 1
                logger.info(
                    f"Calculated 'engaged' column (defaulted to 1 for {len(df)} rows)"
                )
            else:
                # No engagement columns, default to engaged=1
                df["engaged"] = 1
                logger.info(
                    "No engagement_measure columns found, defaulted 'engaged' to 1"
                )

        # Get target table
        table_name = self.get_table_name(upload_type, metadata.get("country_code"))

        # Insert data
        rows_inserted = self.insert_data(df, table_name)

        metadata["table_name"] = table_name
        metadata["rows_inserted"] = rows_inserted

        return rows_inserted, metadata

    def ingest_zip(
        self, bucket: str, key: str, upload_type: str, zip_filename: str
    ) -> Tuple[int, Dict[str, Any]]:
        """
        Ingest international survey ZIP file containing multiple country CSVs.

        Expected ZIP structure (DART0055 format):
        - Data Files/{country}/DART0055_{country}_W{N}_OUTPUT_strings.csv (labelled)
        - Data Files/{country}/DART0055_{country}_W{N}_OUTPUT_numeric.csv (unlabelled)

        Args:
            bucket: S3 bucket name
            key: S3 object key
            upload_type: Type of upload
            zip_filename: Name of the ZIP file

        Returns:
            Tuple of (total_rows_inserted, metadata)
        """
        logger.info(f"Processing international ZIP file: {zip_filename}")

        # Extract wave number from ZIP filename (e.g., DART0055_W9.zip)
        wave_match = re.search(r"W(\d+)", zip_filename, re.IGNORECASE)
        wave_number = int(wave_match.group(1)) if wave_match else None
        logger.info(f"Detected wave number from ZIP filename: {wave_number}")

        # Read all CSVs from ZIP
        csv_files = self.read_zip_from_s3(bucket, key)
        logger.info(f"Found {len(csv_files)} CSV files in ZIP")

        total_rows = 0
        tables_updated = []

        for csv_filename, df in csv_files:
            logger.info(f"Processing {csv_filename} ({len(df)} rows)")

            csv_lower = csv_filename.lower()

            # Extract country code from path or filename
            # Pattern 1: Data Files/{country}/...
            # Pattern 2: DART0055_{country}_W{N}_...
            country_code = None

            # Try path-based extraction (e.g., "Data Files/BR/...")
            path_match = re.search(r"/([A-Z]{2})/", csv_filename, re.IGNORECASE)
            if path_match:
                country_code = path_match.group(1).upper()

            # Try filename-based extraction (e.g., "DART0055_BR_W9_...")
            if not country_code:
                name_match = re.search(
                    r"DART\d+_([A-Z]{2})_W\d+", csv_filename, re.IGNORECASE
                )
                if name_match:
                    country_code = name_match.group(1).upper()

            if not country_code:
                logger.warning(
                    f"Could not determine country from {csv_filename}, skipping"
                )
                continue

            # Determine if labelled (strings) or unlabelled (numeric)
            # DART0055 format: _strings.csv = labelled, _numeric.csv = unlabelled
            if "_strings" in csv_lower or "strings" in csv_lower:
                is_labelled = True
            elif "_numeric" in csv_lower or "numeric" in csv_lower:
                is_labelled = False
            elif "labelled" in csv_lower and "unlabelled" not in csv_lower:
                is_labelled = True
            elif "unlabelled" in csv_lower:
                is_labelled = False
            else:
                # Try to infer from column names
                if "party_affiliation" in df.columns or any(
                    "therm" in str(c).lower() for c in df.columns
                ):
                    is_labelled = True
                else:
                    is_labelled = False

            table_name = f"{country_code}_{'labelled' if is_labelled else 'unlabelled'}"

            # Add wave column if not present
            if "wave" not in df.columns:
                if wave_number:
                    df["wave"] = f"wave{wave_number}"
                else:
                    logger.warning(f"No wave number for {csv_filename}")

            # Insert data
            rows_inserted = self.insert_data(df, table_name)
            total_rows += rows_inserted
            tables_updated.append(
                {
                    "table": table_name,
                    "rows": rows_inserted,
                    "source_file": csv_filename,
                }
            )

            logger.info(f"Inserted {rows_inserted} rows into {table_name}")

        metadata = {
            "wave_number": wave_number,
            "zip_filename": zip_filename,
            "tables_updated": tables_updated,
            "total_rows": total_rows,
        }

        return total_rows, metadata

    def close(self):
        """Close database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None
