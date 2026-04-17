"""Build the elites/landing endpoint data in pulse.data.

Reads from elite.classifications, elite.rhetoric, elite.officials.
Writes to pulse.data (endpoint = 'elites/landing').
"""

import datetime

import ibis
from ibis import _
import numpy as np

from pulse.build.db import (
    CATEGORIES,
    CATEGORY_LABELS,
    STATE_ABBR_TO_NAME,
    get_elite_connection,
    get_pulse_db,
    sanitize_for_json,
)


def _format_count(num: int) -> str:
    if num >= 1_000_000:
        return f"{num / 1_000_000:.1f} Million"
    elif num >= 1000:
        return f"{num // 1000}K"
    return str(num)


def build():
    conn = get_elite_connection()

    legislators = conn.table("officials").filter([_.active == 1, _.level == "national"])
    classifications = conn.table("classifications")

    data = {}

    # ── INTRO ────────────────────────────────────────────────────────
    data["intro"] = {}

    # Total classified count
    has_any = ibis.literal(False)
    for cat in CATEGORIES:
        has_any |= classifications[cat].notnull()
    count = classifications.filter(has_any).count().execute()
    data["intro"]["count"] = _format_count(count)

    now = datetime.datetime.now()
    data["intro"]["to-year"] = now.strftime("%Y")
    data["intro"]["to-month"] = now.strftime("%b").upper()
    data["intro"]["to-day"] = now.strftime("%d")

    # Overall category means
    summary_by_category = classifications.aggregate(
        **{cat + "_mean": (_[cat].mean() * 100).round(1) for cat in CATEGORIES}
    ).execute()
    data["intro"]["category-means"] = {
        cat: summary_by_category[cat + "_mean"].iloc[0] for cat in CATEGORIES
    }

    # ── CONGRESS ─────────────────────────────────────────────────────
    data["congress"] = {}

    # Over time (weekly, last year)
    one_year_ago = datetime.date.today() - datetime.timedelta(days=365)
    summary_over_time = (
        classifications.filter(_["date"] >= one_year_ago)
        .group_by(
            [_["date"].year().name("year"), _["date"].week_of_year().name("week")]
        )
        .aggregate(
            **{cat + "_mean": (_[cat].mean() * 100).round(1) for cat in CATEGORIES}
        )
        .order_by([_["year"], _["week"]])
        .execute()
        .replace({np.nan: None})
    )
    summary_over_time["date"] = summary_over_time.apply(
        lambda row: datetime.datetime.strptime(
            f"{int(row.year)}-{int(row.week)}-1", "%Y-%W-%w"
        ).strftime("%Y-%m-%d"),
        axis=1,
    )
    summary_over_time = summary_over_time.drop(["year", "week"], axis=1)
    summary_over_time = summary_over_time.rename(
        columns={cat + "_mean": CATEGORY_LABELS[cat] for cat in CATEGORIES}
    )
    data["congress"]["over_time"] = summary_over_time.to_dict(orient="list")

    # By party
    summary_by_party = (
        classifications.join(
            legislators, legislators.bioguide_id == classifications.bioguide_id
        )
        .group_by(_["party"])
        .aggregate(
            **{cat + "_mean": (_[cat].mean() * 100).round(1) for cat in CATEGORIES}
        )
        .execute()
    )

    def _party_row(party_name):
        row = summary_by_party[summary_by_party["party"] == party_name]
        if row.empty:
            return {cat + "_mean": None for cat in CATEGORIES}
        return row.drop(columns=["party"]).to_dict(orient="records")[0]

    data["congress"]["by_party"] = {
        "Congress": {
            "Republicans": _party_row("Republican"),
            "Democrats": _party_row("Democrat"),
            "Independents": _party_row("Independent"),
        },
    }

    # By type (House / Senate)
    summary_by_type = (
        classifications.join(
            legislators, legislators.bioguide_id == classifications.bioguide_id
        )
        .group_by(_["type"])
        .aggregate(
            **{cat + "_mean": (_[cat].mean() * 100).round(1) for cat in CATEGORIES}
        )
        .execute()
        .rename(columns={cat + "_mean": CATEGORY_LABELS[cat] for cat in CATEGORIES})
    )
    data["congress"]["by_type"] = {
        "House": summary_by_type[summary_by_type["type"] == "Representative"]
        .drop(columns=["type"])
        .to_dict(orient="records")[0],
        "Senate": summary_by_type[summary_by_type["type"] == "Senator"]
        .drop(columns=["type"])
        .to_dict(orient="records")[0],
    }

    # ── LEADERBOARDS ─────────────────────────────────────────────────
    legs_with_source_id = (
        conn.table("officials")
        .filter([_.active == 1, _.level == "national"])
        .mutate(
            source_id=ibis.cases(
                (_.level == "state", "S" + _.id.cast(str)),
                (_.level == "national", "N" + _.id.cast(str)),
            )
        )
    )
    rhetoric = conn.table("rhetoric")

    alldata = {}
    for cat in CATEGORIES:
        alldata[cat] = {}
        for party, key in [("Democrat", "dems"), ("Republican", "reps")]:
            ranks = (
                rhetoric.filter(
                    (rhetoric["source"] == "all") & rhetoric[f"{cat}_rank"].notnull()
                )
                .join(
                    legs_with_source_id,
                    legs_with_source_id.bioguide_id == _.bioguide_id,
                )
                .order_by((_[f"{cat}_rank"], True))
                .filter(_["party"] == party)
                .limit(5)
                .execute()
            ).to_dict(orient="records")

            alldata[cat][key] = [
                {
                    "first_name": r["first_name"],
                    "last_name": r["last_name"],
                    "count": int(r[f"{cat}_sum"]),
                    "percent": round(r[f"{cat}_mean"], 2),
                    "party": r["party"],
                    "rank": int(r[f"{cat}_rank"]),
                    "state": r["state"],
                    "district": r["district"],
                    "bioguide_id": r["bioguide_id"],
                    "source_id": r["source_id"],
                    "type": r["type"],
                }
                for r in ranks
            ]
    data["leaderboards"] = alldata

    # ── GEO ──────────────────────────────────────────────────────────
    summary_by_state = (
        classifications.join(
            legislators, legislators.bioguide_id == classifications.bioguide_id
        )
        .group_by(_["state"])
        .aggregate(
            **{cat + "_mean": (_[cat].mean() * 100).round(1) for cat in CATEGORIES}
        )
        .execute()
    )
    summary_by_state["state"] = summary_by_state["state"].map(STATE_ABBR_TO_NAME)
    summary_by_state = summary_by_state.set_index("state")

    data["geo"] = {}
    for cat in CATEGORIES:
        data["geo"][cat] = [
            {"name": state, "value": row[cat + "_mean"]}
            for state, row in summary_by_state.iterrows()
        ]

    # ── CATEGORIES OVER TIME (monthly) ───────────────────────────────
    summary_monthly = (
        classifications.join(
            legislators, legislators.bioguide_id == classifications.bioguide_id
        )
        .mutate(year=classifications.date.year(), month=classifications.date.month())
        .group_by([_["year"], _["month"]])
        .aggregate(
            **{cat + "_mean": (_[cat].mean() * 100).round(1) for cat in CATEGORIES}
        )
        .mutate(date=_["year"].cast("string") + "-" + _["month"].cast("string"))
        .execute()
        .replace({np.nan: None})
    )
    data["categories-over-time"] = {"dates": []}
    for cat in CATEGORIES:
        data["categories-over-time"][cat] = []

    for _idx, row in summary_monthly.iterrows():
        data["categories-over-time"]["dates"].append(row["date"])
        for cat in CATEGORIES:
            data["categories-over-time"][cat].append(row[f"{cat}_mean"])

    # ── SAVE ─────────────────────────────────────────────────────────
    data = sanitize_for_json(data)
    dbx = get_pulse_db()
    dbx["data"].upsert(
        {"endpoint": "elites/landing", "data": data},
        ["endpoint"],
    )
    dbx.engine.dispose()
    dbx.close()
    print(f"  Saved elites/landing ({data['intro']['count']} total classifications)")


if __name__ == "__main__":
    build()
