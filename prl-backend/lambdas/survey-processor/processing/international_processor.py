"""
International Survey Processor

Adapted from legacy americas-pulse-old/src/citizens/international/build.py
Calculates affective polarization, norms, and violence metrics for international surveys.
Uses pandas + PyMySQL for simpler Lambda deployment (no ibis dependency).
"""

import os
import json
import logging
import urllib.parse
from pathlib import Path
from typing import Dict, Any, Optional

import pymysql
import dataset
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Load config from bundled JSON files
CONFIG_DIR = Path(__file__).parent.parent / "config" / "meta"


def load_config(name: str) -> Dict:
    """Load configuration from bundled JSON file."""
    config_path = CONFIG_DIR / f"{name}.json"
    with open(config_path, "r") as f:
        return json.load(f)


def clean_nan_values(obj):
    """
    Recursively clean NaN/Inf values from a data structure.

    JSON cannot serialize NaN or Inf, so we convert them to None (null).
    """
    if isinstance(obj, dict):
        return {k: clean_nan_values(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan_values(item) for item in obj]
    elif isinstance(obj, float):
        if pd.isna(obj) or np.isinf(obj):
            return None
        return obj
    elif hasattr(obj, "item"):  # numpy types
        val = obj.item()
        if pd.isna(val) or (isinstance(val, float) and np.isinf(val)):
            return None
        return val
    else:
        return obj


class InternationalProcessor:
    """Process international survey data and calculate analytics."""

    COUNTRIES = ["BR", "DE", "IL", "IN", "PL"]

    def __init__(
        self,
        db_host: Optional[str] = None,
        db_user: Optional[str] = None,
        db_password: Optional[str] = None,
        db_port: Optional[int] = None,
    ):
        """
        Initialize the international processor.

        Args:
            db_host: MySQL host
            db_user: MySQL user
            db_password: MySQL password
            db_port: MySQL port
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

        # Load configurations
        self.meta = load_config("international")

        self._conn = None
        self._db_params = None

    @staticmethod
    def _load_db_secrets() -> dict:
        """Fetch DB credentials from Secrets Manager (prl/database)."""
        try:
            import boto3

            client = boto3.client("secretsmanager")
            resp = client.get_secret_value(SecretId="prl/database")
            return json.loads(resp["SecretString"])
        except Exception as e:
            logger.warning(f"Could not load secrets from Secrets Manager: {e}")
            return {}

    def get_connection(self):
        """Get PyMySQL connection."""
        return pymysql.connect(
            host=self.db_host,
            user=self.db_user,
            password=self.db_password,
            database="surveys",
            port=self.db_port,
            cursorclass=pymysql.cursors.DictCursor,
        )

    @property
    def db_params(self):
        """Get database connection string for dataset library."""
        if self._db_params is None:
            password_encoded = urllib.parse.quote(self.db_password)
            self._db_params = (
                f"mysql+pymysql://{self.db_user}:{password_encoded}"
                f"@{self.db_host}:{self.db_port}/pulse"
            )
        return self._db_params

    def load_table(self, table_name: str, wave: Optional[str] = None) -> pd.DataFrame:
        """Load table data into pandas DataFrame, filtering out header rows."""
        conn = self.get_connection()
        cursor = conn.cursor()

        # Use cursor.execute with parameterized query to avoid header row issues
        # Filter out rows where party_affiliation = 'party_affiliation' (header rows)
        if wave:
            cursor.execute(
                f"SELECT * FROM {table_name} WHERE wave = %s AND party_affiliation != %s",
                (wave, "party_affiliation"),
            )
        else:
            cursor.execute(
                f"SELECT * FROM {table_name} WHERE party_affiliation != %s",
                ("party_affiliation",),
            )

        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        df = pd.DataFrame(rows, columns=columns)
        conn.close()
        return df

    def get_us_data(self) -> Dict[str, Any]:
        """Fetch US data from database for comparison."""
        logger.info("Fetching US data for comparison...")

        dbx = dataset.connect(self.db_params)
        us_data = dbx["data"].find_one(endpoint="citizens/landing-full")["data"]
        dbx.engine.dispose()
        dbx.close()

        return us_data

    def process_affpol(self, us_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate affective polarization for all countries."""
        logger.info("Processing international affective polarization...")

        meta = self.meta

        # Get US affpol overtime data
        us_affpol = us_data["affpol"]
        us_affpol_overtime = [
            {date: total}
            for date, total in zip(
                us_affpol["affpol_overtime"]["dates"],
                us_affpol["affpol_overtime"]["total"],
            )
        ]

        # Initialize country affpol dict
        country_affpol = {}
        for country in self.COUNTRIES:
            country_affpol[meta[country]["label"]] = {
                "inparty_rating": [],
                "outparty_rating": [],
                "affpol": [],
            }

        # Process each country
        for country in self.COUNTRIES:
            for wave in meta["dates"]:
                try:
                    data = self.load_table(f"{country}_labelled", wave)

                    if len(data) == 0:
                        logger.warning(f"No data for {country} wave {wave}")
                        continue

                    if country in ["IL"]:
                        # Israel has direct in/out party columns
                        data["inparty_rating"] = pd.to_numeric(
                            data["inparty_therm_1"], errors="coerce"
                        )
                        data["outparty_rating"] = pd.to_numeric(
                            data["outparty_therm_1"], errors="coerce"
                        )
                    else:
                        # Other countries need party mapping
                        party_therm_map = meta[country]["party_therm_map"]

                        # Convert thermometer columns to numeric first
                        for party_therm in party_therm_map.values():
                            if party_therm in data.columns:
                                data[party_therm] = pd.to_numeric(
                                    data[party_therm].replace(
                                        {"skipped": None, "": None}
                                    ),
                                    errors="coerce",
                                )

                        # Get inparty rating - lookup thermometer for respondent's party
                        def get_inparty_rating(row):
                            party = row.get("party_affiliation")
                            if party and party in party_therm_map:
                                therm_col = party_therm_map[party]
                                if therm_col in row.index:
                                    return row[therm_col]
                            return np.nan

                        data["inparty_rating"] = data.apply(get_inparty_rating, axis=1)

                        # Get outparty rating - mean of other party thermometers
                        def get_outparty_rating(row):
                            party = row.get("party_affiliation")
                            other_therms = []
                            for pt, therm_col in party_therm_map.items():
                                if pt != party and therm_col in row.index:
                                    val = row[therm_col]
                                    if pd.notna(val):
                                        other_therms.append(val)
                            return np.mean(other_therms) if other_therms else np.nan

                        data["outparty_rating"] = data.apply(
                            get_outparty_rating, axis=1
                        )

                    data["affpol"] = data["inparty_rating"] - data["outparty_rating"]

                    country_label = meta[country]["label"]
                    wave_date = meta["dates"][wave]

                    country_affpol[country_label]["inparty_rating"].append(
                        {wave_date: round(float(data["inparty_rating"].mean()), 1)}
                    )
                    country_affpol[country_label]["outparty_rating"].append(
                        {wave_date: round(float(data["outparty_rating"].mean()), 1)}
                    )
                    country_affpol[country_label]["affpol"].append(
                        {wave_date: round(float(data["affpol"].mean()), 1)}
                    )

                except Exception as e:
                    logger.error(
                        f"Error processing affpol for {country} wave {wave}: {e}"
                    )
                    continue

        # Add US data
        country_affpol["United States"] = {
            "affpol": us_affpol_overtime,
        }

        return country_affpol

    def process_violence(self, us_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate violence metrics for all countries."""
        logger.info("Processing international violence...")

        meta = self.meta
        us_violence = us_data["violence"]["num_violent_acts_supported"]

        # Round US violence data
        us_violence = [
            {k: round(v, 1) if v is not None else None for k, v in d.items()}
            for d in us_violence
        ]

        # Initialize country violence dict
        country_violence = {}
        for country in self.COUNTRIES:
            country_violence[meta[country]["label"]] = {
                "num_violent_acts_supported": [],
            }

        # Process each country
        for country in self.COUNTRIES:
            for wave in meta["dates"]:
                try:
                    data = self.load_table(f"{country}_unlabelled", wave)

                    if len(data) == 0:
                        logger.warning(f"No data for {country} wave {wave}")
                        continue

                    violence_questions = meta[country]["violence_questions"]

                    # Calculate number of violent acts supported
                    data["num_violent_acts_supported"] = data.apply(
                        lambda x: sum(
                            [
                                x[v] in [1, 2, 3]
                                for v in violence_questions
                                if v in data.columns
                            ]
                        ),
                        axis=1,
                    )

                    country_label = meta[country]["label"]
                    wave_date = meta["dates"][wave]

                    country_violence[country_label][
                        "num_violent_acts_supported"
                    ].append(
                        {wave_date: data["num_violent_acts_supported"].mean().round(1)}
                    )

                except Exception as e:
                    logger.error(
                        f"Error processing violence for {country} wave {wave}: {e}"
                    )
                    continue

        # Add US data
        country_violence["United States"] = {
            "num_violent_acts_supported": us_violence,
        }

        return country_violence

    def process_norms(self, us_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate norms metrics for all countries."""
        logger.info("Processing international norms...")

        meta = self.meta
        us_norms = us_data["norms"]["num_norm_violations_supported"]

        # Round US norms data
        us_norms = [
            {k: round(v, 1) if v is not None else None for k, v in d.items()}
            for d in us_norms
        ]

        # Initialize country norms dict
        country_norms = {}
        for country in self.COUNTRIES:
            country_norms[meta[country]["label"]] = {
                "num_norm_violations_supported": [],
            }

        # Process each country
        for country in self.COUNTRIES:
            for wave in meta["dates"]:
                try:
                    data = self.load_table(f"{country}_unlabelled", wave)

                    if len(data) == 0:
                        logger.warning(f"No data for {country} wave {wave}")
                        continue

                    norm_questions = meta[country]["norm_questions"]

                    # Calculate number of norm violations supported
                    data["num_norm_violations_supported"] = data.apply(
                        lambda x: sum(
                            [
                                x[v] in [1, 2, 3]
                                for v in norm_questions
                                if v in data.columns
                            ]
                        ),
                        axis=1,
                    )

                    country_label = meta[country]["label"]
                    wave_date = meta["dates"][wave]

                    country_norms[country_label][
                        "num_norm_violations_supported"
                    ].append(
                        {
                            wave_date: data["num_norm_violations_supported"]
                            .mean()
                            .round(1)
                        }
                    )

                except Exception as e:
                    logger.error(
                        f"Error processing norms for {country} wave {wave}: {e}"
                    )
                    continue

        # Add US data
        country_norms["United States"] = {
            "num_norm_violations_supported": us_norms,
        }

        return country_norms

    def process_country_questions(self) -> Dict[str, Dict[str, Any]]:
        """
        Process country-specific questions data for each country.
        Returns data suitable for the /citizens/international/{country}/questions endpoints.
        """
        logger.info("Processing country-specific questions...")

        meta = self.meta
        country_questions = {}

        # Party colors for each country
        party_colors = {
            "BR": {
                "PT": "#cc0000",
                "PL": "#1a4d1a",
                "PSDB": "#0080ff",
                "PMDB/MDB": "#ff8c00",
                "PSOL": "#ffcc00",
                "PDT": "#b22222",
                "NOVO": "#ff4500",
            },
            "DE": {
                "SPD (Sozialdemokratische Partei Deutschlands)": "#e3000f",
                "CDU/CSU (Christlich Demokratische Union/Christlich-Soziale Union)": "#000000",
                "Bündnis 90/Die Grünen": "#1aa037",
                "FDP (Freie Demokratische Partei)": "#ffed00",
                "AfD (Alternative für Deutschland)": "#009ee0",
                "Die Linke": "#be3075",
            },
            "IL": {
                "Likud": "#0038b8",
                "Yesh Atid": "#5bc0de",
                "National Unity": "#003366",
                "Yisrael Beiteinu": "#154360",
                "Otzma Yehudit": "#ffcc00",
                "Labor": "#cc0000",
                "Religious Zionism": "#8b4513",
                "Shas": "#000080",
                "United Torah Judaism": "#000000",
            },
            "IN": {
                "Bharatiya Janata Party": "#ff9933",
                "Indian National Congress": "#00bfff",
            },
            "PL": {
                "Koalicja Obywatelska PO .N IPL Zieloni (PO)": "#f68b1f",
                "Prawo i Sprawiedliwosc": "#263778",
                "Nowa Lewica (NL)": "#a51140",
                "Trzecia Droga Polska 2050 Szymona Holowni – Polskie Stronnictwo Ludowe": "#00a651",
                "Konfederacja Wolnosc i Niepodleglosc": "#1a1a1a",
                "Bezpartyjni Samorzadowcy": "#6b6b6b",
                "Polska Jest Jedna": "#0066cc",
            },
        }

        for country in self.COUNTRIES:
            logger.info(f"Processing questions for {country}...")
            country_label = meta[country]["label"]
            violence_questions = meta[country]["violence_questions"]
            norm_questions = meta[country]["norm_questions"]
            party_therm_map = meta[country].get("party_therm_map", {})
            party_code_map = meta[country].get("party_code_map", {})
            if party_code_map:
                parties = list(party_code_map.values())
            else:
                parties = list(party_therm_map.keys())

            # Initialize result structure
            violence_data = {q: [] for q in violence_questions}
            norms_data = {q: [] for q in norm_questions}
            violence_by_party = {q: {"dates": []} for q in violence_questions}
            norms_by_party = {q: {"dates": []} for q in norm_questions}

            # Initialize party columns in by_party dicts
            for q in violence_questions:
                for party in parties:
                    violence_by_party[q][party] = []
            for q in norm_questions:
                for party in parties:
                    norms_by_party[q][party] = []

            # Process each wave
            for wave in meta["dates"]:
                try:
                    # Load unlabelled data for violence/norms
                    data = self.load_table(f"{country}_unlabelled", wave)

                    if len(data) == 0:
                        logger.warning(f"No data for {country} wave {wave}")
                        continue

                    wave_date = meta["dates"][wave]

                    # Process violence questions
                    for q in violence_questions:
                        if q in data.columns:
                            # Convert to numeric
                            data[q] = pd.to_numeric(data[q], errors="coerce")
                            # Calculate percentage supporting (values 1, 2, or 3 on scale)
                            valid = data[q].notna()
                            if valid.sum() > 0:
                                pct = (
                                    data.loc[valid, q].isin([1, 2, 3]).sum()
                                    / valid.sum()
                                ) * 100
                                violence_data[q].append({wave_date: round(pct, 1)})

                    # Process norm questions
                    for q in norm_questions:
                        if q in data.columns:
                            data[q] = pd.to_numeric(data[q], errors="coerce")
                            valid = data[q].notna()
                            if valid.sum() > 0:
                                pct = (
                                    data.loc[valid, q].isin([1, 2, 3]).sum()
                                    / valid.sum()
                                ) * 100
                                norms_data[q].append({wave_date: round(pct, 1)})

                    # Get party-labelled data for by-party breakdowns
                    if party_code_map and "party_affiliation" in data.columns:
                        # Use numeric codes from unlabelled data + code map
                        merged = data.copy()
                        merged["party_affiliation"] = (
                            merged["party_affiliation"]
                            .astype(str)
                            .str.strip()
                            .map(party_code_map)
                        )
                    else:
                        # Merge with labelled data for party names
                        labelled_data = self.load_table(f"{country}_labelled", wave)
                        merged = None
                        if (
                            len(labelled_data) > 0
                            and "party_affiliation" in labelled_data.columns
                        ):
                            if (
                                "caseid" in data.columns
                                and "caseid" in labelled_data.columns
                            ):
                                data["caseid"] = data["caseid"].astype(str).str.strip()
                                labelled_data["caseid"] = (
                                    labelled_data["caseid"].astype(str).str.strip()
                                )
                                merge_data = data.drop(
                                    columns=["party_affiliation"],
                                    errors="ignore",
                                )
                                merged = merge_data.merge(
                                    labelled_data[["caseid", "party_affiliation"]],
                                    on="caseid",
                                    how="left",
                                )
                            else:
                                merged = data.copy()
                                merged["party_affiliation"] = labelled_data[
                                    "party_affiliation"
                                ].values[: len(data)]

                    if merged is not None and "party_affiliation" in merged.columns:
                        # Calculate by-party stats
                        for q in violence_questions:
                            violence_by_party[q]["dates"].append(wave_date)
                            if q in merged.columns:
                                merged[q] = pd.to_numeric(merged[q], errors="coerce")
                                for party in parties:
                                    party_data = merged[
                                        merged["party_affiliation"] == party
                                    ]
                                    valid = party_data[q].notna()
                                    if valid.sum() > 0:
                                        pct = (
                                            party_data.loc[valid.index[valid], q]
                                            .isin([1, 2, 3])
                                            .sum()
                                            / valid.sum()
                                        ) * 100
                                        violence_by_party[q][party].append(
                                            round(pct, 1)
                                        )
                                    else:
                                        violence_by_party[q][party].append(None)

                        for q in norm_questions:
                            norms_by_party[q]["dates"].append(wave_date)
                            if q in merged.columns:
                                merged[q] = pd.to_numeric(merged[q], errors="coerce")
                                for party in parties:
                                    party_data = merged[
                                        merged["party_affiliation"] == party
                                    ]
                                    valid = party_data[q].notna()
                                    if valid.sum() > 0:
                                        pct = (
                                            party_data.loc[valid.index[valid], q]
                                            .isin([1, 2, 3])
                                            .sum()
                                            / valid.sum()
                                        ) * 100
                                        norms_by_party[q][party].append(round(pct, 1))
                                    else:
                                        norms_by_party[q][party].append(None)

                except Exception as e:
                    logger.error(
                        f"Error processing questions for {country} wave {wave}: {e}"
                    )
                    continue

            # Calculate overall by-party stats (across all waves)
            violence_overall_by_party = {}
            norms_overall_by_party = {}

            for q in violence_questions:
                violence_overall_by_party[q] = {
                    "parties": parties,
                    "values": [],
                    "counts": [],
                }
                for party in parties:
                    vals = [
                        v for v in violence_by_party[q].get(party, []) if v is not None
                    ]
                    if vals:
                        violence_overall_by_party[q]["values"].append(
                            round(sum(vals) / len(vals), 1)
                        )
                        violence_overall_by_party[q]["counts"].append(len(vals))
                    else:
                        violence_overall_by_party[q]["values"].append(None)
                        violence_overall_by_party[q]["counts"].append(0)

            for q in norm_questions:
                norms_overall_by_party[q] = {
                    "parties": parties,
                    "values": [],
                    "counts": [],
                }
                for party in parties:
                    vals = [
                        v for v in norms_by_party[q].get(party, []) if v is not None
                    ]
                    if vals:
                        norms_overall_by_party[q]["values"].append(
                            round(sum(vals) / len(vals), 1)
                        )
                        norms_overall_by_party[q]["counts"].append(len(vals))
                    else:
                        norms_overall_by_party[q]["values"].append(None)
                        norms_overall_by_party[q]["counts"].append(0)

            country_questions[country] = {
                "country": country_label,
                "parties": parties,
                "party_colors": party_colors.get(country, {}),
                "violence": violence_data,
                "norms": norms_data,
                "violence_by_party": violence_by_party,
                "norms_by_party": norms_by_party,
                "violence_overall_by_party": violence_overall_by_party,
                "norms_overall_by_party": norms_overall_by_party,
            }

        return country_questions

    def process(self) -> Dict[str, Any]:
        """
        Run full international survey processing pipeline.

        Returns:
            Dict with all calculated metrics
        """
        logger.info("Starting international survey processing...")

        # Get US data for comparison
        us_data = self.get_us_data()

        # Process all sections
        country_affpol = self.process_affpol(us_data)
        country_violence = self.process_violence(us_data)
        country_norms = self.process_norms(us_data)

        result = {
            "affpol": country_affpol,
            "violence": country_violence,
            "norms": country_norms,
        }

        # Clean NaN values before saving (JSON cannot serialize NaN)
        logger.info("Cleaning NaN values...")
        result = clean_nan_values(result)

        # Process country-specific questions
        country_questions = self.process_country_questions()
        country_questions = clean_nan_values(country_questions)

        # Save to database
        logger.info("Saving results to database...")
        dbx = dataset.connect(self.db_params)

        # Save main international data
        dbx["data"].upsert(
            {
                "endpoint": "citizens/international",
                "data": result,
            },
            ["endpoint"],
        )

        # Save country-specific questions data
        for country_code, questions_data in country_questions.items():
            endpoint = f"citizens/international/{country_code.lower()}/questions"
            logger.info(f"Saving {endpoint}...")
            dbx["data"].upsert(
                {
                    "endpoint": endpoint,
                    "data": questions_data,
                },
                ["endpoint"],
            )

        dbx.engine.dispose()
        dbx.close()

        logger.info("International survey processing complete")
        return result

    def close(self):
        """Close database connections."""
        pass
