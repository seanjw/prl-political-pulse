#!/usr/bin/env python3
"""
Process a US survey wave (dart0051) and update the database.
Adds new wave data to existing time series for violence, norms, and affpol.

Usage:
    python process_us_wave.py /path/to/dart0051_w178-clean_2026_label.csv
    python process_us_wave.py /path/to/dart0051_w178-clean_2026_label.csv --dry-run
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
import pandas as pd
import pymysql

# Add project root to path so we can import shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.config import get_secrets


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


# Violence columns
VIOLENCE_COLS = [
    "violence1",
    "violence2",
    "violence3",
    "violence4",
    "violence5",
    "violence6",
]

# Norm columns
NORM_COLS = [
    "norm_judges",
    "norm_polling",
    "norm_executive",
    "norm_censorship",
    "norm_loyalty",
]

# Support values
VIOLENCE_SUPPORT = ["Support", "Strongly support"]
NORM_SUPPORT = ["Agree", "Strongly agree"]


def extract_wave_info(filename: str) -> tuple:
    """Extract wave number and year from filename."""
    match = re.search(r"dart0051_w(\d+)-clean_(\d{4})", filename, re.IGNORECASE)
    if match:
        return int(match.group(1)), int(match.group(2))
    return None, None


def get_wave_date(df: pd.DataFrame) -> str:
    """Get the wave date from the data (Thursday of the survey week)."""
    # Parse starttime and get the median date
    dates = pd.to_datetime(df["starttime"], errors="coerce")
    median_date = dates.dropna().median()

    # Round to nearest Thursday (weekday 3)
    days_since_thursday = (median_date.weekday() - 3) % 7
    thursday = median_date - pd.Timedelta(days=days_since_thursday)

    return thursday.strftime("%Y-%m-%d")


def calculate_support_rate(
    df: pd.DataFrame, col: str, support_values: list, party: str = None
) -> float:
    """Calculate weighted support rate for a column."""
    if col not in df.columns:
        return None

    data = df.copy()

    # Filter by party if specified
    if party:
        if "pid3" not in data.columns:
            return None
        data = data[data["pid3"] == party]

    if len(data) == 0:
        return None

    # Get valid responses
    valid = data[data[col].notna()].copy()
    if len(valid) == 0:
        return None

    # Calculate support
    valid.loc[:, "is_support"] = valid[col].isin(support_values)

    # Weighted calculation if weight column exists
    if "weight" in valid.columns and valid["weight"].notna().any():
        weights = valid["weight"].fillna(1)
        support_weighted = (valid["is_support"] * weights).sum()
        total_weighted = weights.sum()
        if total_weighted > 0:
            return round((support_weighted / total_weighted) * 100, 1)
    else:
        return round(valid["is_support"].mean() * 100, 1)

    return None


def calculate_state_aggregates(
    df: pd.DataFrame, col: str, support_values: list
) -> list:
    """Calculate support rate by state."""
    if col not in df.columns or "inputstate" not in df.columns:
        return []

    results = []
    for state in df["inputstate"].dropna().unique():
        state_df = df[df["inputstate"] == state]
        rate = calculate_support_rate(state_df, col, support_values)
        if rate is not None:
            results.append({"name": state, "value": rate})

    # Sort by value descending
    results.sort(key=lambda x: x["value"], reverse=True)
    return results


def calculate_violence_count_by_state(df: pd.DataFrame) -> list:
    """Calculate average number of violent acts supported by state."""
    if "inputstate" not in df.columns:
        return []

    results = []
    for state in df["inputstate"].dropna().unique():
        state_df = df[df["inputstate"] == state]

        counts = []
        weights = []
        for _, row in state_df.iterrows():
            weight = row.get("weight", 1)
            if pd.isna(weight):
                weight = 1

            count = 0
            for col in VIOLENCE_COLS:
                if col in df.columns and row.get(col) in VIOLENCE_SUPPORT:
                    count += 1

            counts.append(count * weight)
            weights.append(weight)

        if weights and sum(weights) > 0:
            avg = sum(counts) / sum(weights)
            results.append({"name": state, "value": round(avg, 2)})

    results.sort(key=lambda x: x["value"], reverse=True)
    return results


def calculate_affpol(df: pd.DataFrame, party: str = None) -> dict:
    """Calculate affective polarization metrics."""
    data = df.copy()

    if party:
        if "pid3" not in data.columns:
            return None
        data = data[data["pid3"] == party]

    if len(data) == 0:
        return None

    dem_therms = []
    rep_therms = []
    weights = []

    for _, row in data.iterrows():
        dem_therm = row.get("democrat_therm_1")
        rep_therm = row.get("republican_therm_1")
        weight = row.get("weight", 1)

        if pd.isna(weight):
            weight = 1

        if pd.notna(dem_therm) and pd.notna(rep_therm):
            try:
                dem_therms.append(float(dem_therm) * weight)
                rep_therms.append(float(rep_therm) * weight)
                weights.append(weight)
            except (ValueError, TypeError):
                pass

    if not weights or sum(weights) == 0:
        return None

    total_weight = sum(weights)
    avg_dem = sum(dem_therms) / total_weight
    avg_rep = sum(rep_therms) / total_weight

    return {
        "dem_therm": round(avg_dem, 1),
        "rep_therm": round(avg_rep, 1),
    }


def calculate_affpol_by_state(df: pd.DataFrame) -> list:
    """Calculate affective polarization by state."""
    if "inputstate" not in df.columns:
        return []

    results = []
    for state in df["inputstate"].dropna().unique():
        state_df = df[df["inputstate"] == state]

        # For each respondent, calculate their affpol (inparty - outparty)
        affpols = []
        weights = []

        for _, row in state_df.iterrows():
            party = row.get("pid3")
            dem_therm = row.get("democrat_therm_1")
            rep_therm = row.get("republican_therm_1")
            weight = row.get("weight", 1)

            if pd.isna(weight):
                weight = 1

            if (
                pd.notna(dem_therm)
                and pd.notna(rep_therm)
                and party in ["Democrat", "Republican"]
            ):
                try:
                    dem_val = float(dem_therm)
                    rep_val = float(rep_therm)

                    if party == "Democrat":
                        affpol = dem_val - rep_val
                    else:
                        affpol = rep_val - dem_val

                    affpols.append(affpol * weight)
                    weights.append(weight)
                except (ValueError, TypeError):
                    pass

        if weights and sum(weights) > 0:
            avg_affpol = sum(affpols) / sum(weights)
            results.append({"name": state, "value": round(avg_affpol, 1)})

    results.sort(key=lambda x: x["value"], reverse=True)
    return results


def get_existing_data(conn, endpoint: str) -> dict:
    """Get existing data from database."""
    cursor = conn.cursor()
    cursor.execute("SELECT data FROM data WHERE endpoint = %s", (endpoint,))
    row = cursor.fetchone()
    cursor.close()

    if row:
        return json.loads(row[0]) if isinstance(row[0], str) else row[0]
    return {}


def update_database(conn, endpoint: str, data: dict, dry_run: bool = False):
    """Update or insert data in database."""
    json_data = json.dumps(data)

    if dry_run:
        print(f"  [DRY RUN] Would update endpoint: {endpoint}")
        return

    cursor = conn.cursor()
    cursor.execute("SELECT id FROM data WHERE endpoint = %s", (endpoint,))
    existing = cursor.fetchone()

    if existing:
        cursor.execute(
            "UPDATE data SET data = %s WHERE endpoint = %s", (json_data, endpoint)
        )
    else:
        cursor.execute(
            "INSERT INTO data (endpoint, data) VALUES (%s, %s)", (endpoint, json_data)
        )

    conn.commit()
    cursor.close()
    print(f"  Updated endpoint: {endpoint}")


def process_wave(csv_path: str, dry_run: bool = False):
    """Process a US survey wave and update database."""
    print("=" * 60)
    print("US Survey Wave Processor")
    print("=" * 60)

    # Extract wave info from filename
    wave_num, year = extract_wave_info(csv_path)
    print(f"File: {csv_path}")
    print(f"Wave: {wave_num}, Year: {year}")

    if dry_run:
        print("MODE: DRY RUN (no changes will be made)")
    print()

    # Read CSV
    print("Reading CSV...")
    df = pd.read_csv(csv_path, low_memory=False)
    print(f"  Loaded {len(df)} rows")

    # Get wave date
    wave_date = get_wave_date(df)
    print(f"  Wave date: {wave_date}")

    # Connect to database
    conn = pymysql.connect(**_get_db_config())

    try:
        # === UPDATE VIOLENCE DATA ===
        print("\n--- Processing Violence Data ---")
        violence_data = get_existing_data(conn, "citizens/violence")

        # Calculate new support rates
        support_by_party = {"dems": {}, "reps": {}}

        for col in VIOLENCE_COLS:
            dem_rate = calculate_support_rate(df, col, VIOLENCE_SUPPORT, "Democrat")
            rep_rate = calculate_support_rate(df, col, VIOLENCE_SUPPORT, "Republican")

            if dem_rate is not None:
                support_by_party["dems"][col] = dem_rate
            if rep_rate is not None:
                support_by_party["reps"][col] = rep_rate

            print(f"  {col}: Dems={dem_rate}%, Reps={rep_rate}%")

        # Update support_by_party (latest snapshot)
        violence_data["support_by_party"] = support_by_party

        # Update state aggregates
        for col in VIOLENCE_COLS:
            state_key = f"{col}_by_state"
            violence_data[state_key] = calculate_state_aggregates(
                df, col, VIOLENCE_SUPPORT
            )

        violence_data["violence_count_by_state"] = calculate_violence_count_by_state(df)

        # Add to time series
        if "support_by_party_over_time" not in violence_data:
            violence_data["support_by_party_over_time"] = {
                col: {"dates": [], "dems": [], "reps": []} for col in VIOLENCE_COLS
            }

        for col in VIOLENCE_COLS:
            ts = violence_data["support_by_party_over_time"][col]

            # Check if this date already exists
            if wave_date not in ts["dates"]:
                ts["dates"].append(wave_date)
                ts["dems"].append(support_by_party["dems"].get(col))
                ts["reps"].append(support_by_party["reps"].get(col))

        update_database(conn, "citizens/violence", violence_data, dry_run)

        # === UPDATE NORMS DATA ===
        print("\n--- Processing Norms Data ---")
        norms_data = get_existing_data(conn, "citizens/norms")

        norm_support_by_party = {"dems": {}, "reps": {}}

        for col in NORM_COLS:
            dem_rate = calculate_support_rate(df, col, NORM_SUPPORT, "Democrat")
            rep_rate = calculate_support_rate(df, col, NORM_SUPPORT, "Republican")

            if dem_rate is not None:
                norm_support_by_party["dems"][col] = dem_rate
            if rep_rate is not None:
                norm_support_by_party["reps"][col] = rep_rate

            print(f"  {col}: Dems={dem_rate}%, Reps={rep_rate}%")

        norms_data["norm_violation_support_by_party"] = norm_support_by_party

        # Update state aggregates
        for col in NORM_COLS:
            state_key = f"{col}_by_state"
            norms_data[state_key] = calculate_state_aggregates(df, col, NORM_SUPPORT)

        # Overall norms by state
        norms_data["norms_by_state"] = []  # Would need to calculate avg norm violations

        # Add to time series
        if "support_by_party_over_time" not in norms_data:
            norms_data["support_by_party_over_time"] = {
                col: {"dates": [], "dems": [], "reps": []} for col in NORM_COLS
            }

        for col in NORM_COLS:
            ts = norms_data["support_by_party_over_time"][col]

            if wave_date not in ts["dates"]:
                ts["dates"].append(wave_date)
                ts["dems"].append(norm_support_by_party["dems"].get(col))
                ts["reps"].append(norm_support_by_party["reps"].get(col))

        update_database(conn, "citizens/norms", norms_data, dry_run)

        # === UPDATE AFFPOL DATA ===
        print("\n--- Processing Affective Polarization Data ---")
        affpol_data = get_existing_data(conn, "citizens/affpol")

        # Calculate thermometer ratings by party
        dem_affpol = calculate_affpol(df, "Democrat")
        rep_affpol = calculate_affpol(df, "Republican")

        print(
            f"  Democrat thermometers: Dem={dem_affpol['dem_therm'] if dem_affpol else 'N/A'}, Rep={dem_affpol['rep_therm'] if dem_affpol else 'N/A'}"
        )
        print(
            f"  Republican thermometers: Dem={rep_affpol['dem_therm'] if rep_affpol else 'N/A'}, Rep={rep_affpol['rep_therm'] if rep_affpol else 'N/A'}"
        )

        # Update state aggregates
        affpol_data["affpol_by_state"] = calculate_affpol_by_state(df)

        # Add to time series
        # affpol_overtime has keys: dates, dems, reps, total
        if "affpol_overtime" not in affpol_data:
            affpol_data["affpol_overtime"] = {
                "dates": [],
                "dems": [],
                "reps": [],
                "total": [],
            }

        if "dem_therm_overtime" not in affpol_data:
            affpol_data["dem_therm_overtime"] = {"dates": [], "dems": [], "reps": []}

        if "rep_therm_overtime" not in affpol_data:
            affpol_data["rep_therm_overtime"] = {"dates": [], "dems": [], "reps": []}

        # Calculate party-specific affpol (inparty - outparty)
        dem_affpol_val = None
        rep_affpol_val = None
        if dem_affpol:
            dem_affpol_val = dem_affpol["dem_therm"] - dem_affpol["rep_therm"]
        if rep_affpol:
            rep_affpol_val = rep_affpol["rep_therm"] - rep_affpol["dem_therm"]

        # Calculate total affpol
        total_affpol = None
        if dem_affpol_val is not None and rep_affpol_val is not None:
            total_affpol = (dem_affpol_val + rep_affpol_val) / 2

        if wave_date not in affpol_data["affpol_overtime"]["dates"]:
            affpol_data["affpol_overtime"]["dates"].append(wave_date)
            affpol_data["affpol_overtime"]["dems"].append(
                round(dem_affpol_val, 1) if dem_affpol_val else None
            )
            affpol_data["affpol_overtime"]["reps"].append(
                round(rep_affpol_val, 1) if rep_affpol_val else None
            )
            affpol_data["affpol_overtime"]["total"].append(
                round(total_affpol, 1) if total_affpol else None
            )

        if wave_date not in affpol_data["dem_therm_overtime"]["dates"]:
            affpol_data["dem_therm_overtime"]["dates"].append(wave_date)
            affpol_data["dem_therm_overtime"]["dems"].append(
                dem_affpol["dem_therm"] if dem_affpol else None
            )
            affpol_data["dem_therm_overtime"]["reps"].append(
                rep_affpol["dem_therm"] if rep_affpol else None
            )

        if wave_date not in affpol_data["rep_therm_overtime"]["dates"]:
            affpol_data["rep_therm_overtime"]["dates"].append(wave_date)
            affpol_data["rep_therm_overtime"]["dems"].append(
                dem_affpol["rep_therm"] if dem_affpol else None
            )
            affpol_data["rep_therm_overtime"]["reps"].append(
                rep_affpol["rep_therm"] if rep_affpol else None
            )

        update_database(conn, "citizens/affpol", affpol_data, dry_run)

        # === UPDATE INTRO INFO ===
        print("\n--- Updating Intro Info ---")
        intro_info = get_existing_data(conn, "citizens/intro-info")

        wave_dt = datetime.strptime(wave_date, "%Y-%m-%d")
        intro_info["to-year"] = str(wave_dt.year)
        intro_info["to-month"] = wave_dt.strftime("%b").upper()

        # Update num_weeks based on time series length
        if "dates" in affpol_data.get("affpol_overtime", {}):
            intro_info["num_weeks"] = len(affpol_data["affpol_overtime"]["dates"])

        print(
            f"  Updated to: {intro_info['to-month']} {intro_info['to-year']}, {intro_info.get('num_weeks', 'N/A')} weeks"
        )

        update_database(conn, "citizens/intro-info", intro_info, dry_run)

        # === UPDATE INTRO GAUGES ===
        print("\n--- Updating Intro Gauges ---")
        gauges = get_existing_data(conn, "citizens/intro-gauges")

        # Calculate current values
        violence_avg = sum(
            support_by_party["dems"].get(col, 0) + support_by_party["reps"].get(col, 0)
            for col in VIOLENCE_COLS
        ) / (2 * len(VIOLENCE_COLS))
        norms_avg = sum(
            norm_support_by_party["dems"].get(col, 0)
            + norm_support_by_party["reps"].get(col, 0)
            for col in NORM_COLS
        ) / (2 * len(NORM_COLS))

        gauges["violence"] = {"val": round(violence_avg, 1), "val_change": 0}
        gauges["norms"] = {"val": round(norms_avg, 1), "val_change": 0}
        if total_affpol:
            gauges["affpol"] = {"val": round(total_affpol, 1), "val_change": 0}

        update_database(conn, "citizens/intro-gauges", gauges, dry_run)

        # === UPDATE LANDING-FULL (combines all data for frontend) ===
        print("\n--- Updating Landing Full ---")
        landing_full = get_existing_data(conn, "citizens/landing-full")

        # Update with the new data from individual endpoints
        landing_full["violence"] = violence_data
        landing_full["affpol"] = affpol_data
        landing_full["norms"] = norms_data
        landing_full["intro-info"] = intro_info
        landing_full["intro-gauges"] = gauges

        update_database(conn, "citizens/landing-full", landing_full, dry_run)

    finally:
        conn.close()

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Process US survey wave CSV")
    parser.add_argument("csv_file", help="Path to the labelled CSV file")
    parser.add_argument(
        "--dry-run",
        "-n",
        action="store_true",
        help="Show what would be done without making changes",
    )

    args = parser.parse_args()
    process_wave(args.csv_file, args.dry_run)


if __name__ == "__main__":
    main()
