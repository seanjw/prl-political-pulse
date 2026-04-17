"""Build the pulse.state_profiles table.

Reads from elite.officials, elite.openstates, elite.rhetoric_state,
elite.classifications.
Writes to pulse.state_profiles (upsert on source_id).
"""

import json

from ibis import _
import numpy as np
import pandas as pd

from pulse.build.db import (
    get_elite_connection,
    get_pulse_db,
    sanitize_for_json,
)


def build():
    conn = get_elite_connection()

    openstates = conn.table("openstates").select([_.openstates_id, _.openstates_data])

    officials = (
        conn.table("officials")
        .filter([_.active == 1, _.level == "state"])
        .mutate(source_id="S" + _.id.cast(str))
    )

    # Join officials with openstates
    officials = officials.join(
        openstates,
        openstates.openstates_id == officials.openstates_id,
        how="inner",
    )

    officials_data = officials.execute()

    # ── Rhetoric scores ──────────────────────────────────────────────
    rhetoric = conn.table("rhetoric_state").filter(_.source == "all").execute()

    # Build rhetoric dict per row (all columns except id)
    def _to_rhetoric_dict(row):
        d = row.to_dict()
        d.pop("id", None)
        return {k: (None if pd.isna(v) else v) for k, v in d.items()}

    rhetoric["rhetoric"] = rhetoric.apply(_to_rhetoric_dict, axis=1)

    officials_data = pd.merge(
        officials_data,
        rhetoric[["openstates_id", "rhetoric"]],
        on="openstates_id",
        how="left",
    )

    officials_data["rhetoric"] = officials_data["rhetoric"].apply(
        lambda r: (
            {k: (None if pd.isna(v) else v) for k, v in r.items()}
            if isinstance(r, dict)
            else None
        )
    )

    # ── Image URL ────────────────────────────────────────────────────
    officials_data["image_url"] = officials_data["openstates_id"].apply(
        lambda oid: (
            f"/elites/profiles/state/images/{oid.replace('ocd-person/', '')}.jpg"
            if pd.notna(oid)
            else None
        )
    )

    # ── Recent posts ─────────────────────────────────────────────────
    posts_df = _fetch_state_posts(conn)

    def _get_posts(row):
        person_posts = posts_df[posts_df["openstates_id"] == row["openstates_id"]]
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

    officials_data["posts"] = officials_data.apply(_get_posts, axis=1)

    # ── Clean and save ───────────────────────────────────────────────
    officials_data["type"] = officials_data["position"]

    output_cols = [
        "source_id",
        "gender",
        "state",
        "title",
        "party",
        "email",
        "government_website",
        "campaign_website",
        "linkedin",
        "twitter_handle",
        "twitter_id",
        "facebook",
        "instagram",
        "youtube",
        "truth_social",
        "position",
        "level",
        "district",
        "tiktok",
        "type",
        "birthday",
        "name",
        "rhetoric",
        "image_url",
        "posts",
    ]
    available_cols = [c for c in output_cols if c in officials_data.columns]
    officials_data = officials_data[available_cols]

    officials_data = officials_data.replace({pd.NaT: None, np.nan: None})

    records = json.loads(officials_data.to_json(orient="records", date_format="iso"))
    records = sanitize_for_json(records)

    dbx = get_pulse_db()
    dbx["state_profiles"].upsert_many(records, "source_id")

    # Also update image_url in legislators table
    image_records = [
        {"source_id": r["source_id"], "image_url": r.get("image_url")} for r in records
    ]
    dbx["legislators"].upsert_many(image_records, "source_id")

    dbx.engine.dispose()
    dbx.close()
    print(f"  Saved {len(records)} state profiles")


def _fetch_state_posts(conn):
    """Fetch the 5 most recent posts per category per state legislator."""
    result = conn.raw_sql("""
        WITH RankedClassifications AS (
            SELECT
                c.*,
                ROW_NUMBER() OVER (
                    PARTITION BY c.openstates_id,
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
            o.openstates_id,
            c.*,
            ts.tweet_id
        FROM (
            SELECT openstates_id
            FROM officials
            WHERE level = 'state' AND active = 1
        ) o
        JOIN RankedClassifications c
            ON o.openstates_id = c.openstates_id
        LEFT JOIN tweets_state ts
            ON c.source = 'tweets_state' AND c.source_id = ts.id
        WHERE c.row_num <= 5
        ORDER BY o.openstates_id, c.date DESC
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
