#!/usr/bin/env python3
"""
Generate aggregate international data for the main charts.
Calculates affective polarization, violence support, and norms support per wave.
"""

import os
import json
import sys
import boto3
import pymysql
import pandas as pd
import numpy as np
from io import StringIO

# Add project root to path so we can import shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.config import get_secrets

# Configuration
S3_BUCKET = os.environ["S3_BUCKET"]


def _get_db_config(database="pulse"):
    """Build DB config dict from Secrets Manager."""
    secrets = get_secrets("prl/database")
    return {
        "host": secrets["DB_HOST"],
        "user": secrets["DB_USER"],
        "password": secrets["DB_PASSWORD"],
        "port": int(secrets["DB_PORT"]),
        "database": database,
    }


# Country configuration with thermometer column mappings
COUNTRIES = {
    "BR": {
        "name": "Brazil",
        "party_col": "party_affiliation",
        "therm_cols": {
            "PT": "pt_therm_1",
            "PL": "pl_therm_1",
            "PMDB/MDB": "mdb_therm_1",
            "PSDB": "psdb_therm_1",
            "PSOL": "psol_therm_1",
            "PDT": "pdt_therm_1",
            "NOVO": "novo_therm_1",
        },
        "norm_cols": [
            "norm_judges",
            "norm_polling",
            "norm_executive",
            "norm_censorship",
            "norm_loyalty",
        ],
        "use_precalc": False,
    },
    "DE": {
        "name": "Germany",
        "party_col": "party_affiliation",
        "therm_cols": {
            "SPD": "spd_therm_1",
            "CDU/CSU": "cdu_therm_1",
            "Grüne": "greens_therm_1",
            "FDP": "fdp_therm_1",
            "AfD": "afd_therm_1",
            "Linke": "left_therm_1",
            "BSW": "bsw_therm_1",
        },
        "party_map": {
            "SPD (Sozialdemokratische Partei Deutschlands)": "SPD",
            "CDU/CSU (Christlich Demokratische Union/Christlich-Soziale Union)": "CDU/CSU",
            "Bündnis 90/Die Grünen": "Grüne",
            "FDP (Freie Demokratische Partei)": "FDP",
            "AfD (Alternative für Deutschland)": "AfD",
            "Die Linke": "Linke",
            "Bündnis Sahra Wagenknecht": "BSW",
        },
        "norm_cols": [
            "norm_media_censorship",
            "norm_nomination",
            "norm_eu",
            "norm_dissolve",
            "norm_extremists",
        ],
        "use_precalc": False,
    },
    "IN": {
        "name": "India",
        "party_col": "party_affiliation",
        "therm_cols": {
            "BJP": "bjp_therm_1",
            "Congress": "inc_therm_1",
        },
        "party_map": {
            "Bharatiya Janata Party": "BJP",
            "Indian National Congress": "Congress",
        },
        "norm_cols": ["norm_judges", "norm_polling", "norm_censorship", "norm_loyalty"],
        "use_precalc": False,
    },
    "IL": {
        "name": "Israel",
        "party_col": "party_affiliation",
        "therm_cols": {},
        "norm_cols": [
            "norm_judges",
            "norm_polling",
            "norm_executive",
            "norm_censorship",
            "norm_loyalty",
        ],
        "use_precalc": True,  # Has inparty_therm_1 and outparty_therm_1 pre-calculated
    },
    "PL": {
        "name": "Poland",
        "party_col": "party_affiliation",
        "therm_cols": {
            "PO": "po_therm_1",
            "PiS": "pis_therm_1",
            "PSL": "psl_therm_1",
            "NL": "nl_therm_1",
        },
        "party_map": {
            "Koalicja Obywatelska PO .N IPL Zieloni (PO)": "PO",
            "Prawo i Sprawiedliwość": "PiS",
            "Prawo i Sprawiedliwo??": "PiS",
        },
        "norm_cols": ["norm_1", "norm_2", "norm_3", "norm_4", "norm_5"],
        "use_precalc": False,
    },
}

