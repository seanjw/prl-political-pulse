"""Build the pulse.legislators table.

Reads from elite.officials, elite.rhetoric, elite.rhetoric_state.
Writes to pulse.legislators (upsert on source_id, delete inactive).
"""

import json

import ibis
from ibis import _
import numpy as np
import pandas as pd

from pulse.build.db import (
    CATEGORIES,
    STATE_ABBR_TO_NAME,
    get_elite_connection,
    get_pulse_db,
    sanitize_for_json,
)


def build():
    conn = get_elite_connection()

    # All active officials with source_id
    officials = (
        conn.table("officials")
        .filter(_.active == 1)
        .mutate(
            source_id=ibis.cases(
                (_.level == "state", "S" + _.id.cast(str)),
                (_.level == "national", "N" + _.id.cast(str)),
            )
        )
        .execute()
    )

    # Build name: state officials already have a name col; federal do not
    officials["name"] = officials.apply(
        lambda x: (
            x["name"]
            if x["level"] == "state" and pd.notna(x.get("name"))
            else f"{x['first_name']} {x['last_name']}"
        ),
        axis=1,
    )

    # State officials: use position as type (lower/upper/legislature)
    officials.loc[officials["level"] == "state", "type"] = officials.loc[
        officials["level"] == "state", "position"
    ]

    # Map state abbreviation to full name
    officials["state_name"] = officials["state"].map(STATE_ABBR_TO_NAME)

    # Normalise level to match pulse schema
    officials["level"] = officials["level"].replace({"national": "national"})

    # ── Federal rhetoric scores (keyed by bioguide_id) ───────────────
    rhetoric_fed = conn.table("rhetoric").filter(_.source == "all").execute()
    rhetoric_fed_scores = {}
    for _idx, r in rhetoric_fed.iterrows():
        scores = {}
        for cat in CATEGORIES:
            val = r.get(f"{cat}_mean")
            scores[cat] = round(float(val), 2) if pd.notna(val) else None
        rhetoric_fed_scores[r["bioguide_id"]] = scores

    # ── State rhetoric scores (keyed by openstates_id) ───────────────
    rhetoric_state = conn.table("rhetoric_state").filter(_.source == "all").execute()
    rhetoric_state_scores = {}
    for _idx, r in rhetoric_state.iterrows():
        scores = {}
        for cat in CATEGORIES:
            val = r.get(f"{cat}_mean")
            scores[cat] = round(float(val), 2) if pd.notna(val) else None
        rhetoric_state_scores[r["openstates_id"]] = scores

    # Build scores column
    def get_scores(row):
        if row["level"] == "national":
            return rhetoric_fed_scores.get(row["bioguide_id"])
        else:
            return rhetoric_state_scores.get(row.get("openstates_id"))

    officials["scores"] = officials.apply(get_scores, axis=1)

    # Image URLs
    def get_image_url(row):
        if row["level"] == "national" and pd.notna(row.get("bioguide_id")):
            return f"/elites/profiles/national/images/small/{row['bioguide_id']}.jpg"
        elif row["level"] == "state" and pd.notna(row.get("openstates_id")):
            oid = row["openstates_id"].replace("ocd-person/", "")
            return f"/elites/profiles/state/images/{oid}.jpg"
        return None

    officials["image_url"] = officials.apply(get_image_url, axis=1)

    # Select columns matching pulse.legislators schema
    out = officials[
        [
            "source_id",
            "bioguide_id",
            "first_name",
            "last_name",
            "party",
            "state",
            "scores",
            "type",
            "state_name",
            "level",
            "name",
            "image_url",
        ]
    ].copy()

    out = out.replace({np.nan: None, pd.NaT: None})

    # Serialise scores dict properly
    out["scores"] = out["scores"].apply(
        lambda x: sanitize_for_json(x) if isinstance(x, dict) else None
    )

    records = json.loads(out.to_json(orient="records", date_format="iso"))
    records = sanitize_for_json(records)

    # Save
    dbx = get_pulse_db()

    # Remove inactive legislators
    source_ids = [r["source_id"] for r in records]
    dbx["legislators"].delete(source_id={"notin": source_ids})

    # Upsert all
    dbx["legislators"].upsert_many(records, ["source_id"])
    dbx.engine.dispose()
    dbx.close()
    print(f"  Saved {len(records)} legislators")


if __name__ == "__main__":
    build()
