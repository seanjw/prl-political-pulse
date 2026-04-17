#!/usr/bin/env python3
"""
Generate per-question time series data for international surveys.
Downloads survey data from S3, processes it, and inserts into the database.
"""

import os
import json
import sys
import tempfile
import zipfile
from collections import defaultdict
import boto3
import pymysql
import pandas as pd

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


# Country configuration
COUNTRIES = {
    "BR": {"name": "Brazil", "lang": "pt"},
    "DE": {"name": "Germany", "lang": "de"},
    "IN": {"name": "India", "lang": "en"},
    "IL": {"name": "Israel", "lang": "he"},
    "PL": {"name": "Poland", "lang": "pl"},
}

# Wave to date mapping (quarterly waves starting Jan 2024)
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

# Support values by language - includes both violence (favor/support) and norms (agree) question types
SUPPORT_VALUES = {
    "pt": [
        # Violence questions (favor)
        "A favor",
        "Extremamente a favor",
        # Norm questions (agree)
        "Concordo",
        "Concordo completamente",
    ],
    "de": [
        # Violence (German uses "Unterstütze")
        "Unterstütze",
        "Unterstütze stark",
        # Norms
        "Stimme zu",
        "Stimme vollkommen zu",
    ],
    "en": [
        # Violence (India uses "Support")
        "Support",
        "Strongly support",
        # Norms
        "Agree",
        "Strongly agree",
    ],
    "he": [
        # Violence (Hebrew)
        "תומך/כת",
        "תומך/כת מאוד",
        # Norms
        "מסכים/מה",
        "מאוד מסכים/מה",
    ],
    "pl": [
        # Violence (Polish uses "Popieram")
        "Popieram",
        "Stanowczo popieram",
        # Norms (Polish - handle encoding)
        "Zgadzam si",
        "Zdecydowanie si zgadzam",
    ],
}

# Add numeric support (1, 2 often = support in coded data)
SUPPORT_NUMERIC = [1, 2, "1", "2"]

# Question columns - violence is standard, norms vary by country
VIOLENCE_COLS = [
    "violence1",
    "violence2",
    "violence3",
    "violence4",
    "violence5",
    "violence6",
]

# Country-specific norm columns (each country has different democratic challenges)
NORM_COLS_BY_COUNTRY = {
    "BR": [
        "norm_judges",
        "norm_polling",
        "norm_executive",
        "norm_censorship",
        "norm_loyalty",
    ],
    "DE": [
        "norm_media_censorship",
        "norm_nomination",
        "norm_eu",
        "norm_dissolve",
        "norm_extremists",
    ],
    "IN": [
        "norm_judges",
        "norm_polling",
        "norm_executive",
        "norm_censorship",
        "norm_loyalty",
    ],
    "IL": [
        "norm_judges",
        "norm_polling",
        "norm_executive",
        "norm_censorship",
        "norm_loyalty",
    ],
    "PL": ["norm_1", "norm_2", "norm_3", "norm_4", "norm_5"],
}