# Wave to date mapping
WAVE_DATES = {
    "wave1": "2024-01",
    "wave2": "2024-04",
    "wave3": "2024-07",
    "wave4": "2024-10",
    "wave5": "2025-01",
    "wave6": "2025-04",
    "wave7": "2025-07",
    "wave8": "2025-10",
    "wave9": "2026-01",
    "wave10": "2026-04",
    "wave11": "2026-07",
    "wave12": "2026-10",
}

# Violence columns (same for all countries)
VIOLENCE_COLS = [
    "violence1",
    "violence2",
    "violence3",
    "violence4",
    "violence5",
    "violence6",
]

# Support values for counting (same as in questions script)
SUPPORT_VALUES_BY_LANG = {
    "pt": ["A favor", "Extremamente a favor", "Concordo", "Concordo completamente"],
    "de": ["Unterstütze", "Unterstütze stark", "Stimme zu", "Stimme vollkommen zu"],
    "en": ["Support", "Strongly support", "Agree", "Strongly agree"],
    "he": ["תומך/כת", "תומך/כת מאוד", "מסכים/מה", "מאוד מסכים/מה"],
    "pl": ["Popieram", "Stanowczo popieram", "Zgadzam si", "Zdecydowanie si zgadzam"],
}

LANG_BY_COUNTRY = {"BR": "pt", "DE": "de", "IN": "en", "IL": "he", "PL": "pl"}


def download_country_data(s3_client, country_code: str) -> pd.DataFrame:
    """Download country CSV from S3."""
    csv_key = f"data/international/{country_code}-all.csv"

    try:
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=csv_key)
        csv_content = response["Body"].read().decode("utf-8")
        return pd.read_csv(StringIO(csv_content), low_memory=False)
    except Exception as e:
        print(f"  Error downloading {csv_key}: {e}")
        return None


def is_support(value, lang: str) -> bool:
    """Check if a response value indicates support."""
    if pd.isna(value):
        return False
    if value in [1, 2, "1", "2"]:
        return True
    if isinstance(value, str):
        support_texts = SUPPORT_VALUES_BY_LANG.get(lang, [])
        value_lower = value.lower().strip()
        for support_text in support_texts:
            if value_lower == support_text.lower() or value_lower.startswith(
                support_text.lower()
            ):
                return True
    return False


