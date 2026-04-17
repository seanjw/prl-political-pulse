"""Shared database helpers for Pulse build scripts."""

import os
import math
import urllib.parse

import ibis
import dataset

CATEGORIES = [
    "attack_personal",
    "attack_policy",
    "outcome_creditclaiming",
    "policy",
    "outcome_bipartisanship",
]

CATEGORY_LABELS = {
    "attack_personal": "Personal Attacks",
    "attack_policy": "Policy Criticism",
    "policy": "Policy Discussion",
    "outcome_creditclaiming": "Accomplishments",
    "outcome_bipartisanship": "Bipartisanship",
}

STATE_ABBR_TO_NAME = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "DC": "District of Columbia",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
    "AS": "American Samoa",
    "GU": "Guam",
    "MP": "Commonwealth of the Northern Mariana Islands",
    "PR": "Puerto Rico",
    "VI": "United States Virgin Islands",
}


def _db_params(database: str) -> str:
    """Build a dataset-compatible connection string from env vars."""
    host = os.environ.get("DB_HOST", "localhost")
    dialect = os.environ.get("DB_DIALECT", "mysql")
    user = os.environ["DB_USER"]
    password = urllib.parse.quote(os.environ["DB_PASSWORD"])
    port = os.environ["DB_PORT"]
    return f"{dialect}://{user}:{password}@{host}:{port}/{database}"


def get_elite_connection():
    """Return an ibis MySQL connection to the elite database."""
    return ibis.mysql.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database="elite",
    )


def get_pulse_db():
    """Return a dataset connection to the pulse database."""
    return dataset.connect(_db_params("pulse"))


def get_elite_db():
    """Return a dataset connection to the elite database."""
    return dataset.connect(_db_params("elite"))


def sanitize_for_json(obj):
    """Sanitize values for valid JSON serialization.

    - Replace NaN/Inf with None
    - Convert integer-valued floats back to int (pandas promotes int
      columns to float64 when NaN is present, turning 1 → 1.0)
    - Convert numpy scalar types to native Python types
    """
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        if obj == int(obj):
            return int(obj)
    elif type(obj).__module__ == "numpy":
        # Handle numpy scalar types (float64, int64, etc.)
        return sanitize_for_json(obj.item())
    return obj
