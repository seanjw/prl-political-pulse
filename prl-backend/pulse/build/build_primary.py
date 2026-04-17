"""Build the pulse primary/challenger dashboard data.

Reads from elite.challengers, elite.rhetoric, elite.classifications_challengers,
elite.tweets_challengers, elite.classifications, elite.tweets.
Writes to pulse.data (primary/landing, primary/state/{XX}) and
pulse.primary_statements.
"""

import math
import os
from collections import defaultdict

import boto3

from pulse.build.db import (
    STATE_ABBR_TO_NAME,
    get_elite_db,
    get_pulse_db,
    sanitize_for_json,
)

# Map backend category column names to frontend category names
CATEGORY_MAP = {
    "outcome_creditclaiming": "accomplishments",
    "outcome_bipartisanship": "bipartisanship",
    "policy": "policy",
    "attack_policy": "attack_policy",
    "attack_personal": "attack_personal",
}

# Competitive race IDs — must match prl-frontend/src/config/competitiveRaces.ts
COMPETITIVE_RACE_IDS = {
    # House - Lean D
    "CA-13", "CA-45", "FL-23", "MI-8", "NE-2", "NJ-9", "NM-2", "NV-3",
    "NY-3", "NY-4", "NY-19", "OH-13", "TX-28", "VA-7",
    # House - Toss Up
    "AZ-1", "AZ-6", "CA-22", "CA-48", "CO-8", "IA-1", "IA-3", "MI-7",
    "NJ-7", "NY-17", "OH-1", "OH-9", "PA-7", "PA-10", "TX-34", "VA-2",
    "WA-3", "WI-3",
    # House - Lean R
    "MI-10", "NC-1", "PA-8", "VA-1",
    # Senate
    "NH-S", "GA-S", "ME-S", "MI-S", "NC-S", "AK-S", "OH-S",
}  # fmt: skip

AWARD_NAMES = {
    "policy": {"top": "Policy Discussion Leader", "bottom": "Least Policy-Focused"},
    "attack_policy": {
        "top": "Policy Criticism Leader",
        "bottom": "Least Policy-Critical",
    },
    "accomplishments": {
        "top": "Accomplishments Leader",
        "bottom": "Fewest Accomplishment Claims",
    },
    "bipartisanship": {"top": "Bipartisanship Leader", "bottom": "Least Bipartisan"},
    "attack_personal": {
        "top": "Least Civil Candidate",
        "bottom": "Most Civil Candidate",
    },
}
AWARDS_MIN_STATEMENTS = 50
AWARDS_PERCENTILE = 0.03

ORDINAL_SUFFIXES = {
    1: "st", 2: "nd", 3: "rd",
    21: "st", 22: "nd", 23: "rd",
    31: "st", 32: "nd", 33: "rd",
    41: "st", 42: "nd", 43: "rd",
    51: "st", 52: "nd", 53: "rd",
}  # fmt: skip


def _ordinal(n):
    """Return ordinal string for a district number (e.g. 1 -> '1st')."""
    try:
        n = int(n)
    except (ValueError, TypeError):
        return str(n)
    return f"{n}{ORDINAL_SUFFIXES.get(n, 'th')}"


def _make_race_id(state, office, district):
    if office == "S":
        return f"{state}-S"
    return f"{state}-{district or 'AL'}"


def _make_display_name(state, office, district):
    state_name = STATE_ABBR_TO_NAME.get(state, state)
    if office == "S":
        return f"{state_name} Senate"
    if district and district != "AL":
        return f"{state_name} {_ordinal(district)}"
    return f"{state_name} At-Large"


def _quote_ids(ids):
    """Quote a list of string IDs for safe SQL IN clause embedding."""
    return ",".join(f"'{v}'" for v in ids)


def _safe_int(val):
    """Convert to int, return None if not possible."""
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _safe_float(val):
    """Convert to float rounded to 1 decimal, return None if not possible."""
    if val is None:
        return None
    try:
        return round(float(val), 1)
    except (ValueError, TypeError):
        return None


def _safe_date(val):
    """Convert to date string, return None if not possible."""
    if val is None:
        return None
    return str(val)


def _strip_nulls(obj):
    """Remove keys with None values from dicts, recursively."""
    if isinstance(obj, dict):
        return {k: _strip_nulls(v) for k, v in obj.items() if v is not None}
    elif isinstance(obj, list):
        return [_strip_nulls(v) for v in obj]
    return obj