def calculate_affpol(df: pd.DataFrame, config: dict) -> dict:
    """Calculate affective polarization metrics for a wave."""
    party_col = config["party_col"]
    therm_cols = config.get("therm_cols", {})
    party_map = config.get("party_map", {})
    use_precalc = config.get("use_precalc", False)

    # If using pre-calculated columns (Israel)
    if (
        use_precalc
        and "inparty_therm_1" in df.columns
        and "outparty_therm_1" in df.columns
    ):
        inparty_ratings = []
        outparty_ratings = []
        weights = []

        for _, row in df.iterrows():
            weight = row.get("weight", 1)
            if pd.isna(weight):
                weight = 1

            inparty = row.get("inparty_therm_1")
            outparty = row.get("outparty_therm_1")

            if pd.notna(inparty) and pd.notna(outparty):
                inparty_ratings.append(float(inparty) * weight)
                outparty_ratings.append(float(outparty) * weight)
                weights.append(weight)

        if weights and sum(weights) > 0:
            total_weight = sum(weights)
            avg_inparty = sum(inparty_ratings) / total_weight
            avg_outparty = sum(outparty_ratings) / total_weight
            return {
                "affpol": round(avg_inparty - avg_outparty, 1),
                "inparty_rating": round(avg_inparty, 1),
                "outparty_rating": round(avg_outparty, 1),
            }
        return None

    if party_col not in df.columns:
        return None

    # Find all thermometer columns that exist in the data
    available_therms = {}
    for party, col in therm_cols.items():
        if col in df.columns:
            available_therms[party] = col

    if not available_therms:
        return None

    inparty_ratings = []
    outparty_ratings = []
    weights = []

    for _, row in df.iterrows():
        raw_party = row[party_col]
        if pd.isna(raw_party):
            continue

        # Map party name if needed
        party = party_map.get(raw_party, raw_party)

        # Get weight
        weight = row.get("weight", 1)
        if pd.isna(weight):
            weight = 1

        # Find inparty thermometer
        inparty_therm = None
        inparty_col = available_therms.get(party)
        if inparty_col:
            val = row.get(inparty_col)
            if pd.notna(val):
                try:
                    inparty_therm = float(val)
                except (ValueError, TypeError):
                    pass

        if inparty_therm is None:
            continue

        # Calculate average outparty thermometer
        outparty_vals = []
        for p, col in available_therms.items():
            if p != party:
                val = row.get(col)
                if pd.notna(val):
                    try:
                        outparty_vals.append(float(val))
                    except (ValueError, TypeError):
                        pass

        if not outparty_vals:
            continue

        outparty_avg = np.mean(outparty_vals)

        inparty_ratings.append(inparty_therm * weight)
        outparty_ratings.append(outparty_avg * weight)
        weights.append(weight)

    if not weights or sum(weights) == 0:
        return None

    total_weight = sum(weights)
    avg_inparty = sum(inparty_ratings) / total_weight
    avg_outparty = sum(outparty_ratings) / total_weight
    affpol = avg_inparty - avg_outparty

    return {
        "affpol": round(affpol, 1),
        "inparty_rating": round(avg_inparty, 1),
        "outparty_rating": round(avg_outparty, 1),
    }


def calculate_violence_support(df: pd.DataFrame, lang: str) -> float:
    """Calculate average number of violent acts supported."""
    counts = []
    weights = []

    for _, row in df.iterrows():
        weight = row.get("weight", 1)
        if pd.isna(weight):
            weight = 1

        # Count how many violence questions they support
        support_count = 0
        valid_count = 0
        for col in VIOLENCE_COLS:
            if col in df.columns:
                val = row.get(col)
                if pd.notna(val):
                    valid_count += 1
                    if is_support(val, lang):
                        support_count += 1

        if valid_count > 0:
            counts.append(support_count * weight)
            weights.append(weight)

    if not weights or sum(weights) == 0:
        return None

    return round(sum(counts) / sum(weights), 1)


def calculate_norms_support(df: pd.DataFrame, norm_cols: list, lang: str) -> float:
    """Calculate average number of norm violations supported."""
    counts = []
    weights = []

    for _, row in df.iterrows():
        weight = row.get("weight", 1)
        if pd.isna(weight):
            weight = 1

        # Count how many norm questions they support
        support_count = 0
        valid_count = 0
        for col in norm_cols:
            if col in df.columns:
                val = row.get(col)
                if pd.notna(val):
                    valid_count += 1
                    if is_support(val, lang):
                        support_count += 1

        if valid_count > 0:
            counts.append(support_count * weight)
            weights.append(weight)

    if not weights or sum(weights) == 0:
        return None

    return round(sum(counts) / sum(weights), 1)