# Party configuration by country - maps party names in data to display labels
# Includes all parties from the survey data
PARTY_CONFIG = {
    "BR": {
        "column": "party_affiliation",
        "parties": {
            "PT": ["PT"],  # Workers' Party (Lula)
            "PL": ["PL"],  # Liberal Party (Bolsonaro)
            "PSDB": ["PSDB"],  # Brazilian Social Democracy Party
            "PMDB/MDB": ["PMDB/MDB"],  # Brazilian Democratic Movement
            "PSOL": ["PSOL"],  # Socialism and Liberty Party
            "PDT": ["PDT"],  # Democratic Labour Party
            "NOVO": ["NOVO"],  # New Party
        },
        "colors": {
            "PT": "#cc0000",
            "PL": "#1a4d1a",
            "PSDB": "#0080ff",
            "PMDB/MDB": "#ff8c00",
            "PSOL": "#ffcc00",
            "PDT": "#b22222",
            "NOVO": "#ff4500",
        },
    },
    "DE": {
        "column": "party_affiliation",
        "parties": {
            "CDU/CSU": [
                "CDU/CSU (Christlich Demokratische Union/Christlich-Soziale Union)"
            ],
            "SPD": ["SPD (Sozialdemokratische Partei Deutschlands)"],
            "AfD": ["AfD (Alternative für Deutschland)"],
            "Grüne": ["Bündnis 90/Die Grünen"],
            "FDP": ["FDP (Freie Demokratische Partei)"],
            "Linke": ["Die Linke"],
            "BSW": ["Bündnis Sahra Wagenknecht"],
        },
        "colors": {
            "CDU/CSU": "#000000",
            "SPD": "#e3000f",
            "AfD": "#009ee0",
            "Grüne": "#1aa037",
            "FDP": "#ffed00",
            "Linke": "#be3075",
            "BSW": "#712d8b",
        },
    },
    "IN": {
        "column": "party_affiliation",
        "parties": {
            "BJP": ["Bharatiya Janata Party"],
            "Congress": ["Indian National Congress"],
            "AAP": ["Aam Aadmi Party"],
            "CPI": ["Communist Party of India"],
            "TMC": ["All India Trinamool Congress"],
            "DMK": ["Dravida Munnetra Kazhagam"],
            "SP": ["Samajwadi Party"],
            "BSP": ["Bahujan Samaj Party"],
        },
        "colors": {
            "BJP": "#ff9933",
            "Congress": "#19aaed",
            "AAP": "#0066b3",
            "CPI": "#ff0000",
            "TMC": "#20c646",
            "DMK": "#e30022",
            "SP": "#ff2222",
            "BSP": "#22409a",
        },
    },
    "IL": {
        "column": "party_affiliation",
        "parties": {
            "Likud": ["לליכוד"],
            "Yesh Atid": ["יש עתיד"],
            "National Camp": ["המחנה הממלכתי"],
            "Yisrael Beiteinu": ["ישראל ביתנו"],
            "Labor": ["מפלגת העבודה הישראלית"],
            "Religious Zionist": ["מפלגה דתית לאומית–הציונות הדתית"],
            "Otzma Yehudit": ["עוצמה יהודית"],
            "Shas": ["ש״ס"],
            "UTJ": ["יהדות התורה"],
        },
        "colors": {
            "Likud": "#0038b8",
            "Yesh Atid": "#ff6600",
            "National Camp": "#003366",
            "Yisrael Beiteinu": "#0a4c8c",
            "Labor": "#e30022",
            "Religious Zionist": "#d4a017",
            "Otzma Yehudit": "#ffd700",
            "Shas": "#0a2351",
            "UTJ": "#000080",
        },
    },
    "PL": {
        "column": "party_affiliation",
        "parties": {
            "PO": ["Koalicja Obywatelska PO .N IPL Zieloni (PO)"],
            "PiS": ["Prawo i Sprawiedliwo??", "Prawo i Sprawiedliwość"],
            "Konfederacja": ["Konfederacja Wolno?? i Niepodleg?o??"],
            "Trzecia Droga": [
                "Trzecia Droga Polska 2050 Szymona Ho?owni – Polskie Stronnictwo Ludowe"
            ],
            "Lewica": ["Nowa Lewica (NL)"],
        },
        "colors": {
            "PO": "#f68b1f",
            "PiS": "#263778",
            "Konfederacja": "#152238",
            "Trzecia Droga": "#ffd500",
            "Lewica": "#b61d36",
        },
    },
}


def download_country_data(s3_client, country_code: str, tmpdir: str) -> str:
    """Download country CSV from S3 (supports both CSV and ZIP formats)."""
    csv_key = f"data/international/{country_code}-all.csv"
    zip_key = f"data/international/{country_code}-all.zip"
    csv_path = os.path.join(tmpdir, f"{country_code}-all.csv")

    # Try CSV first (new format)
    try:
        print(f"  Downloading {csv_key}...")
        s3_client.download_file(S3_BUCKET, csv_key, csv_path)
        return csv_path
    except Exception:
        pass

    # Fall back to ZIP format (legacy)
    try:
        zip_path = os.path.join(tmpdir, f"{country_code}-all.zip")
        print(f"  Downloading {zip_key}...")
        s3_client.download_file(S3_BUCKET, zip_key, zip_path)

        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmpdir)

        return csv_path
    except Exception as e:
        raise Exception(f"Could not download data for {country_code}: {e}")


def is_support(value, lang: str) -> bool:
    """Check if a response value indicates support."""
    if pd.isna(value):
        return False

    # Check numeric values
    if value in SUPPORT_NUMERIC:
        return True

    # Check text values
    if isinstance(value, str):
        support_texts = SUPPORT_VALUES.get(lang, [])
        value_lower = value.lower().strip()

        # Exact match first (case insensitive)
        for support_text in support_texts:
            if value_lower == support_text.lower():
                return True

        # Check if value STARTS with a support text (e.g., "Strongly agree" matches "Strongly agree with...")
        # But NOT if it contains negation words
        negation_words = ["não", "nem", "nie", "nicht", "לא", "neither", "nor", "not"]
        has_negation = any(neg in value_lower for neg in negation_words)

        if not has_negation:
            for support_text in support_texts:
                # Check if the support text is the START of the value (not just contained)
                if value_lower.startswith(support_text.lower()):
                    return True

    return False