def _compute_awards(candidates):
    """Compute awards for top/bottom 3% of candidates in each rhetoric category."""
    eligible = [
        c
        for c in candidates
        if c.get("rhetoric_data_available")
        and c.get("statement_count", 0) >= AWARDS_MIN_STATEMENTS
    ]
    if not eligible:
        return [], {}

    awards_list = []
    awards_by_candidate = defaultdict(list)
    n = len(eligible)
    cutoff = max(1, math.ceil(n * AWARDS_PERCENTILE))

    for cat in CATEGORY_MAP.values():
        sorted_cands = sorted(
            eligible, key=lambda c: c["rhetoric"].get(cat, 0), reverse=True
        )
        top_cands = sorted_cands[:cutoff]
        bottom_cands = sorted_cands[-cutoff:]

        for c in top_cands:
            award_type = "top"
            award = {
                "category": cat,
                "type": award_type,
                "award_name": AWARD_NAMES[cat]["top"],
                "candidate_id": c["candidate_id"],
                "name": c["name"],
                "party": c["party"],
                "state": c["state"],
                "office": c["office"],
                "district": c["district"],
                "race_id": c["race_id"],
                "value": c["rhetoric"].get(cat, 0),
                "statement_count": c["statement_count"],
            }
            awards_list.append(award)
            awards_by_candidate[c["candidate_id"]].append(
                {
                    "category": cat,
                    "type": award_type,
                    "award_name": AWARD_NAMES[cat]["top"],
                }
            )

        for c in bottom_cands:
            award_type = "bottom"
            award = {
                "category": cat,
                "type": award_type,
                "award_name": AWARD_NAMES[cat]["bottom"],
                "candidate_id": c["candidate_id"],
                "name": c["name"],
                "party": c["party"],
                "state": c["state"],
                "office": c["office"],
                "district": c["district"],
                "race_id": c["race_id"],
                "value": c["rhetoric"].get(cat, 0),
                "statement_count": c["statement_count"],
            }
            awards_list.append(award)
            awards_by_candidate[c["candidate_id"]].append(
                {
                    "category": cat,
                    "type": award_type,
                    "award_name": AWARD_NAMES[cat]["bottom"],
                }
            )

        # Special zero personal attacks badge
        if cat == "attack_personal":
            for c in eligible:
                if c["rhetoric"].get("attack_personal", 1) == 0.0:
                    award = {
                        "category": "attack_personal",
                        "type": "zero_attacks",
                        "award_name": "Zero Personal Attacks",
                        "candidate_id": c["candidate_id"],
                        "name": c["name"],
                        "party": c["party"],
                        "state": c["state"],
                        "office": c["office"],
                        "district": c["district"],
                        "race_id": c["race_id"],
                        "value": 0.0,
                        "statement_count": c["statement_count"],
                    }
                    awards_list.append(award)
                    # Only add if not already there from bottom 3%
                    existing_types = {
                        a["type"]
                        for a in awards_by_candidate[c["candidate_id"]]
                        if a["category"] == "attack_personal"
                    }
                    if "zero_attacks" not in existing_types:
                        awards_by_candidate[c["candidate_id"]].append(
                            {
                                "category": "attack_personal",
                                "type": "zero_attacks",
                                "award_name": "Zero Personal Attacks",
                            }
                        )

    print(
        f"  Computed {len(awards_list)} awards for {len(awards_by_candidate)} candidates"
    )
    return awards_list, dict(awards_by_candidate)


