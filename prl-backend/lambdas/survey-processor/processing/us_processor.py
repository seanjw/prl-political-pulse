"""
US Survey Processor

Adapted from legacy americas-pulse-old/src/citizens/us/build.py
Calculates affective polarization, norms, violence, and values metrics.
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
    elif isinstance(obj, (np.floating, np.integer)):
        if pd.isna(obj) or np.isinf(obj):
            return None
        return float(obj) if isinstance(obj, np.floating) else int(obj)
    else:
        return obj


class USProcessor:
    """Process US survey data and calculate analytics."""

    def __init__(
        self,
        db_host: Optional[str] = None,
        db_user: Optional[str] = None,
        db_password: Optional[str] = None,
        db_port: Optional[int] = None,
    ):
        """
        Initialize the US processor.

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
        self.norms_meta = load_config("norms")
        self.violence_meta = load_config("violence")
        self.values_meta = load_config("values")
        self.policy_values_meta = load_config("policy_values")

        self._conn = None
        self._db_params = None
        self._us_labelled = None

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

    def load_us_labelled(self) -> pd.DataFrame:
        """Load US labelled data into pandas DataFrame."""
        if self._us_labelled is None:
            logger.info("Loading US labelled data...")
            conn = self.get_connection()
            # Filter out header rows that got imported as data
            # These rows have column names as values (e.g., democrat_therm_1 = 'democrat_therm_1')
            # Use cursor.execute with parameterized query for proper % handling
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM us_labelled WHERE democrat_therm_1 NOT LIKE %s",
                ("%therm%",),
            )
            rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
            self._us_labelled = pd.DataFrame(rows, columns=columns)
            conn.close()
            logger.info(f"Loaded {len(self._us_labelled)} rows (excluding header rows)")

            # Convert numeric columns
            numeric_cols = [
                "democrat_therm_1",
                "republican_therm_1",
                "weight",
                "engaged",
                "year",
                "week",
                "affpol",
            ]
            for col in numeric_cols:
                if col in self._us_labelled.columns:
                    self._us_labelled[col] = pd.to_numeric(
                        self._us_labelled[col], errors="coerce"
                    )

            # Normalize week within each wave so a single wave doesn't split
            # across two weekly data points on the charts
            # Only apply to rows that have a non-null wave value
            if (
                "wave" in self._us_labelled.columns
                and "week" in self._us_labelled.columns
            ):
                has_wave = self._us_labelled["wave"].notna()
                if has_wave.any():
                    wave_mode_week = (
                        self._us_labelled.loc[has_wave]
                        .groupby("wave")["week"]
                        .agg(
                            lambda x: (
                                x.mode().iloc[0] if len(x.mode()) > 0 else x.iloc[0]
                            )
                        )
                    )
                    self._us_labelled.loc[has_wave, "week"] = self._us_labelled.loc[
                        has_wave, "wave"
                    ].map(wave_mode_week)

        return self._us_labelled

    def add_party_column(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add party classification column based on pid7 if not already present."""
        df = df.copy()

        # If party column already exists with valid values, use it
        if "party" in df.columns and df["party"].notna().any():
            # Ensure consistent values
            df["party"] = df["party"].replace({"dem": "dems", "rep": "reps"})
            return df

        # Otherwise, create from pid7
        dem_values = ["Not very strong Democrat", "Lean Democrat", "Strong Democrat"]
        rep_values = [
            "Not very strong Republican",
            "Lean Republican",
            "Strong Republican",
        ]

        df["party"] = None
        df.loc[df["pid7"].isin(dem_values), "party"] = "dems"
        df.loc[df["pid7"].isin(rep_values), "party"] = "reps"
        df.loc[df["pid7"] == "Independent", "party"] = "inds"

        return df

    def weighted_mean(
        self, df: pd.DataFrame, col: str, weight_col: str = "weight"
    ) -> float:
        """Calculate weighted mean."""
        valid = df[col].notna() & df[weight_col].notna()
        if valid.sum() == 0:
            return np.nan
        return (df.loc[valid, col] * df.loc[valid, weight_col]).sum() / df.loc[
            valid, weight_col
        ].sum()

    def process_affpol(self, us_labelled: pd.DataFrame) -> Dict[str, Any]:
        """Calculate affective polarization metrics."""
        logger.info("Processing affective polarization...")

        # Add party and filter
        df = self.add_party_column(us_labelled)
        df = df[df["party"].notna() & (df["engaged"] == 1)]

        # Calculate affpol
        df["affpol"] = np.where(
            df["party"] == "dems",
            df["democrat_therm_1"] - df["republican_therm_1"],
            df["republican_therm_1"] - df["democrat_therm_1"],
        )
        affpol_data = df[df["affpol"] >= 0].copy()

        data = {}

        # Overall affpol
        total_mean = round(self.weighted_mean(affpol_data, "affpol"), 1)
        dems_mean = round(
            self.weighted_mean(affpol_data[affpol_data["party"] == "dems"], "affpol"), 1
        )
        reps_mean = round(
            self.weighted_mean(affpol_data[affpol_data["party"] == "reps"], "affpol"), 1
        )

        data["affpol"] = {
            "weighted_mean": {
                "total": total_mean,
                "dems": dems_mean,
                "reps": reps_mean,
            },
            "count": {
                "total": len(affpol_data),
                "dems": len(affpol_data[affpol_data["party"] == "dems"]),
                "reps": len(affpol_data[affpol_data["party"] == "reps"]),
            },
        }

        # Affpol by state
        state_data = (
            affpol_data.groupby("inputstate")
            .apply(lambda x: round(self.weighted_mean(x, "affpol"), 1))
            .to_dict()
        )
        data["affpol_by_state"] = [
            {"name": k, "value": v} for k, v in state_data.items()
        ]

        # Affpol over time
        affpol_data["formatted_date"] = pd.to_datetime(
            affpol_data["year"].astype(int).astype(str)
            + " "
            + affpol_data["week"].astype(int).astype(str)
            + " 4",
            format="%Y %W %w",
        )

        time_groups = (
            affpol_data.groupby(["formatted_date", "party"])
            .apply(lambda x: round(self.weighted_mean(x, "affpol"), 1))
            .unstack(fill_value=np.nan)
        )

        total_time = affpol_data.groupby("formatted_date").apply(
            lambda x: round(self.weighted_mean(x, "affpol"), 1)
        )

        time_groups = time_groups.sort_index()
        total_time = total_time.sort_index()

        data["affpol_overtime"] = {
            "dates": [d.strftime("%Y-%m-%d") for d in time_groups.index],
            "total": total_time.values.tolist(),
            "dems": time_groups["dems"].values.tolist()
            if "dems" in time_groups.columns
            else [],
            "reps": time_groups["reps"].values.tolist()
            if "reps" in time_groups.columns
            else [],
        }

        # Dem therm over time
        data["dem_therm_overtime"] = self._process_therm_overtime(
            affpol_data, "democrat_therm_1"
        )

        # Rep therm over time
        data["rep_therm_overtime"] = self._process_therm_overtime(
            affpol_data, "republican_therm_1"
        )

        return data

    def _process_therm_overtime(
        self, affpol_data: pd.DataFrame, therm_col: str
    ) -> Dict:
        """Process thermometer data over time."""
        time_groups = (
            affpol_data.groupby(["formatted_date", "party"])
            .apply(lambda x: round(self.weighted_mean(x, therm_col), 1))
            .unstack(fill_value=np.nan)
        )

        total_time = affpol_data.groupby("formatted_date").apply(
            lambda x: round(self.weighted_mean(x, therm_col), 1)
        )

        time_groups = time_groups.sort_index()
        total_time = total_time.sort_index()

        return {
            "dates": [d.strftime("%Y-%m-%d") for d in time_groups.index],
            "total": total_time.values.tolist(),
            "dems": time_groups["dems"].values.tolist()
            if "dems" in time_groups.columns
            else [],
            "reps": time_groups["reps"].values.tolist()
            if "reps" in time_groups.columns
            else [],
        }

    def process_intro(self, us_labelled: pd.DataFrame) -> Dict[str, Any]:
        """Calculate intro/metadata metrics."""
        logger.info("Processing intro metrics...")

        data = {}

        # Number of weeks
        data["num_weeks"] = int(us_labelled.groupby(["year", "week"]).ngroups)

        # Number of responses
        data["num_responses"] = f"{len(us_labelled) // 1000}"

        # Number of unique responses
        data["num_responses_unique"] = f"{us_labelled['uid'].nunique() // 1000}"

        # End time - use year/week columns
        try:
            max_year = us_labelled["year"].max()
            max_week = us_labelled[us_labelled["year"] == max_year]["week"].max()
            # Convert to int handling potential NA
            max_year = int(float(max_year))
            max_week = int(float(max_week))
            end_time = pd.to_datetime(f"{max_year} {max_week} 4", format="%Y %W %w")
            data["to-month"] = end_time.strftime("%b").upper()
            data["to-year"] = str(max_year)
        except Exception as e:
            logger.warning(f"Error determining end time: {e}")
            data["to-month"] = "DEC"
            data["to-year"] = "2024"

        return data

    def process_intro_gauges(self, us_labelled: pd.DataFrame) -> Dict[str, Any]:
        """Calculate gauge metrics for intro section."""
        logger.info("Processing intro gauges...")

        # Add party and filter
        df = self.add_party_column(us_labelled)
        df = df[df["party"].isin(["dems", "reps"]) & (df["engaged"] == 1)]

        # Calculate affpol
        df["affpol"] = np.where(
            df["party"] == "dems",
            df["democrat_therm_1"] - df["republican_therm_1"],
            df["republican_therm_1"] - df["democrat_therm_1"],
        )
        affpol_data = df[df["affpol"] >= 0].copy()

        data = {}

        def safe_round(val, default=0):
            """Round with NaN handling."""
            if pd.isna(val):
                return default
            return int(round(val))

        # Affpol gauge
        affpol_mean = (affpol_data["affpol"] > 50).mean() * 100
        affpol_val = safe_round(affpol_mean)
        latest_survey = affpol_data["survey"].max()
        latest_affpol_mean = (
            affpol_data[affpol_data["survey"] == latest_survey]["affpol"] > 50
        ).mean() * 100
        affpol_val_change = safe_round(latest_affpol_mean - affpol_mean)
        data["affpol"] = {"val": affpol_val, "val_change": affpol_val_change}

        # Norms gauge
        norms_data = self._prepare_norms_data(us_labelled)
        norm_mean = (norms_data["norm_count"] >= 1).mean() * 100
        norm_val = safe_round(norm_mean)
        latest_survey = norms_data["survey"].max()
        latest_norm_mean = (
            norms_data[norms_data["survey"] == latest_survey]["norm_count"] >= 1
        ).mean() * 100
        norm_val_change = safe_round(latest_norm_mean - norm_mean)
        data["norms"] = {"val": norm_val, "val_change": norm_val_change}

        # Violence gauge
        violence_data = self._prepare_violence_data(us_labelled)
        violence_mean = violence_data["violence3_binary"].mean() * 100
        violence_val = safe_round(violence_mean)
        latest_survey = violence_data["survey"].max()
        latest_violence_mean = (
            violence_data[violence_data["survey"] == latest_survey][
                "violence3_binary"
            ].mean()
            * 100
        )
        violence_val_change = safe_round(latest_violence_mean - violence_mean)
        data["violence"] = {"val": violence_val, "val_change": violence_val_change}

        return data

    def _prepare_norms_data(self, us_labelled: pd.DataFrame) -> pd.DataFrame:
        """Prepare norms data with binary columns."""
        meta = self.norms_meta
        df = self.add_party_column(us_labelled)
        df = df[df["party"].isin(["dems", "reps"]) & (df["engaged"] == 1)].copy()

        for norm in meta:
            df[f"{norm}_binary"] = (
                df[norm].isin(["Strongly agree", "Agree"]).astype(float)
            )
            df.loc[
                ~df[norm].isin(
                    [
                        "Strongly agree",
                        "Agree",
                        "Neither agree nor disagree",
                        "Disagree",
                        "Strongly disagree",
                    ]
                ),
                f"{norm}_binary",
            ] = np.nan

        norm_cols = [f"{norm}_binary" for norm in meta if norm != "norm_executive"]
        df["norm_count"] = df[norm_cols].sum(axis=1)

        return df

    def _prepare_violence_data(self, us_labelled: pd.DataFrame) -> pd.DataFrame:
        """Prepare violence data with binary columns."""
        meta = self.violence_meta
        df = self.add_party_column(us_labelled)
        df = df[df["party"].isin(["dems", "reps"]) & (df["engaged"] == 1)].copy()

        for violence in meta:
            df[f"{violence}_binary"] = (
                df[violence].isin(["Strongly support", "Support"]).astype(int)
            )

        return df

    def process_values(self, us_labelled: pd.DataFrame) -> Dict[str, Any]:
        """Calculate values metrics."""
        logger.info("Processing values...")

        meta = self.values_meta
        df = self.add_party_column(us_labelled)
        df = df[df["party"].notna() & (df["engaged"] == 1)].copy()

        # Create binary columns
        df["general_trust_binary"] = (df["general_trust"] == "Yes").astype(float)
        df.loc[~df["general_trust"].isin(["Yes", "No"]), "general_trust_binary"] = (
            np.nan
        )

        df["institutional_corruption_binary"] = (
            df["institutional_corruption"]
            .isin(["Likely to accept", "Extremely likely to accept"])
            .astype(float)
        )
        df.loc[
            ~df["institutional_corruption"].isin(
                [
                    "Likely to accept",
                    "Extremely likely to accept",
                    "Extremely likely to refuse",
                    "Likely to refuse",
                    "Equally likely to refuse or accept",
                ]
            ),
            "institutional_corruption_binary",
        ] = np.nan

        df["institutional_response_binary"] = (
            df["institutional_response"]
            .isin(["Likely", "Extremely likely"])
            .astype(float)
        )
        df.loc[
            ~df["institutional_response"].isin(
                [
                    "Likely",
                    "Extremely likely",
                    "Extremely unlikely",
                    "Unlikely",
                    "Equally likely to or unlikely",
                ]
            ),
            "institutional_response_binary",
        ] = np.nan

        df["vote_importance_binary"] = (
            df["vote_importance"].isin(["Very important", "Important"]).astype(float)
        )
        df.loc[
            ~df["vote_importance"].isin(
                [
                    "Very important",
                    "Important",
                    "Neither important nor unimportant",
                    "Unimportant",
                    "Very unimportant",
                ]
            ),
            "vote_importance_binary",
        ] = np.nan

        df["pride_binary"] = (
            df["pride"].isin(["Extremely proud", "very proud"]).astype(float)
        )
        df.loc[
            ~df["pride"].isin(
                [
                    "Extremely proud",
                    "very proud",
                    "Moderately proud",
                    "Only a little proud",
                    "Not at all proud",
                ]
            ),
            "pride_binary",
        ] = np.nan

        df["fair_treatment_binary"] = (
            df["fair_treatment"].isin(["Strongly agree", "Agree"]).astype(float)
        )
        df.loc[
            ~df["fair_treatment"].isin(
                [
                    "Strongly agree",
                    "Agree",
                    "Neither agree nor disagree",
                    "Disagree",
                    "Strongly disagree",
                ]
            ),
            "fair_treatment_binary",
        ] = np.nan

        data = {}

        # Support by party
        support_by_party = {}
        for party in ["dems", "reps", "inds"]:
            party_df = df[df["party"] == party]
            support_by_party[party] = {}
            for value in meta:
                binary_col = f"{value}_binary"
                valid = party_df[binary_col].notna()
                if valid.sum() > 0:
                    support_by_party[party][value] = round(
                        (
                            party_df.loc[valid, binary_col]
                            * party_df.loc[valid, "weight"]
                        ).sum()
                        / party_df.loc[valid, "weight"].sum()
                        * 100,
                        1,
                    )
        data["support_by_party"] = support_by_party

        # Support by party over time
        df["formatted_date"] = pd.to_datetime(
            df["year"].astype(int).astype(str)
            + " "
            + df["week"].astype(int).astype(str)
            + " 4",
            format="%Y %W %w",
        )

        data["support_by_party_over_time"] = {}
        for value in meta:
            binary_col = f"{value}_binary"
            time_party_data = (
                df.groupby(["formatted_date", "party"])
                .apply(
                    lambda x: (
                        round(self.weighted_mean(x, binary_col) * 100, 1)
                        if x[binary_col].notna().sum() > 0
                        else np.nan
                    )
                )
                .unstack(fill_value=np.nan)
                .sort_index()
            )

            data["support_by_party_over_time"][value] = {
                "dates": [d.strftime("%Y-%m-%d") for d in time_party_data.index],
                **{
                    party: time_party_data[party].values.tolist()
                    for party in time_party_data.columns
                },
            }

        # Values by state
        data["values_by_state"] = {}
        for value in meta:
            binary_col = f"{value}_binary"
            state_data = (
                df.groupby("inputstate")
                .apply(
                    lambda x: (
                        round(self.weighted_mean(x, binary_col) * 100, 1)
                        if x[binary_col].notna().sum() > 0
                        else np.nan
                    )
                )
                .to_dict()
            )
            data["values_by_state"][value] = [
                {"name": k, "value": v} for k, v in state_data.items() if pd.notna(v)
            ]

        return data

    def process_violence(self, us_labelled: pd.DataFrame) -> Dict[str, Any]:
        """Calculate violence metrics."""
        logger.info("Processing violence...")

        meta = self.violence_meta
        df = self._prepare_violence_data(us_labelled)

        # Calculate violence count
        violence_cols = [f"{violence}_binary" for violence in meta]
        df["violence_count"] = df[violence_cols].sum(axis=1)

        # Add conditional weights
        for violence in meta:
            df[f"{violence}_conditional_weight"] = np.where(
                df[f"{violence}_binary"].notna(), df["weight"], np.nan
            )

        data = {}

        # Support by party
        support_by_party = {}
        for party in ["dems", "reps"]:
            party_df = df[df["party"] == party]
            support_by_party[party] = {}
            for violence in meta:
                binary_col = f"{violence}_binary"
                weight_col = f"{violence}_conditional_weight"
                valid = party_df[weight_col].notna()
                if valid.sum() > 0:
                    support_by_party[party][violence] = round(
                        (
                            party_df.loc[valid, binary_col]
                            * party_df.loc[valid, weight_col]
                        ).sum()
                        / party_df.loc[valid, weight_col].sum()
                        * 100,
                        1,
                    )
            # Add perception columns
            for violence in ["violence3", "violence6"]:
                if f"{violence}_perception" in party_df.columns:
                    weight_col = f"{violence}_conditional_weight"
                    valid = party_df[weight_col].notna()
                    if valid.sum() > 0:
                        support_by_party[party][f"{violence}_perception"] = round(
                            (
                                party_df.loc[valid, f"{violence}_perception"]
                                * party_df.loc[valid, weight_col]
                            ).sum()
                            / party_df.loc[valid, weight_col].sum(),
                            1,
                        )
        data["support_by_party"] = support_by_party

        # Support by party over time
        df["formatted_date"] = pd.to_datetime(
            df["year"].astype(int).astype(str)
            + " "
            + df["week"].astype(int).astype(str)
            + " 4",
            format="%Y %W %w",
        )

        data["support_by_party_over_time"] = {}
        for violence in meta:
            binary_col = f"{violence}_binary"
            time_party_data = (
                df.groupby(["formatted_date", "party"])
                .apply(lambda x: round(self.weighted_mean(x, binary_col) * 100, 1))
                .unstack(fill_value=np.nan)
                .sort_index()
            )

            data["support_by_party_over_time"][violence] = {
                "dates": [d.strftime("%Y-%m-%d") for d in time_party_data.index],
                **{
                    party: time_party_data[party].values.tolist()
                    for party in time_party_data.columns
                },
            }

        # Number of violent acts supported over time
        timedata_all = (
            df.groupby("formatted_date")["violence_count"].mean().round(1).sort_index()
        )
        data["num_violent_acts_supported"] = [
            {d.strftime("%Y-%m-%d"): v}
            for d, v in zip(timedata_all.index, timedata_all.values)
        ]

        # Violence by state
        state_df = df[df["party"].isin(["dems", "reps"])]
        for violence in meta:
            binary_col = f"{violence}_binary"
            weight_col = f"{violence}_conditional_weight"
            state_data = (
                state_df.groupby("inputstate")
                .apply(
                    lambda x: (
                        round(
                            (x[binary_col] * x[weight_col]).sum()
                            / x[weight_col].sum()
                            * 100,
                            1,
                        )
                        if x[weight_col].notna().sum() > 0
                        else np.nan
                    )
                )
                .to_dict()
            )
            data[f"{violence}_by_state"] = [
                {"name": k, "value": v} for k, v in state_data.items() if pd.notna(v)
            ]

        # Violence count by state
        state_count = (
            state_df.groupby("inputstate")
            .apply(lambda x: round(self.weighted_mean(x, "violence_count"), 1))
            .to_dict()
        )
        data["violence_count_by_state"] = [
            {"name": k, "value": v} for k, v in state_count.items() if pd.notna(v)
        ]

        return data

    def process_norms(self, us_labelled: pd.DataFrame) -> Dict[str, Any]:
        """Calculate norms metrics."""
        logger.info("Processing norms...")

        meta = self.norms_meta
        df = self._prepare_norms_data(us_labelled)

        # Add conditional weights
        for norm in meta:
            df[f"{norm}_conditional_weight"] = np.where(
                df[f"{norm}_binary"].notna(), df["weight"], np.nan
            )

        data = {}

        # Norm violation support by party
        norm_violation_support = {}
        for party in ["dems", "reps"]:
            party_df = df[df["party"] == party]
            norm_violation_support[party] = {}
            for norm in meta:
                binary_col = f"{norm}_binary"
                weight_col = f"{norm}_conditional_weight"
                valid = party_df[weight_col].notna()
                if valid.sum() > 0:
                    norm_violation_support[party][norm] = round(
                        (
                            party_df.loc[valid, binary_col]
                            * party_df.loc[valid, weight_col]
                        ).sum()
                        / party_df.loc[valid, weight_col].sum()
                        * 100,
                        1,
                    )
                # Add perception columns
                if f"{norm}_perception" in party_df.columns:
                    valid = party_df[weight_col].notna()
                    if valid.sum() > 0:
                        norm_violation_support[party][f"{norm}_perception"] = round(
                            (
                                party_df.loc[valid, f"{norm}_perception"]
                                * party_df.loc[valid, weight_col]
                            ).sum()
                            / party_df.loc[valid, weight_col].sum(),
                            1,
                        )
        data["norm_violation_support_by_party"] = norm_violation_support

        # Support by party over time
        df["formatted_date"] = pd.to_datetime(
            df["year"].astype(int).astype(str)
            + " "
            + df["week"].astype(int).astype(str)
            + " 4",
            format="%Y %W %w",
        )

        data["support_by_party_over_time"] = {}
        for norm in meta:
            binary_col = f"{norm}_binary"
            time_party_data = (
                df.groupby(["formatted_date", "party"])
                .apply(lambda x: round(self.weighted_mean(x, binary_col) * 100, 1))
                .unstack(fill_value=np.nan)
                .sort_index()
            )

            data["support_by_party_over_time"][norm] = {
                "dates": [d.strftime("%Y-%m-%d") for d in time_party_data.index],
                **{
                    party: time_party_data[party].values.tolist()
                    for party in time_party_data.columns
                },
            }

        # Number of norm violations over time
        timedata_all = df.groupby("formatted_date")["norm_count"].mean().sort_index()
        data["num_norm_violations_supported"] = [
            {d.strftime("%Y-%m-%d"): v if not np.isnan(v) else None}
            for d, v in zip(timedata_all.index, timedata_all.values)
        ]

        # Norms by state
        state_df = df[df["party"].isin(["dems", "reps"])]
        for norm in meta:
            binary_col = f"{norm}_binary"
            weight_col = f"{norm}_conditional_weight"
            state_data = (
                state_df.groupby("inputstate")
                .apply(
                    lambda x: (
                        round(
                            (x[binary_col] * x[weight_col]).sum()
                            / x[weight_col].sum()
                            * 100,
                            1,
                        )
                        if x[weight_col].notna().sum() > 0
                        else np.nan
                    )
                )
                .to_dict()
            )
            data[f"{norm}_by_state"] = [
                {"name": k, "value": v} for k, v in state_data.items() if pd.notna(v)
            ]

        # Norm count by state
        state_count = state_df.groupby("inputstate")["norm_count"].mean().to_dict()
        data["norms_by_state"] = [
            {"name": k, "value": v} for k, v in state_count.items() if pd.notna(v)
        ]

        return data

    def process_policy_values(self, us_labelled: pd.DataFrame) -> Dict[str, Any]:
        """
        Process policy values questions (CPA, immigration, economy, tariffs, freespeech).

        This replicates the legacy us-policy-values/build.py functionality.
        """
        logger.info("Processing policy values...")

        meta = self.policy_values_meta
        qual_columns = [
            "CPA1",
            "CPA2",
            "CPA3",
            "CPA4",
            "CPA5",
            "CPA6",
            "immigration1",
            "immigration2",
            "immigration3",
            "economy1",
            "economy2",
            "tariffs1",
            "tariffs2a",
            "tariffs2b",
            "tariffs3",
            "freespeech",
        ]

        # Add party column and filter to survey >= 124
        df = self.add_party_column(us_labelled)
        df = df[df["survey"] >= 124].copy()

        all_data = {}

        def overall_analysis(data_df, col, filter_party=None):
            """Compute overall distribution for a column."""
            if filter_party:
                data_df = data_df[data_df["party"] == filter_party]

            # Count distribution
            counts = data_df[col].value_counts().to_dict()
            total_count = sum(counts.values())

            return {
                "n": int(total_count),
                "distribution": {
                    str(k): int(v) for k, v in counts.items() if pd.notna(k)
                },
            }

        def temporal_analysis(data_df, col, parent_col=None):
            """Compute temporal analysis with mean scores or response percentages."""
            # Remove nulls
            data_df = data_df[data_df[col].notna()].copy()

            if data_df.empty:
                return {}

            # Format date from year/week
            data_df["formatted_date"] = pd.to_datetime(
                data_df["year"].astype(int).astype(str)
                + " "
                + data_df["week"].astype(int).astype(str)
                + " 4",
                format="%Y %W %w",
            )

            # Group by date and count
            date_counts = (
                data_df.groupby(["formatted_date", col]).size().unstack(fill_value=0)
            )
            date_totals = date_counts.sum(axis=1)

            results = {
                "overtime": {
                    "dates": [
                        d.strftime("%Y-%m-%d") for d in sorted(date_counts.index)
                    ],
                    "response_means": {},
                }
            }

            # Check if ordinal
            col_meta = meta.get(parent_col or col, {})
            is_ordinal = col_meta.get("type") == "ordinal"

            if is_ordinal:
                # Convert to numeric and calculate weighted mean per date
                options = col_meta.get("options", {})
                response_map = {label: int(num) for num, label in options.items()}

                mean_scores = []
                for date in sorted(date_counts.index):
                    date_df = data_df[data_df["formatted_date"] == date]
                    numeric_values = date_df[col].map(response_map)
                    valid = numeric_values.notna()
                    if valid.sum() > 0:
                        mean_score = numeric_values[valid].mean()
                        mean_scores.append(
                            round(mean_score, 2) if pd.notna(mean_score) else None
                        )
                    else:
                        mean_scores.append(None)

                results["overtime"]["response_means"]["mean_score"] = mean_scores
            else:
                # Calculate percentage for each response option
                for option in date_counts.columns:
                    percentages = []
                    for date in sorted(date_counts.index):
                        total = date_totals[date]
                        count = (
                            date_counts.loc[date, option]
                            if option in date_counts.columns
                            else 0
                        )
                        pct = (count / total * 100) if total > 0 else None
                        percentages.append(round(pct, 2) if pct is not None else None)
                    results["overtime"]["response_means"][str(option)] = percentages

            return results

        # Process each qualitative column
        for col in qual_columns:
            if col not in meta:
                continue

            logger.info(f"Processing policy value: {col}")
            col_meta = meta[col]

            if col_meta.get("grid"):
                # Grid question with subcomponents
                all_data[col] = {
                    "grid": True,
                    "type": col_meta.get("type"),
                    "results": {},
                }
                sub_cols = list(col_meta.get("subcomponents", {}).keys())

                for sub in sub_cols:
                    if sub not in df.columns:
                        continue

                    all_data[col]["results"][sub] = {"overall": {}, "overtime": {}}

                    # Overall analysis
                    all_data[col]["results"][sub]["overall"]["all"] = overall_analysis(
                        df, sub
                    )
                    for party in ["dems", "reps", "inds"]:
                        all_data[col]["results"][sub]["overall"][party] = (
                            overall_analysis(df, sub, party)
                        )

                    # Overtime analysis
                    all_data[col]["results"][sub]["overtime"]["all"] = (
                        temporal_analysis(df, sub, col)
                    )
                    for party in ["dems", "reps", "inds"]:
                        party_df = df[df["party"] == party]
                        all_data[col]["results"][sub]["overtime"][party] = (
                            temporal_analysis(party_df, sub, col)
                        )

            else:
                # Non-grid question
                if col not in df.columns:
                    continue

                all_data[col] = {"results": {"overall": {}, "overtime": {}}}

                # Overall analysis
                all_data[col]["results"]["overall"]["all"] = overall_analysis(df, col)
                for party in ["dems", "reps", "inds"]:
                    all_data[col]["results"]["overall"][party] = overall_analysis(
                        df, col, party
                    )

                # Overtime analysis
                all_data[col]["results"]["overtime"]["all"] = temporal_analysis(df, col)
                for party in ["dems", "reps", "inds"]:
                    party_df = df[df["party"] == party]
                    all_data[col]["results"]["overtime"][party] = temporal_analysis(
                        party_df, col
                    )

        return all_data

    def save_policy_values(self, policy_data: Dict[str, Any]):
        """Save policy values to the citizens/policy-values endpoint."""
        logger.info("Saving policy values to database...")

        # Clean NaN values
        policy_data = clean_nan_values(policy_data)

        dbx = dataset.connect(self.db_params)
        dbx["data"].upsert(
            {
                "endpoint": "citizens/policy-values",
                "data": policy_data,
            },
            ["endpoint"],
        )
        dbx.engine.dispose()
        dbx.close()
        logger.info("Policy values saved")

    def process(self) -> Dict[str, Any]:
        """
        Run full US survey processing pipeline.

        Returns:
            Dict with all calculated metrics
        """
        logger.info("Starting US survey processing...")

        us_labelled = self.load_us_labelled()

        all_us_data = {}

        # Process all sections
        all_us_data["affpol"] = self.process_affpol(us_labelled)
        all_us_data["intro-info"] = self.process_intro(us_labelled)
        all_us_data["intro-gauges"] = self.process_intro_gauges(us_labelled)
        all_us_data["values"] = self.process_values(us_labelled)
        all_us_data["violence"] = self.process_violence(us_labelled)
        all_us_data["norms"] = self.process_norms(us_labelled)

        # Process and save policy values separately (different endpoint)
        policy_values_data = self.process_policy_values(us_labelled)
        self.save_policy_values(policy_values_data)

        # Clean NaN values before saving (JSON cannot serialize NaN)
        logger.info("Cleaning NaN values...")
        all_us_data = clean_nan_values(all_us_data)

        # Save to database
        logger.info("Saving results to database...")
        dbx = dataset.connect(self.db_params)
        dbx["data"].upsert(
            {
                "endpoint": "citizens/landing-full",
                "data": all_us_data,
            },
            ["endpoint"],
        )
        dbx.engine.dispose()
        dbx.close()

        logger.info("US survey processing complete")
        return all_us_data

    def close(self):
        """Close database connections."""
        self._us_labelled = None