def calculate_support_rate(
    df: pd.DataFrame, col: str, lang: str, missing_as_zero: bool = False
) -> float:
    """Calculate the percentage who support (weighted if weight column exists).

    Args:
        df: DataFrame with survey data
        col: Column name to analyze
        lang: Language code for support text matching
        missing_as_zero: If True, treat missing values as non-support (0).
                        Used for violence questions where no answer = no support.
    """
    if col not in df.columns:
        return None

    if missing_as_zero:
        # Use all rows, treating missing as non-support
        data = df.copy()
        data["support"] = data[col].apply(
            lambda x: is_support(x, lang) if pd.notna(x) else False
        )
    else:
        # Only use rows with valid responses
        data = df[df[col].notna()].copy()
        if len(data) == 0:
            return None
        data["support"] = data[col].apply(lambda x: is_support(x, lang))

    if len(data) == 0:
        return None

    if "weight" in data.columns and data["weight"].notna().any():
        # Weighted calculation
        weights = data["weight"].fillna(1)
        support_weighted = (data["support"] * weights).sum()
        total_weighted = weights.sum()
        if total_weighted > 0:
            return round((support_weighted / total_weighted) * 100, 1)
    else:
        # Unweighted calculation
        return round(data["support"].mean() * 100, 1)

    return None


def calculate_support_by_party(
    df: pd.DataFrame,
    col: str,
    lang: str,
    party_config: dict,
    missing_as_zero: bool = False,
) -> dict:
    """Calculate support rate for each party.

    Returns dict like: {'PT': 12.5, 'PL': 8.3}
    """
    if col not in df.columns:
        return {}

    party_col = party_config["column"]
    if party_col not in df.columns:
        return {}

    result = {}
    for party_label, party_values in party_config["parties"].items():
        # Filter to this party's respondents
        party_df = df[df[party_col].isin(party_values)]
        if len(party_df) == 0:
            continue

        rate = calculate_support_rate(party_df, col, lang, missing_as_zero)
        if rate is not None:
            result[party_label] = rate

    return result


def calculate_overall_by_party(
    df: pd.DataFrame,
    col: str,
    lang: str,
    party_config: dict,
    missing_as_zero: bool = False,
) -> dict:
    """Calculate overall support rate and count for each party across all waves.

    Returns dict like: {
        'parties': ['PT', 'PL', ...],  # sorted by count descending
        'values': [12.5, 8.3, ...],
        'counts': [2258, 1327, ...]
    }
    """
    if col not in df.columns:
        return {"parties": [], "values": [], "counts": []}

    party_col = party_config["column"]
    if party_col not in df.columns:
        return {"parties": [], "values": [], "counts": []}

    party_data = []
    for party_label, party_values in party_config["parties"].items():
        # Filter to this party's respondents
        party_df = df[df[party_col].isin(party_values)]
        if len(party_df) == 0:
            continue

        count = len(party_df)
        rate = calculate_support_rate(party_df, col, lang, missing_as_zero)
        if rate is not None:
            party_data.append({"party": party_label, "value": rate, "count": count})

    # Sort by count descending
    party_data.sort(key=lambda x: x["count"], reverse=True)

    return {
        "parties": [p["party"] for p in party_data],
        "values": [p["value"] for p in party_data],
        "counts": [p["count"] for p in party_data],
    }