def build_candidates_and_races():
    """Build primary/landing and primary/state/{XX} JSON, write to pulse.data."""
    elite_db = get_elite_db()

    # 1. Load active challengers
    challengers = list(elite_db["challengers"].find(active=True))
    print(f"  Loaded {len(challengers)} active challengers")

    if not challengers:
        elite_db.engine.dispose()
        elite_db.close()
        print("  No active challengers found, skipping")
        return

    # 1b. Load primary winners
    winners_by_race = defaultdict(set)
    try:
        winner_rows = elite_db.query(
            "SELECT candidate_id, race_id FROM primary_winners"
        )
        for w in winner_rows:
            winners_by_race[w["race_id"]].add(w["candidate_id"])
        if winners_by_race:
            print(f"  Loaded winners for {len(winners_by_race)} called races")
    except Exception as e:
        print(f"  Warning: could not load primary_winners: {e}")

    # 2. Fetch incumbent rhetoric from elite.rhetoric (source='all')
    incumbent_ids = [
        c["bioguide_id"]
        for c in challengers
        if c.get("incumbent_challenge") == "I" and c.get("bioguide_id")
    ]
    incumbent_rhetoric = {}
    if incumbent_ids:
        quoted = _quote_ids(incumbent_ids)
        rows = elite_db.query(
            f"""
            SELECT bioguide_id,
                   attack_personal_mean, attack_policy_mean,
                   policy_mean, outcome_creditclaiming_mean,
                   outcome_bipartisanship_mean, count
            FROM rhetoric
            WHERE source = 'all' AND bioguide_id IN ({quoted})
            """
        )
        for r in rows:
            incumbent_rhetoric[r["bioguide_id"]] = dict(r)

    # 3. Fetch challenger/open-seat rhetoric from classifications_challengers
    challenger_ids = [
        c["candidate_id"]
        for c in challengers
        if c.get("incumbent_challenge") in ("C", "O")
    ]
    challenger_rhetoric = {}
    if challenger_ids:
        quoted = _quote_ids(challenger_ids)
        rows = elite_db.query(
            f"""
            SELECT candidate_id,
                   AVG(attack_personal) AS attack_personal_mean,
                   AVG(attack_policy) AS attack_policy_mean,
                   AVG(policy) AS policy_mean,
                   AVG(outcome_creditclaiming) AS outcome_creditclaiming_mean,
                   AVG(outcome_bipartisanship) AS outcome_bipartisanship_mean,
                   COUNT(*) AS statement_count
            FROM classifications_challengers
            WHERE classified = 1 AND candidate_id IN ({quoted})
            GROUP BY candidate_id
            """
        )
        for r in rows:
            challenger_rhetoric[r["candidate_id"]] = dict(r)

    # 4. Fetch tweet engagement stats per candidate
    all_candidate_ids = [c["candidate_id"] for c in challengers]
    tweet_stats = {}
    if all_candidate_ids:
        quoted = _quote_ids(all_candidate_ids)
        rows = elite_db.query(
            f"""
            SELECT candidate_id,
                   MAX(follower_count) AS follower_count,
                   MIN(date) AS first_tweet_date,
                   MAX(date) AS last_tweet_date,
                   COUNT(*) AS tweet_count,
                   ROUND(AVG(JSON_EXTRACT(public_metrics, '$.like_count')), 1) AS avg_likes,
                   ROUND(AVG(JSON_EXTRACT(public_metrics, '$.retweet_count')), 1) AS avg_retweets,
                   ROUND(AVG(JSON_EXTRACT(public_metrics, '$.impression_count')), 0) AS avg_impressions
            FROM tweets_challengers
            WHERE candidate_id IN ({quoted})
            GROUP BY candidate_id
            """
        )
        for r in rows:
            tweet_stats[r["candidate_id"]] = dict(r)

    # 5. Fetch incumbent official data (gender, birthday, serving_since, gov website)
    incumbent_officials = {}
    if incumbent_ids:
        quoted = _quote_ids(incumbent_ids)
        rows = elite_db.query(
            f"""
            SELECT bioguide_id, government_website, gender, birthday,
                   serving_public_since, serving_position_since, facebook
            FROM officials
            WHERE bioguide_id IN ({quoted})
            """
        )
        for r in rows:
            incumbent_officials[r["bioguide_id"]] = dict(r)

    # 5b. Find incumbents missing from challengers and inject from officials
    # Build set of races that already have an incumbent
    races_with_incumbent = set()
    for c in challengers:
        if c.get("incumbent_challenge") == "I":
            rid = _make_race_id(
                c.get("state", ""), c.get("office", ""), c.get("district")
            )
            races_with_incumbent.add(rid)

    # Build set of races that have at least one challenger (incumbent_challenge='C'),
    # meaning an incumbent exists but wasn't listed in the challengers table.
    # Open-seat races (all candidates are 'O') should NOT get an injected incumbent.
    races_with_challenger = set()
    for c in challengers:
        if c.get("incumbent_challenge") == "C":
            rid = _make_race_id(
                c.get("state", ""), c.get("office", ""), c.get("district")
            )
            races_with_challenger.add(rid)

    # Find races that have challengers but no incumbent listed
    races_needing_incumbent = races_with_challenger - races_with_incumbent
    if races_needing_incumbent:
        # Query all active federal officials
        rows = elite_db.query(
            """
            SELECT bioguide_id, first_name, last_name, party, state,
                   district, type, government_website, gender, birthday,
                   serving_public_since, serving_position_since, facebook,
                   twitter_id
            FROM officials
            WHERE level = 'national' AND active = 1
            """
        )
        officials_by_race = {}
        for r in rows:
            off = dict(r)
            s = off.get("state", "")
            t = off.get("type", "")
            d = off.get("district", "")
            if t == "Senator":
                rid = f"{s}-S"
            elif t == "Representative":
                rid = f"{s}-{d or 'AL'}"
            else:
                continue
            officials_by_race.setdefault(rid, []).append(off)

        injected = 0
        for rid in races_needing_incumbent:
            officials_for_race = officials_by_race.get(rid, [])
            for off in officials_for_race:
                bio_id = off["bioguide_id"]
                name = f"{off.get('first_name', '')} {off.get('last_name', '')}".strip()
                party = off.get("party", "")
                state = off.get("state", "")
                office = "S" if off.get("type") == "Senator" else "H"
                district = off.get("district", "") if office == "H" else ""

                # Use bioguide_id as candidate_id for injected incumbents
                synthetic = {
                    "candidate_id": bio_id,
                    "bioguide_id": bio_id,
                    "name": name,
                    "party": party,
                    "state": state,
                    "office": office,
                    "district": district,
                    "incumbent_challenge": "I",
                    "twitter_handle": off.get("twitter_id"),
                    "campaign_website": None,
                    "active": True,
                }
                challengers.append(synthetic)

                # Fetch rhetoric for this incumbent
                rhet_rows = elite_db.query(
                    f"""
                    SELECT attack_personal_mean, attack_policy_mean,
                           policy_mean, outcome_creditclaiming_mean,
                           outcome_bipartisanship_mean, count
                    FROM rhetoric
                    WHERE source = 'all' AND bioguide_id = '{bio_id}'
                    """
                )
                for rr in rhet_rows:
                    incumbent_rhetoric[bio_id] = dict(rr)

                # Add official data
                incumbent_officials[bio_id] = off
                incumbent_ids.append(bio_id)
                injected += 1

        print(f"  Injected {injected} incumbents from officials table")

    # 6. Fetch financial data from challenger_money (for all candidates incl. injected)
    all_candidate_ids = [c["candidate_id"] for c in challengers]
    challenger_money = {}
    if all_candidate_ids:
        quoted = _quote_ids(all_candidate_ids)
        try:
            rows = elite_db.query(
                f"""
                SELECT candidate_id, total_receipts, total_disbursements,
                       cash_on_hand, debts_owed, individual_contributions,
                       pac_contributions, party_contributions,
                       candidate_contributions, candidate_loans,
                       coverage_end_date, total_receipts_rank, race_rank
                FROM challenger_money
                WHERE candidate_id IN ({quoted})
                """
            )
            for r in rows:
                challenger_money[r["candidate_id"]] = dict(r)
            print(f"  Loaded financial data for {len(challenger_money)} candidates")
        except Exception as e:
            print(f"  Warning: could not load challenger_money: {e}")

    elite_db.engine.dispose()
    elite_db.close()

    # 6b. Scan S3 for candidate profile images (candidate_id -> S3 path)
    candidate_images = {}
    try:
        s3 = boto3.client("s3", region_name="us-east-1")
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(
            Bucket=os.environ["S3_BUCKET"], Prefix="primary/images/"
        ):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                filename = key.rsplit("/", 1)[-1]
                basename = filename.rsplit(".", 1)[0]
                candidate_images[basename] = f"/{key}"
        print(f"  Found {len(candidate_images)} candidate images in S3")
    except Exception as e:
        print(f"  Warning: could not scan S3 for candidate images: {e}")

    # 7. Build candidate objects
    candidates = []
    for c in challengers:
        rhetoric = {}
        statement_count = 0
        ic = c.get("incumbent_challenge", "")

        if ic == "I" and c.get("bioguide_id"):
            rdata = incumbent_rhetoric.get(c["bioguide_id"], {})
            for backend_cat, frontend_cat in CATEGORY_MAP.items():
                val = rdata.get(f"{backend_cat}_mean")
                if val is not None:
                    rhetoric[frontend_cat] = round(float(val), 4)
            # rhetoric table stores percentages (0-100); normalise to 0-1
            # to match challenger scale (AVG of binary classifications)
            if any(v > 1 for v in rhetoric.values()):
                rhetoric = {k: round(v / 100, 6) for k, v in rhetoric.items()}
            statement_count = int(rdata.get("count", 0))
        else:
            rdata = challenger_rhetoric.get(c["candidate_id"], {})
            for backend_cat, frontend_cat in CATEGORY_MAP.items():
                val = rdata.get(f"{backend_cat}_mean")
                if val is not None:
                    rhetoric[frontend_cat] = round(float(val), 4)
            statement_count = int(rdata.get("statement_count", 0))

        state = c.get("state", "")
        office = c.get("office", "")
        district = c.get("district") or ""

        first_file_date = c.get("first_file_date")
        if first_file_date is not None:
            first_file_date = str(first_file_date)
        last_file_date = c.get("last_file_date")
        if last_file_date is not None:
            last_file_date = str(last_file_date)

        # Tweet engagement stats
        ts = tweet_stats.get(c["candidate_id"], {})

        # Incumbent official data
        official = {}
        if ic == "I" and c.get("bioguide_id"):
            official = incumbent_officials.get(c["bioguide_id"], {})

        cid = c["candidate_id"]
        image_url = candidate_images.get(cid)

        candidate = {
            "candidate_id": cid,
            "name": c.get("name", ""),
            "party": c.get("party", ""),
            "state": state,
            "district": district,
            "office": office,
            "office_full": c.get("office_full"),
            "race_id": _make_race_id(state, office, district),
            "bioguide_id": c.get("bioguide_id"),
            "image_url": image_url,
            "incumbent_challenge": ic,
            "twitter_handle": c.get("twitter_handle"),
            "campaign_website": c.get("campaign_website"),
            "first_file_date": first_file_date,
            "last_file_date": last_file_date,
            "has_raised_funds": bool(c.get("has_raised_funds")),
            "candidate_status": c.get("candidate_status"),
            "rhetoric": rhetoric,
            "statement_count": statement_count,
            "rhetoric_data_available": bool(rhetoric) and statement_count >= 10,
            # Tweet engagement
            "follower_count": _safe_int(ts.get("follower_count")),
            "first_tweet_date": _safe_date(ts.get("first_tweet_date")),
            "last_tweet_date": _safe_date(ts.get("last_tweet_date")),
            "avg_likes": _safe_float(ts.get("avg_likes")),
            "avg_retweets": _safe_float(ts.get("avg_retweets")),
            "avg_impressions": _safe_int(ts.get("avg_impressions")),
            # Incumbent-only fields
            "government_website": official.get("government_website"),
            "gender": official.get("gender"),
            "birthday": _safe_date(official.get("birthday")),
            "serving_since": _safe_date(official.get("serving_public_since")),
            "facebook": official.get("facebook"),
        }

        # Financial data from FEC
        money = challenger_money.get(c["candidate_id"], {})
        if money:
            candidate["finance"] = {
                "total_receipts": _safe_int(money.get("total_receipts")),
                "total_disbursements": _safe_int(money.get("total_disbursements")),
                "cash_on_hand": _safe_int(money.get("cash_on_hand")),
                "debts_owed": _safe_int(money.get("debts_owed")),
                "individual_contributions": _safe_int(
                    money.get("individual_contributions")
                ),
                "pac_contributions": _safe_int(money.get("pac_contributions")),
                "party_contributions": _safe_int(money.get("party_contributions")),
                "candidate_contributions": _safe_int(
                    money.get("candidate_contributions")
                ),
                "candidate_loans": _safe_int(money.get("candidate_loans")),
                "coverage_end_date": money.get("coverage_end_date"),
                "total_receipts_rank": _safe_int(money.get("total_receipts_rank")),
                "race_rank": _safe_int(money.get("race_rank")),
            }

        candidates.append(candidate)

    candidates = sanitize_for_json(candidates)
    print(f"  Built {len(candidates)} candidate records")

    # Compute awards
    awards_list, awards_by_candidate = _compute_awards(candidates)
    for c in candidates:
        cid = c["candidate_id"]
        if cid in awards_by_candidate:
            c["awards"] = awards_by_candidate[cid]

    # 5. Save unfiltered candidates for admin, then filter for public
    all_candidates_unfiltered = candidates[:]

    # Mark winners and filter out non-winners for called races
    if winners_by_race:
        filtered = []
        for c in candidates:
            rid = c["race_id"]
            if rid in winners_by_race:
                if c["candidate_id"] in winners_by_race[rid]:
                    c["primary_winner"] = True
                    filtered.append(c)
                # else: loser in a called race — exclude from public
            else:
                filtered.append(c)
        excluded = len(candidates) - len(filtered)
        candidates = filtered
        print(
            f"  Filtered out {excluded} non-winners from {len(winners_by_race)} called races"
        )

    # 6. Build race objects by grouping (filtered) candidates
    race_candidates = defaultdict(lambda: {"democrat": [], "republican": []})
    race_meta = {}

    for c in candidates:
        rid = c["race_id"]
        party = (c.get("party") or "").lower()
        if "democrat" in party:
            race_candidates[rid]["democrat"].append(c["candidate_id"])
        elif "republican" in party:
            race_candidates[rid]["republican"].append(c["candidate_id"])

        if rid not in race_meta:
            race_meta[rid] = {
                "state": c["state"],
                "office": c["office"],
                "district": c["district"],
            }

    # Also build race meta from unfiltered list so called races still appear
    for c in all_candidates_unfiltered:
        rid = c["race_id"]
        if rid not in race_meta:
            race_meta[rid] = {
                "state": c["state"],
                "office": c["office"],
                "district": c["district"],
            }

    races = []
    for rid, meta in race_meta.items():
        cands = race_candidates.get(rid, {"democrat": [], "republican": []})
        race = {
            "race_id": rid,
            "state": meta["state"],
            "state_name": STATE_ABBR_TO_NAME.get(meta["state"], meta["state"]),
            "office": meta["office"],
            "district": meta["district"],
            "display_name": _make_display_name(
                meta["state"], meta["office"], meta["district"]
            ),
            "candidates": cands,
            "candidate_count": len(cands["democrat"]) + len(cands["republican"]),
            "race_called": rid in winners_by_race,
        }
        races.append(race)

    races = sanitize_for_json(races)
    print(f"  Built {len(races)} race records")

    # 7. Build unfiltered races for admin (includes all candidates)
    admin_race_candidates = defaultdict(lambda: {"democrat": [], "republican": []})
    for c in all_candidates_unfiltered:
        rid = c["race_id"]
        party = (c.get("party") or "").lower()
        if "democrat" in party:
            admin_race_candidates[rid]["democrat"].append(c["candidate_id"])
        elif "republican" in party:
            admin_race_candidates[rid]["republican"].append(c["candidate_id"])

    admin_races = []
    for rid, meta in race_meta.items():
        cands = admin_race_candidates.get(rid, {"democrat": [], "republican": []})
        race = {
            "race_id": rid,
            "state": meta["state"],
            "state_name": STATE_ABBR_TO_NAME.get(meta["state"], meta["state"]),
            "office": meta["office"],
            "district": meta["district"],
            "display_name": _make_display_name(
                meta["state"], meta["office"], meta["district"]
            ),
            "candidates": cands,
            "candidate_count": len(cands["democrat"]) + len(cands["republican"]),
            "race_called": rid in winners_by_race,
        }
        admin_races.append(race)

    admin_races = sanitize_for_json(admin_races)

    # 8. Identify competitive candidates
    competitive_candidate_ids = set()
    for race in races:
        if race["race_id"] in COMPETITIVE_RACE_IDS:
            for cid in (
                race["candidates"]["democrat"] + race["candidates"]["republican"]
            ):
                competitive_candidate_ids.add(cid)

    competitive_candidates = [
        c for c in candidates if c["candidate_id"] in competitive_candidate_ids
    ]
    print(
        f"  Competitive races: {len(COMPETITIVE_RACE_IDS)}, "
        f"competitive candidates: {len(competitive_candidates)}"
    )

    # 9. Write to pulse.data
    pulse_db = get_pulse_db()
    data_table = pulse_db["data"]

    # Landing: filtered races + competitive candidates + awards (null-stripped)
    landing = {
        "races": _strip_nulls(races),
        "candidates": _strip_nulls(competitive_candidates),
        "awards": _strip_nulls(awards_list),
    }
    data_table.upsert(
        {"endpoint": "primary/landing", "data": landing},
        ["endpoint"],
    )

    # All candidates — filtered (public)
    data_table.upsert(
        {"endpoint": "primary/all-candidates", "data": _strip_nulls(candidates)},
        ["endpoint"],
    )

    # All candidates — unfiltered (admin)
    admin_data = {
        "races": _strip_nulls(admin_races),
        "candidates": _strip_nulls(all_candidates_unfiltered),
    }
    data_table.upsert(
        {"endpoint": "primary/admin-all-candidates", "data": admin_data},
        ["endpoint"],
    )

    # Per-state: filtered state races + state candidates (null-stripped)
    states = sorted(set(c["state"] for c in candidates))
    for state in states:
        state_candidates = [c for c in candidates if c["state"] == state]
        state_races = [r for r in races if r["state"] == state]
        state_data = {
            "races": _strip_nulls(state_races),
            "candidates": _strip_nulls(state_candidates),
        }
        data_table.upsert(
            {"endpoint": f"primary/state/{state}", "data": state_data},
            ["endpoint"],
        )

    # Clean up old endpoints
    for old in ("primary/candidates", "primary/races"):
        pulse_db.query(f"DELETE FROM data WHERE endpoint = '{old}'")

    pulse_db.engine.dispose()
    pulse_db.close()
    print(f"  Wrote primary/landing + {len(states)} state endpoints to pulse.data")


