"""Build static rankings JSON and awards JSON, upload to S3.

Reads from pulse.legislators (already built by build_legislators).
Uploads:
  - data/elite/rankings.json  (full rankings for all legislators)
  - data/elite/awards.json    (award pills per legislator, small file)
"""

import json
import os

import boto3

from pulse.build.db import (
    CATEGORIES,
    CATEGORY_LABELS,
    get_pulse_db,
    sanitize_for_json,
    STATE_ABBR_TO_NAME,
)

S3_BUCKET = os.environ["S3_BUCKET"]
S3_RANKINGS_KEY = "data/elite/rankings.json"
S3_AWARDS_KEY = "data/elite/awards.json"

# Top/bottom 3% threshold for awards
AWARD_PERCENTILE = 0.03

# Award definitions: (category_key, direction, award_name, award_type, description)
POSITIVE_AWARDS = [
    (
        "policy",
        "top",
        "Policy Discussion Leader",
        "positive",
        "Top 3% in policy discussion",
    ),
    (
        "attack_policy",
        "top",
        "Policy Criticism Leader",
        "positive",
        "Top 3% in policy criticism",
    ),
    (
        "outcome_creditclaiming",
        "top",
        "Accomplishments Leader",
        "positive",
        "Top 3% in accomplishments",
    ),
    (
        "outcome_bipartisanship",
        "top",
        "Bipartisanship Leader",
        "positive",
        "Top 3% in bipartisan rhetoric",
    ),
    (
        "attack_personal",
        "bottom",
        "Most Civil",
        "positive",
        "Bottom 3% in personal attacks",
    ),
]

NEGATIVE_AWARDS = [
    (
        "policy",
        "bottom",
        "Least Policy-Focused",
        "negative",
        "Bottom 3% in policy discussion",
    ),
    (
        "attack_policy",
        "bottom",
        "Least Policy-Critical",
        "negative",
        "Bottom 3% in policy criticism",
    ),
    (
        "outcome_creditclaiming",
        "bottom",
        "Fewest Accomplishments",
        "negative",
        "Bottom 3% in accomplishment claims",
    ),
    (
        "outcome_bipartisanship",
        "bottom",
        "Least Bipartisan",
        "negative",
        "Bottom 3% in bipartisan rhetoric",
    ),
    ("attack_personal", "top", "Least Civil", "negative", "Top 3% in personal attacks"),
]


def _compute_awards(legislators):
    """Compute awards for a list of legislators based on score percentiles."""
    n = len(legislators)
    if n == 0:
        return {}

    threshold = max(int(n * AWARD_PERCENTILE), 1)
    awards_map = {}  # source_id -> [award, ...]

    for cat in CATEGORIES:
        # Sort by score descending
        scored = [
            (leg["source_id"], leg["scores"].get(cat) or 0) for leg in legislators
        ]
        scored.sort(key=lambda x: x[1], reverse=True)

        top_ids = {sid for sid, _ in scored[:threshold]}
        bottom_ids = {sid for sid, _ in scored[-threshold:]}

        all_awards = POSITIVE_AWARDS + NEGATIVE_AWARDS
        for cat_key, direction, name, award_type, description in all_awards:
            if cat_key != cat:
                continue
            ids = top_ids if direction == "top" else bottom_ids
            for sid in ids:
                awards_map.setdefault(sid, []).append(
                    {
                        "name": name,
                        "type": award_type,
                        "category": CATEGORY_LABELS[cat_key],
                        "description": description,
                    }
                )

    # Special award: zero personal attacks
    for leg in legislators:
        score = leg["scores"].get("attack_personal") or 0
        if score == 0:
            awards_map.setdefault(leg["source_id"], []).append(
                {
                    "name": "Zero Personal Attacks",
                    "type": "special",
                    "category": "Personal Attacks",
                    "description": "Zero personal attacks across all tracked statements",
                }
            )

    return awards_map


def build():
    dbx = get_pulse_db()
    rows = list(dbx["legislators"].all())
    dbx.engine.dispose()
    dbx.close()

    national = []
    state = []

    for row in rows:
        scores = row.get("scores")
        if isinstance(scores, str):
            scores = json.loads(scores)
        if not scores:
            continue

        state_abbr = row.get("state") or ""
        entry = {
            "source_id": row["source_id"],
            "name": row.get("name")
            or f"{row.get('first_name', '')} {row.get('last_name', '')}".strip(),
            "party": row.get("party"),
            "state": STATE_ABBR_TO_NAME.get(state_abbr, state_abbr),
            "type": row.get("type"),
            "image_url": row.get("image_url"),
            "scores": scores,
        }

        level = row.get("level", "")
        if level == "national" or (row.get("source_id") or "").startswith("N"):
            national.append(entry)
        else:
            state.append(entry)

    # ── Rankings JSON ────────────────────────────────────────────────
    rankings_data = sanitize_for_json({"national": national, "state": state})
    rankings_payload = json.dumps(rankings_data, separators=(",", ":"))

    s3 = boto3.client("s3")
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=S3_RANKINGS_KEY,
        Body=rankings_payload,
        ContentType="application/json",
        CacheControl="max-age=3600",
    )
    print(
        f"  Uploaded {S3_RANKINGS_KEY}: "
        f"{len(national)} national, {len(state)} state legislators "
        f"({len(rankings_payload) // 1024} KB)"
    )

    # ── Awards JSON ──────────────────────────────────────────────────
    national_awards = _compute_awards(national)
    state_awards = _compute_awards(state)
    all_awards = {**national_awards, **state_awards}

    awards_payload = json.dumps(sanitize_for_json(all_awards), separators=(",", ":"))
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=S3_AWARDS_KEY,
        Body=awards_payload,
        ContentType="application/json",
        CacheControl="max-age=3600",
    )

    total_awarded = len(all_awards)
    total_awards = sum(len(v) for v in all_awards.values())
    print(
        f"  Uploaded {S3_AWARDS_KEY}: "
        f"{total_awarded} legislators with {total_awards} awards "
        f"({len(awards_payload) // 1024} KB)"
    )


if __name__ == "__main__":
    build()
