"""Build the pulse.federal_profiles table.

Reads from elite.officials, elite.rhetoric, elite.ideology, elite.efficacy,
elite.attendance, elite.money, elite.classifications.
Writes to pulse.federal_profiles (upsert on bioguide_id).
"""

import datetime
import json

from ibis import _
import numpy as np
import pandas as pd

from pulse.build.db import (
    CATEGORIES,
    CATEGORY_LABELS,
    get_elite_connection,
    get_pulse_db,
    sanitize_for_json,
)


def build():
    conn = get_elite_connection()

    # ── Load tables via ibis ─────────────────────────────────────────
    officials = (
        conn.table("officials")
        .filter([_.active == 1, _.level == "national"])
        .mutate(source_id="N" + _.id.cast(str))
    )

    ideology = conn.table("ideology")
    efficacy = conn.table("efficacy")
    attendance = conn.table("attendance")
    money = conn.table("money")
    rhetoric = conn.table("rhetoric").filter(_.source == "all")
    rhetoric_no_filter = conn.table("rhetoric")

    # Rename columns with prefixes (matching old build script)
    ideology = ideology.rename(
        **{
            f"ideology_{c}": c
            for c in ideology.columns
            if c not in ("id", "bioguide_id")
        }
    )
    efficacy = efficacy.rename(
        **{
            f"efficacy_{c}": c
            for c in efficacy.columns
            if c not in ("id", "bioguide_id")
        }
    )
    attendance = attendance.rename(
        **{
            f"attendance_{c}": c
            for c in attendance.columns
            if c not in ("id", "bioguide_id")
        }
    )
    money = money.rename(
        **{f"money_{c}": c for c in money.columns if c not in ("id", "bioguide_id")}
    )
    rhetoric = rhetoric.rename(
        **{
            f"communication_{c}": c
            for c in rhetoric.columns
            if c not in ("id", "bioguide_id")
        }
    )

    # Join everything
    profiles = (
        officials.select(
            [
                "first_name",
                "last_name",
                "gender",
                "state",
                "party",
                "government_website",
                "twitter_id",
                "facebook",
                "district",
                "type",
                "bioguide_id",
                "serving_public_since",
                "serving_position_since",
                "federal",
                "birthday",
                "source_id",
                "level",
            ]
        )
        .left_join(ideology, ideology.bioguide_id == _.bioguide_id)
        .drop(["id", "bioguide_id_right"])
        .left_join(efficacy, efficacy.bioguide_id == _.bioguide_id)
        .drop(["id", "bioguide_id_right"])
        .left_join(attendance, attendance.bioguide_id == _.bioguide_id)
        .drop(["id", "bioguide_id_right"])
        .left_join(money, money.bioguide_id == _.bioguide_id)
        .drop(["id", "bioguide_id_right"])
        .left_join(rhetoric, rhetoric.bioguide_id == _.bioguide_id)
        .drop(["id", "bioguide_id_right"])
        .execute()
    )

    # ── Image URL ────────────────────────────────────────────────────
    profiles["image_url"] = profiles["bioguide_id"].apply(
        lambda bid: (
            f"/elites/profiles/national/images/large/{bid}.jpg"
            if pd.notna(bid)
            else None
        )
    )

    # ── Next election ────────────────────────────────────────────────
    def _next_election(row):
        current_year = datetime.datetime.now().year
        current_date = datetime.datetime.now()
        if row["type"] == "Representative":
            if current_year % 2 == 0 and (
                current_date.month < 10
                or (current_date.month == 10 and current_date.day < 7)
            ):
                return current_year
            return current_year + (2 if current_year % 2 == 0 else 1)
        elif row["type"] == "Senator":
            federal = row.get("federal")
            if isinstance(federal, str):
                try:
                    federal = json.loads(federal)
                except (json.JSONDecodeError, TypeError):
                    return None
            if not isinstance(federal, dict):
                return None
            sc = federal.get("senate_class")
            if sc is None:
                return None
            base = {1: 2018, 2: 2020, 3: 2022}.get(sc, 2022)
            return current_year + (6 - (current_year - base) % 6)
        return None

    profiles["next_election"] = profiles.apply(_next_election, axis=1)

    # ── Communication scores (combined) ──────────────────────────────
    profiles["communication_scores"] = profiles.apply(
        lambda x: {
            cat: round(x[f"communication_{cat}_mean"], 2)
            if pd.notna(x.get(f"communication_{cat}_mean"))
            else None
            for cat in CATEGORIES
        },
        axis=1,
    )

    # ── Communication scores by source ───────────────────────────────
    rhetoric_all_sources = rhetoric_no_filter.execute().replace({np.nan: None})

    def _scores_by_source(row):
        person = rhetoric_all_sources[
            rhetoric_all_sources["bioguide_id"] == row["bioguide_id"]
        ]
        result = {}
        for source in person["source"].unique():
            source_row = person[person["source"] == source]
            result[source] = {}
            for cat in CATEGORIES:
                val = (
                    source_row[f"{cat}_mean"].iloc[0] if not source_row.empty else None
                )
                if pd.notna(val):
                    result[source][CATEGORY_LABELS[cat]] = round(float(val), 2)
                else:
                    result[source][CATEGORY_LABELS[cat]] = None
        # Compute in_press = avg of newsletters + statements
        if result:
            result["in_press"] = {}
            all_cats = result.get("all", {})
            for label in all_cats:
                nl = result.get("newsletters", {}).get(label)
                st = result.get("statements", {}).get(label)
                if nl is not None and st is not None:
                    result["in_press"][label] = round((nl + st) / 2, 2)
                elif nl is not None:
                    result["in_press"][label] = round(nl, 2)
                elif st is not None:
                    result["in_press"][label] = round(st, 2)
        return result

    profiles["communication_scores_by_source"] = profiles.apply(
        _scores_by_source, axis=1
    )

    # ── Recent posts ─────────────────────────────────────────────────
    posts_df = _fetch_federal_posts(conn)

    def _get_posts(row):
        person_posts = posts_df[posts_df["bioguide_id"] == row["bioguide_id"]]
        person_posts = person_posts.replace({np.nan: None})
        cols = [
            "url",
            "date",
            "text",
            "active",
            "policy",
            "source",
            "tweet_id",
            "attack_type",
            "policy_area",
            "truth_social",
            "attack_policy",
            "attack_target",
            "attack_personal",
            "attack_explanation",
            "policy_explanation",
            "outcome_bipartisanship",
            "outcome_creditclaiming",
            "bipartisanship_explanation",
            "creditclaiming_explanation",
        ]
        available = [c for c in cols if c in person_posts.columns]
        return person_posts[available].to_dict(orient="records")

    profiles["posts"] = profiles.apply(_get_posts, axis=1)

    # ── Clean and save ───────────────────────────────────────────────
    for col in profiles.columns:
        profiles[col] = profiles[col].apply(
            lambda x: (
                x.isoformat() if isinstance(x, (pd.Timestamp, datetime.datetime)) else x
            )
        )

    profiles = profiles.replace({pd.NaT: None, np.nan: None, "NaT": None})
    data_list = json.loads(profiles.to_json(orient="records", date_format="iso"))
    data_list = sanitize_for_json(data_list)

    dbx = get_pulse_db()
    dbx["federal_profiles"].upsert_many(data_list, "bioguide_id")
    dbx.engine.dispose()
    dbx.close()
    print(f"  Saved {len(data_list)} federal profiles")