def build_statements():
    """Build per-candidate statements, write to pulse.primary_statements."""
    elite_db = get_elite_db()

    # Load active challengers
    challengers = list(elite_db["challengers"].find(active=True))

    if not challengers:
        elite_db.engine.dispose()
        elite_db.close()
        print("  No active challengers found, skipping")
        return

    # Load primary winners to filter out losers in called races
    winners_by_race = defaultdict(set)
    try:
        winner_rows = elite_db.query(
            "SELECT candidate_id, race_id FROM primary_winners"
        )
        for w in winner_rows:
            winners_by_race[w["race_id"]].add(w["candidate_id"])
    except Exception as e:
        print(f"  Warning: could not load primary_winners for statements: {e}")

    # The API serves at most 20 statements per candidate (ORDER BY date DESC
    # LIMIT 20).  Fetching every historical statement for 400+ incumbents
    # easily exceeds the 2 GB Fargate memory limit, so we cap per candidate.
    STATEMENTS_PER_CANDIDATE = 50  # generous buffer above the 20 the API returns

    statements = []

    # Challenger/open-seat statements from classifications_challengers + tweets_challengers
    co_ids = [
        c["candidate_id"]
        for c in challengers
        if c.get("incumbent_challenge") in ("C", "O")
    ]
    if co_ids:
        quoted = _quote_ids(co_ids)
        rows = elite_db.query(
            f"""
            SELECT candidate_id, date, tweet_id, text,
                   attack_personal, attack_policy, policy,
                   outcome_creditclaiming, outcome_bipartisanship
            FROM (
                SELECT cc.candidate_id, cc.date, tc.tweet_id, tc.text,
                       cc.attack_personal, cc.attack_policy, cc.policy,
                       cc.outcome_creditclaiming, cc.outcome_bipartisanship,
                       ROW_NUMBER() OVER (PARTITION BY cc.candidate_id ORDER BY cc.date DESC) AS rn
                FROM classifications_challengers cc
                JOIN tweets_challengers tc ON cc.source_id = tc.id
                WHERE cc.classified = 1
                  AND cc.candidate_id IN ({quoted})
            ) ranked
            WHERE rn <= {STATEMENTS_PER_CANDIDATE}
            """
        )
        for r in rows:
            categories = _extract_categories(r)
            statements.append(
                {
                    "candidate_id": r["candidate_id"],
                    "date": str(r["date"]) if r["date"] else None,
                    "source": "twitter",
                    "text": r["text"],
                    "categories": categories,
                    "tweet_id": str(r["tweet_id"]) if r["tweet_id"] else None,
                }
            )

    # Incumbent statements from classifications + tweets (federal officials)
    incumbent_map = {
        c["bioguide_id"]: c["candidate_id"]
        for c in challengers
        if c.get("incumbent_challenge") == "I" and c.get("bioguide_id")
    }

    # Also include synthetic incumbents (injected from officials, not in
    # challengers table).  Their candidate_id == bioguide_id.
    # Only inject for races that have challengers (not open-seat races).
    races_with_incumbent = set()
    races_with_challenger = set()
    for c in challengers:
        rid = _make_race_id(c.get("state", ""), c.get("office", ""), c.get("district"))
        if c.get("incumbent_challenge") == "I":
            races_with_incumbent.add(rid)
        elif c.get("incumbent_challenge") == "C":
            races_with_challenger.add(rid)

    races_needing_incumbent = races_with_challenger - races_with_incumbent
    if races_needing_incumbent:
        rows = elite_db.query(
            """
            SELECT bioguide_id, type, state, district
            FROM officials
            WHERE level = 'national' AND active = 1
            """
        )
        for r in rows:
            s = r.get("state", "")
            t = r.get("type", "")
            d = r.get("district", "")
            if t == "Senator":
                rid = f"{s}-S"
            elif t == "Representative":
                rid = f"{s}-{d or 'AL'}"
            else:
                continue
            if rid in races_needing_incumbent:
                bio_id = r["bioguide_id"]
                if bio_id not in incumbent_map:
                    incumbent_map[bio_id] = bio_id
    if incumbent_map:
        bioguide_ids = list(incumbent_map.keys())
        quoted = _quote_ids(bioguide_ids)
        rows = elite_db.query(
            f"""
            SELECT bioguide_id, date, source, text,
                   attack_personal, attack_policy, policy,
                   outcome_creditclaiming, outcome_bipartisanship,
                   tweet_id
            FROM (
                SELECT c.bioguide_id, c.date, c.source, c.text,
                       c.attack_personal, c.attack_policy, c.policy,
                       c.outcome_creditclaiming, c.outcome_bipartisanship,
                       t.tweet_id,
                       ROW_NUMBER() OVER (PARTITION BY c.bioguide_id ORDER BY c.date DESC) AS rn
                FROM classifications c
                LEFT JOIN tweets t ON c.source = 'tweets' AND c.source_id = t.id
                WHERE c.classified = 1
                  AND c.bioguide_id IN ({quoted})
            ) ranked
            WHERE rn <= {STATEMENTS_PER_CANDIDATE}
            """
        )
        for r in rows:
            categories = _extract_categories(r)
            candidate_id = incumbent_map.get(r["bioguide_id"])
            source = r.get("source", "twitter")
            if source == "tweets":
                source = "twitter"
            statements.append(
                {
                    "candidate_id": candidate_id,
                    "date": str(r["date"]) if r["date"] else None,
                    "source": source,
                    "text": r["text"],
                    "categories": categories,
                    "tweet_id": str(r["tweet_id"]) if r.get("tweet_id") else None,
                }
            )

    elite_db.engine.dispose()
    elite_db.close()

    # Filter out statements for non-winners in called races
    if winners_by_race:
        # Build candidate_id -> race_id mapping
        cid_to_race = {}
        for c in challengers:
            rid = _make_race_id(
                c.get("state", ""), c.get("office", ""), c.get("district")
            )
            cid_to_race[c["candidate_id"]] = rid
        # Also map incumbent bioguide_ids used as candidate_ids
        for bio_id, cand_id in incumbent_map.items():
            if cand_id not in cid_to_race:
                # Find the race for this incumbent from officials
                pass  # incumbent_map values are already candidate_ids in cid_to_race

        before = len(statements)
        statements = [
            s
            for s in statements
            if (
                cid_to_race.get(s["candidate_id"]) not in winners_by_race
                or s["candidate_id"]
                in winners_by_race.get(cid_to_race.get(s["candidate_id"]), set())
            )
        ]
        print(f"  Filtered {before - len(statements)} statements from non-winners")

    # Truncate and reload pulse.primary_statements
    pulse_db = get_pulse_db()
    pulse_db.query("DELETE FROM primary_statements")

    if statements:
        table = pulse_db["primary_statements"]
        table.insert_many(statements)

    pulse_db.engine.dispose()
    pulse_db.close()
    print(f"  Wrote {len(statements)} statements to pulse.primary_statements")


def _extract_categories(row):
    """Convert boolean classification columns to a list of frontend category names."""
    categories = []
    for backend_cat, frontend_cat in CATEGORY_MAP.items():
        if row.get(backend_cat):
            categories.append(frontend_cat)
    return categories