def process_country(s3_client, country_code: str) -> dict:
    """Process a single country and return aggregate metrics by wave."""
    config = COUNTRIES[country_code]
    lang = LANG_BY_COUNTRY[country_code]

    print(f"\nProcessing {config['name']} ({country_code})...")

    df = download_country_data(s3_client, country_code)
    if df is None:
        return None

    print(f"  Loaded {len(df)} rows")

    if "wave" not in df.columns:
        print("  ERROR: No 'wave' column")
        return None

    waves = sorted(df["wave"].unique())
    print(f"  Waves: {waves}")

    affpol_series = []
    inparty_series = []
    outparty_series = []
    violence_series = []
    norms_series = []

    for wave in waves:
        wave_df = df[df["wave"] == wave]
        date = WAVE_DATES.get(wave, wave)

        # Affective polarization
        affpol_result = calculate_affpol(wave_df, config)
        if affpol_result:
            affpol_series.append({date: affpol_result["affpol"]})
            inparty_series.append({date: affpol_result["inparty_rating"]})
            outparty_series.append({date: affpol_result["outparty_rating"]})

        # Violence support
        violence_val = calculate_violence_support(wave_df, lang)
        if violence_val is not None:
            violence_series.append({date: violence_val})

        # Norms support
        norms_val = calculate_norms_support(wave_df, config["norm_cols"], lang)
        if norms_val is not None:
            norms_series.append({date: norms_val})

    print(
        f"  Generated {len(affpol_series)} affpol points, {len(violence_series)} violence points, {len(norms_series)} norms points"
    )

    return {
        "affpol": affpol_series,
        "inparty_rating": inparty_series,
        "outparty_rating": outparty_series,
        "violence": violence_series,
        "norms": norms_series,
    }


def get_existing_us_data(conn) -> dict:
    """Get existing US data from the database to preserve it."""
    cursor = conn.cursor()
    cursor.execute("SELECT data FROM data WHERE endpoint = 'citizens/international'")
    row = cursor.fetchone()
    cursor.close()

    if not row:
        return None

    data = json.loads(row[0]) if isinstance(row[0], str) else row[0]

    # Extract US data
    us_data = {
        "affpol": data.get("affpol", {}).get("United States", {}),
        "violence": data.get("violence", {}).get("United States", {}),
        "norms": data.get("norms", {}).get("United States", {}),
    }
    return us_data


def update_database(results: dict, us_data: dict):
    """Update the database with new aggregate data."""
    # Build the data structure
    affpol_data = {}
    violence_data = {}
    norms_data = {}

    for country_code, metrics in results.items():
        if metrics is None:
            continue

        name = COUNTRIES[country_code]["name"]

        affpol_data[name] = {
            "affpol": metrics["affpol"],
            "inparty_rating": metrics["inparty_rating"],
            "outparty_rating": metrics["outparty_rating"],
        }

        violence_data[name] = {
            "num_violent_acts_supported": metrics["violence"],
        }

        norms_data[name] = {
            "num_norm_violations_supported": metrics["norms"],
        }

    # Add US data back
    if us_data:
        affpol_data["United States"] = us_data.get("affpol", {})
        violence_data["United States"] = us_data.get("violence", {})
        norms_data["United States"] = us_data.get("norms", {})

    final_data = {
        "affpol": affpol_data,
        "violence": violence_data,
        "norms": norms_data,
    }

    # Update database
    conn = pymysql.connect(**_get_db_config())
    cursor = conn.cursor()

    try:
        endpoint = "citizens/international"
        json_data = json.dumps(final_data)

        cursor.execute("SELECT id FROM data WHERE endpoint = %s", (endpoint,))
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                "UPDATE data SET data = %s WHERE endpoint = %s", (json_data, endpoint)
            )
            print(f"\nUpdated existing endpoint: {endpoint}")
        else:
            cursor.execute(
                "INSERT INTO data (endpoint, data) VALUES (%s, %s)",
                (endpoint, json_data),
            )
            print(f"\nInserted new endpoint: {endpoint}")

        conn.commit()
        print("Success!")
    finally:
        cursor.close()
        conn.close()


def main():
    print("=" * 60)
    print("International Aggregate Data Generator")
    print("=" * 60)

    s3_client = boto3.client("s3")

    # Get existing US data to preserve it
    conn = pymysql.connect(**_get_db_config())
    us_data = get_existing_us_data(conn)
    conn.close()

    if us_data:
        print("Preserved existing US data")

    # Process all countries
    results = {}
    for country_code in COUNTRIES:
        try:
            results[country_code] = process_country(s3_client, country_code)
        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback

            traceback.print_exc()

    # Update database
    update_database(results, us_data)

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == "__main__":
    main()