def _fetch_federal_posts(conn):
    """Fetch the 5 most recent posts per category per federal legislator."""
    result = conn.raw_sql("""
        WITH RankedClassifications AS (
            SELECT
                c.*,
                ROW_NUMBER() OVER (
                    PARTITION BY c.bioguide_id,
                        CASE
                            WHEN c.attack_personal = 1 THEN 'attack_personal'
                            WHEN c.attack_policy = 1 THEN 'attack_policy'
                            WHEN c.policy = 1 THEN 'policy'
                            WHEN c.outcome_creditclaiming = 1 THEN 'outcome_creditclaiming'
                            WHEN c.outcome_bipartisanship = 1 THEN 'outcome_bipartisanship'
                        END
                    ORDER BY c.date DESC
                ) AS row_num
            FROM classifications c
        )
        SELECT
            o.bioguide_id,
            c.*,
            ts.tweet_id
        FROM (
            SELECT bioguide_id
            FROM officials
            WHERE level = 'national' AND active = 1
        ) o
        JOIN RankedClassifications c
            ON o.bioguide_id = c.bioguide_id
        LEFT JOIN tweets ts
            ON c.source = 'tweets' AND c.source_id = ts.id
        WHERE c.row_num <= 5
        ORDER BY o.bioguide_id, c.date DESC
    """)

    df = pd.DataFrame(result.fetchall(), columns=[d[0] for d in result.description])
    df = df.loc[:, ~df.columns.duplicated()]
    df["date"] = df["date"].astype(str)
    df["url"] = df["tweet_id"].apply(
        lambda tid: f"https://x.com/0/status/{int(tid)}" if pd.notna(tid) else None
    )
    return df


if __name__ == "__main__":
    build()