def process_country(s3_client, country_code: str, tmpdir: str) -> dict:
    """Process a single country's survey data."""
    config = COUNTRIES[country_code]
    lang = config["lang"]

    print(f"\nProcessing {config['name']} ({country_code})...")

    # Download data
    csv_path = download_country_data(s3_client, country_code, tmpdir)

    # Read CSV
    print("  Reading CSV...")
    df = pd.read_csv(csv_path, low_memory=False)
    print(f"  Loaded {len(df)} rows")

    # Get available waves
    if "wave" not in df.columns:
        print("  ERROR: No 'wave' column found")
        return None

    waves = sorted(df["wave"].unique())
    print(f"  Waves: {waves}")

    # Calculate per-question time series
    violence_data = defaultdict(list)
    norms_data = defaultdict(list)

    # By-party data: { question: { dates: [], party1: [], party2: [] } }
    violence_by_party = defaultdict(lambda: {"dates": []})
    norms_by_party = defaultdict(lambda: {"dates": []})

    # Get country-specific norm columns and party config
    norm_cols = NORM_COLS_BY_COUNTRY.get(country_code, [])
    party_config = PARTY_CONFIG.get(country_code, {})
    party_labels = list(party_config.get("parties", {}).keys())

    # Initialize party arrays
    for col in VIOLENCE_COLS:
        for party in party_labels:
            violence_by_party[col][party] = []
    for col in norm_cols:
        for party in party_labels:
            norms_by_party[col][party] = []

    for wave in waves:
        wave_df = df[df["wave"] == wave]
        date = WAVE_DATES.get(wave, wave)

        # Violence questions - missing responses treated as no support
        for col in VIOLENCE_COLS:
            rate = calculate_support_rate(wave_df, col, lang, missing_as_zero=True)
            if rate is not None:
                violence_data[col].append({date: rate})

            # By-party breakdown
            if party_config:
                violence_by_party[col]["dates"].append(date)
                party_rates = calculate_support_by_party(
                    wave_df, col, lang, party_config, missing_as_zero=True
                )
                for party in party_labels:
                    violence_by_party[col][party].append(party_rates.get(party))

        # Norm questions (country-specific)
        for col in norm_cols:
            rate = calculate_support_rate(wave_df, col, lang)
            if rate is not None:
                norms_data[col].append({date: rate})

            # By-party breakdown
            if party_config:
                norms_by_party[col]["dates"].append(date)
                party_rates = calculate_support_by_party(
                    wave_df, col, lang, party_config, missing_as_zero=False
                )
                for party in party_labels:
                    norms_by_party[col][party].append(party_rates.get(party))

    # Calculate overall by-party data (aggregated across all waves, sorted by sample size)
    violence_overall_by_party = {}
    norms_overall_by_party = {}

    if party_config:
        for col in VIOLENCE_COLS:
            violence_overall_by_party[col] = calculate_overall_by_party(
                df, col, lang, party_config, missing_as_zero=True
            )
        for col in norm_cols:
            norms_overall_by_party[col] = calculate_overall_by_party(
                df, col, lang, party_config, missing_as_zero=False
            )

    result = {
        "country": config["name"],
        "violence": dict(violence_data),
        "norms": dict(norms_data),
        "violence_by_party": {k: dict(v) for k, v in violence_by_party.items()},
        "norms_by_party": {k: dict(v) for k, v in norms_by_party.items()},
        "violence_overall_by_party": violence_overall_by_party,
        "norms_overall_by_party": norms_overall_by_party,
        "parties": party_labels,
        "party_colors": party_config.get("colors", {}),
    }

    print(f"  Violence questions: {list(violence_data.keys())}")
    print(f"  Norm questions: {list(norms_data.keys())}")
    print(f"  Parties: {party_labels}")

    return result


def insert_to_database(country_code: str, data: dict):
    """Insert country question data into the database."""
    endpoint = f"citizens/international/{country_code.lower()}/questions"

    print(f"\nInserting data for endpoint: {endpoint}")

    conn = pymysql.connect(**_get_db_config())
    cursor = conn.cursor()

    try:
        # Check if endpoint exists
        cursor.execute("SELECT id FROM data WHERE endpoint = %s", (endpoint,))
        existing = cursor.fetchone()

        json_data = json.dumps(data)

        if existing:
            # Update existing
            cursor.execute(
                "UPDATE data SET data = %s WHERE endpoint = %s", (json_data, endpoint)
            )
            print("  Updated existing endpoint")
        else:
            # Insert new
            cursor.execute(
                "INSERT INTO data (endpoint, data) VALUES (%s, %s)",
                (endpoint, json_data),
            )
            print("  Inserted new endpoint")

        conn.commit()
        print("  Success!")

    finally:
        cursor.close()
        conn.close()


def main():
    print("=" * 60)
    print("International Survey Questions Data Generator")
    print("=" * 60)

    s3_client = boto3.client("s3")

    with tempfile.TemporaryDirectory() as tmpdir:
        for country_code in COUNTRIES:
            try:
                data = process_country(s3_client, country_code, tmpdir)
                if data:
                    insert_to_database(country_code, data)
            except Exception as e:
                print(f"  ERROR processing {country_code}: {e}")
                import traceback

                traceback.print_exc()

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == "__main__":
    main()
