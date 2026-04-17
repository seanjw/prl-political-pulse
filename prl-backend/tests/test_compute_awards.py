"""Tests for the _compute_awards function in pulse.build.build_primary."""

import math
import sys
import types
from unittest.mock import MagicMock

# ---------------------------------------------------------------------------
# Stub pulse.build.db before build_primary is imported so that the heavy
# third-party dependencies (ibis, dataset) are never loaded.
# We must NOT stub "pulse.build" itself — it is a real package.
# ---------------------------------------------------------------------------

_db_stub = types.ModuleType("pulse.build.db")
_db_stub.STATE_ABBR_TO_NAME = {}
_db_stub.get_elite_db = MagicMock()
_db_stub.get_pulse_db = MagicMock()
_db_stub.sanitize_for_json = lambda x: x

sys.modules["pulse.build.db"] = _db_stub

# Also stub third-party libs that db.py would import transitively
for _lib in ("ibis", "dataset"):
    sys.modules.setdefault(_lib, MagicMock())

from pulse.build.build_primary import (  # noqa: E402
    _compute_awards,
    AWARDS_MIN_STATEMENTS,
    AWARDS_PERCENTILE,
    AWARD_NAMES,
    CATEGORY_MAP,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ALL_CATS = list(CATEGORY_MAP.values())
# ["accomplishments", "bipartisanship", "policy", "attack_policy", "attack_personal"]


def _make_candidate(
    candidate_id="cand-1",
    name="Alice Smith",
    party="Democrat",
    state="CA",
    office="H",
    district="1",
    race_id="CA-1",
    statement_count=100,
    rhetoric_data_available=True,
    rhetoric=None,
):
    """Return a minimal candidate dict suitable for _compute_awards."""
    if rhetoric is None:
        rhetoric = {cat: 0.5 for cat in ALL_CATS}
    return {
        "candidate_id": candidate_id,
        "name": name,
        "party": party,
        "state": state,
        "office": office,
        "district": district,
        "race_id": race_id,
        "statement_count": statement_count,
        "rhetoric_data_available": rhetoric_data_available,
        "rhetoric": rhetoric,
    }


def _make_pool(n, base_rhetoric=None):
    """Return a list of n distinct candidates with increasing rhetoric scores."""
    candidates = []
    for i in range(n):
        rhetoric = {cat: round(i / n, 4) for cat in ALL_CATS}
        if base_rhetoric:
            rhetoric.update(base_rhetoric)
        candidates.append(
            _make_candidate(
                candidate_id=f"cand-{i}",
                name=f"Candidate {i}",
                rhetoric=rhetoric,
                statement_count=AWARDS_MIN_STATEMENTS,
            )
        )
    return candidates


# ---------------------------------------------------------------------------
# 1. Empty candidates list
# ---------------------------------------------------------------------------


class TestEmptyCandidates:
    def test_empty_list_returns_empty_awards_list(self):
        awards_list, awards_by_candidate = _compute_awards([])
        assert awards_list == []

    def test_empty_list_returns_empty_dict(self):
        awards_list, awards_by_candidate = _compute_awards([])
        assert awards_by_candidate == {}


# ---------------------------------------------------------------------------
# 2. Statement-count threshold
# ---------------------------------------------------------------------------


class TestMinStatementThreshold:
    def test_candidate_below_threshold_excluded(self):
        """A candidate with statement_count < AWARDS_MIN_STATEMENTS should not win."""
        low = _make_candidate(
            candidate_id="low",
            statement_count=AWARDS_MIN_STATEMENTS - 1,
            rhetoric={cat: 1.0 for cat in ALL_CATS},
        )
        awards_list, awards_by_candidate = _compute_awards([low])
        assert awards_list == []
        assert awards_by_candidate == {}

    def test_candidate_exactly_at_threshold_included(self):
        """A candidate with statement_count == AWARDS_MIN_STATEMENTS is eligible."""
        at_threshold = _make_candidate(
            candidate_id="exact",
            statement_count=AWARDS_MIN_STATEMENTS,
            rhetoric={cat: 0.9 for cat in ALL_CATS},
        )
        awards_list, _ = _compute_awards([at_threshold])
        # With a single eligible candidate, cutoff = 1, so they win both top and bottom
        assert len(awards_list) > 0

    def test_all_below_threshold_returns_empty(self):
        candidates = [
            _make_candidate(candidate_id=f"c{i}", statement_count=i)
            for i in range(AWARDS_MIN_STATEMENTS)
        ]
        awards_list, awards_by_candidate = _compute_awards(candidates)
        assert awards_list == []
        assert awards_by_candidate == {}


# ---------------------------------------------------------------------------
# 3. rhetoric_data_available flag
# ---------------------------------------------------------------------------


class TestRhetoricDataAvailable:
    def test_candidate_without_flag_excluded(self):
        no_rhetoric = _make_candidate(
            candidate_id="no-rhetoric",
            rhetoric_data_available=False,
            statement_count=AWARDS_MIN_STATEMENTS + 10,
        )
        awards_list, awards_by_candidate = _compute_awards([no_rhetoric])
        assert awards_list == []
        assert awards_by_candidate == {}

    def test_candidate_with_false_flag_excluded_even_with_high_scores(self):
        no_rhetoric = _make_candidate(
            candidate_id="ghost",
            rhetoric_data_available=False,
            statement_count=500,
            rhetoric={cat: 1.0 for cat in ALL_CATS},
        )
        awards_list, _ = _compute_awards([no_rhetoric])
        assert awards_list == []

    def test_mix_of_eligible_and_ineligible(self):
        eligible = _make_candidate(
            candidate_id="eligible",
            rhetoric_data_available=True,
            statement_count=AWARDS_MIN_STATEMENTS,
        )
        ineligible = _make_candidate(
            candidate_id="ineligible",
            rhetoric_data_available=False,
            statement_count=AWARDS_MIN_STATEMENTS,
        )
        _, awards_by_candidate = _compute_awards([eligible, ineligible])
        assert "ineligible" not in awards_by_candidate


# ---------------------------------------------------------------------------
# 4. Top 3% and bottom 3% correctly identified
# ---------------------------------------------------------------------------


class TestTopBottomPercentile:
    def test_top_candidate_wins_top_award(self):
        """The candidate with the highest score should win the top award."""
        candidates = _make_pool(100)
        awards_list, _ = _compute_awards(candidates)
        top_policy = [
            a for a in awards_list if a["category"] == "policy" and a["type"] == "top"
        ]
        assert len(top_policy) > 0
        # All top winners should be from the last (highest-scored) candidates
        top_ids = {a["candidate_id"] for a in top_policy}
        # cand-99 has the highest score (i=99, score=99/100)
        assert "cand-99" in top_ids

    def test_bottom_candidate_wins_bottom_award(self):
        """The candidate with the lowest score should win the bottom award."""
        candidates = _make_pool(100)
        awards_list, _ = _compute_awards(candidates)
        bottom_policy = [
            a
            for a in awards_list
            if a["category"] == "policy" and a["type"] == "bottom"
        ]
        assert len(bottom_policy) > 0
        bottom_ids = {a["candidate_id"] for a in bottom_policy}
        # cand-0 has the lowest score (i=0, score=0/100)
        assert "cand-0" in bottom_ids

    def test_cutoff_count_matches_percentile(self):
        """Number of top/bottom winners per category equals ceil(n * AWARDS_PERCENTILE)."""
        n = 100
        candidates = _make_pool(n)
        expected_cutoff = max(1, math.ceil(n * AWARDS_PERCENTILE))
        awards_list, _ = _compute_awards(candidates)

        for cat in ALL_CATS:
            top_count = sum(
                1 for a in awards_list if a["category"] == cat and a["type"] == "top"
            )
            bottom_count = sum(
                1 for a in awards_list if a["category"] == cat and a["type"] == "bottom"
            )
            assert top_count == expected_cutoff, f"top count wrong for {cat}"
            assert bottom_count == expected_cutoff, f"bottom count wrong for {cat}"

    def test_all_five_categories_produce_awards(self):
        candidates = _make_pool(100)
        awards_list, _ = _compute_awards(candidates)
        categories_with_awards = {a["category"] for a in awards_list}
        for cat in ALL_CATS:
            assert cat in categories_with_awards

    def test_award_names_match_award_names_constant(self):
        candidates = _make_pool(100)
        awards_list, _ = _compute_awards(candidates)
        for award in awards_list:
            cat = award["category"]
            atype = award["type"]
            if atype in ("top", "bottom"):
                assert award["award_name"] == AWARD_NAMES[cat][atype]


# ---------------------------------------------------------------------------
# 5. Small pool — cutoff is at least 1
# ---------------------------------------------------------------------------


class TestSmallCandidatePool:
    def test_single_eligible_candidate_receives_awards(self):
        """With one eligible candidate cutoff=1; they win top AND bottom."""
        c = _make_candidate(
            candidate_id="solo",
            statement_count=AWARDS_MIN_STATEMENTS,
        )
        awards_list, awards_by_candidate = _compute_awards([c])
        assert len(awards_list) > 0
        assert "solo" in awards_by_candidate

    def test_two_eligible_candidates_each_win_one_side(self):
        """With two candidates each wins either top or bottom (or both if cutoff
        overlaps), but at minimum the highest scorer wins top."""
        high = _make_candidate(
            candidate_id="high",
            statement_count=AWARDS_MIN_STATEMENTS,
            rhetoric={cat: 0.9 for cat in ALL_CATS},
        )
        low = _make_candidate(
            candidate_id="low",
            statement_count=AWARDS_MIN_STATEMENTS,
            rhetoric={cat: 0.1 for cat in ALL_CATS},
        )
        awards_list, _ = _compute_awards([high, low])
        top_ids = {a["candidate_id"] for a in awards_list if a["type"] == "top"}
        bottom_ids = {a["candidate_id"] for a in awards_list if a["type"] == "bottom"}
        assert "high" in top_ids
        assert "low" in bottom_ids

    def test_cutoff_floor_is_one_regardless_of_percentile(self):
        """Even 1 candidate (< 1/0.03) should still generate exactly 1 top winner."""
        candidates = _make_pool(1)
        n = len(candidates)
        expected_cutoff = max(1, math.ceil(n * AWARDS_PERCENTILE))
        assert expected_cutoff == 1  # sanity-check our expectation

        awards_list, _ = _compute_awards(candidates)
        top_policy = [
            a for a in awards_list if a["category"] == "policy" and a["type"] == "top"
        ]
        assert len(top_policy) == 1


# ---------------------------------------------------------------------------
# 6. Zero personal attacks badge
# ---------------------------------------------------------------------------


class TestZeroAttacksBadge:
    def test_zero_attack_personal_receives_zero_attacks_award(self):
        c = _make_candidate(
            candidate_id="peaceful",
            statement_count=AWARDS_MIN_STATEMENTS,
            rhetoric={
                **{cat: 0.5 for cat in ALL_CATS},
                "attack_personal": 0.0,
            },
        )
        awards_list, awards_by_candidate = _compute_awards([c])
        zero_awards = [a for a in awards_list if a["type"] == "zero_attacks"]
        assert len(zero_awards) >= 1
        assert zero_awards[0]["candidate_id"] == "peaceful"
        assert zero_awards[0]["award_name"] == "Zero Personal Attacks"
        assert zero_awards[0]["category"] == "attack_personal"
        assert zero_awards[0]["value"] == 0.0

    def test_non_zero_attack_personal_does_not_get_badge(self):
        c = _make_candidate(
            candidate_id="attacker",
            statement_count=AWARDS_MIN_STATEMENTS,
            rhetoric={
                **{cat: 0.5 for cat in ALL_CATS},
                "attack_personal": 0.1,
            },
        )
        awards_list, _ = _compute_awards([c])
        zero_awards = [a for a in awards_list if a["type"] == "zero_attacks"]
        assert len(zero_awards) == 0

    def test_zero_attack_personal_in_awards_by_candidate(self):
        c = _make_candidate(
            candidate_id="civil",
            statement_count=AWARDS_MIN_STATEMENTS,
            rhetoric={
                **{cat: 0.5 for cat in ALL_CATS},
                "attack_personal": 0.0,
            },
        )
        _, awards_by_candidate = _compute_awards([c])
        candidate_awards = awards_by_candidate.get("civil", [])
        zero_entries = [a for a in candidate_awards if a["type"] == "zero_attacks"]
        assert len(zero_entries) >= 1

    def test_missing_attack_personal_key_treated_as_nonzero(self):
        """A candidate missing the attack_personal key should NOT get the badge."""
        rhetoric = {cat: 0.5 for cat in ALL_CATS if cat != "attack_personal"}
        # rhetoric.get("attack_personal", 1) == 1 != 0.0, so no badge expected
        c = _make_candidate(
            candidate_id="missing-key",
            statement_count=AWARDS_MIN_STATEMENTS,
            rhetoric=rhetoric,
        )
        awards_list, _ = _compute_awards([c])
        zero_awards = [a for a in awards_list if a["type"] == "zero_attacks"]
        assert len(zero_awards) == 0


# ---------------------------------------------------------------------------
# 7. Candidate can receive multiple awards across categories
# ---------------------------------------------------------------------------


class TestMultipleAwards:
    def test_candidate_with_extreme_scores_wins_multiple_awards(self):
        """A candidate dominating all categories should appear in awards_by_candidate
        with entries for each category they win."""
        # Make a pool large enough that the dominance of one candidate is clear.
        # We use 100 candidates and assign the top candidate score=1.0 everywhere.
        candidates = _make_pool(100)
        # Override candidate 99 (already highest in the pool) — no change needed,
        # but ensure all categories are 1.0
        for cat in ALL_CATS:
            candidates[99]["rhetoric"][cat] = 1.0

        _, awards_by_candidate = _compute_awards(candidates)
        top_winner = awards_by_candidate.get("cand-99", [])
        top_entries = [a for a in top_winner if a["type"] == "top"]
        # Should win top for all five categories
        assert len(top_entries) == len(ALL_CATS)

    def test_awards_by_candidate_has_correct_categories(self):
        """awards_by_candidate entries each have 'category', 'type', 'award_name'."""
        candidates = _make_pool(100)
        _, awards_by_candidate = _compute_awards(candidates)
        for cid, award_entries in awards_by_candidate.items():
            for entry in award_entries:
                assert "category" in entry
                assert "type" in entry
                assert "award_name" in entry


# ---------------------------------------------------------------------------
# 8. Awards list contains full candidate info
# ---------------------------------------------------------------------------


class TestAwardsListStructure:
    def test_awards_list_entry_has_required_fields(self):
        c = _make_candidate(
            candidate_id="full-check",
            name="Bob Jones",
            party="Republican",
            state="TX",
            office="H",
            district="5",
            race_id="TX-5",
            statement_count=AWARDS_MIN_STATEMENTS,
        )
        awards_list, _ = _compute_awards([c])
        assert len(awards_list) > 0
        award = awards_list[0]
        assert award["candidate_id"] == "full-check"
        assert award["name"] == "Bob Jones"
        assert award["party"] == "Republican"
        assert award["state"] == "TX"
        assert award["office"] == "H"
        assert award["district"] == "5"
        assert award["race_id"] == "TX-5"
        assert "value" in award
        assert "statement_count" in award
        assert award["statement_count"] == AWARDS_MIN_STATEMENTS

    def test_awards_list_entry_has_award_metadata(self):
        c = _make_candidate(statement_count=AWARDS_MIN_STATEMENTS)
        awards_list, _ = _compute_awards([c])
        for award in awards_list:
            assert "category" in award
            assert "type" in award
            assert "award_name" in award


# ---------------------------------------------------------------------------
# 9. Awards by candidate contains compact format
# ---------------------------------------------------------------------------


class TestAwardsByCandidateStructure:
    def test_compact_format_has_only_three_keys(self):
        """Each entry in awards_by_candidate must have exactly category, type,
        award_name — no extra candidate info."""
        candidates = _make_pool(10)
        _, awards_by_candidate = _compute_awards(candidates)
        for cid, entries in awards_by_candidate.items():
            for entry in entries:
                assert set(entry.keys()) == {"category", "type", "award_name"}

    def test_awards_by_candidate_keys_are_candidate_ids(self):
        candidates = _make_pool(10)
        _, awards_by_candidate = _compute_awards(candidates)
        expected_ids = {c["candidate_id"] for c in candidates}
        for cid in awards_by_candidate:
            assert cid in expected_ids


# ---------------------------------------------------------------------------
# 10. zero_attacks not duplicated if already in bottom 3%
# ---------------------------------------------------------------------------


class TestZeroAttacksDeduplication:
    def test_zero_attacks_not_duplicated_in_awards_by_candidate(self):
        """If the candidate with attack_personal=0.0 is also in the bottom 3%,
        the zero_attacks entry should appear only once in awards_by_candidate."""
        # Use a large enough pool so that the 0.0 scorer is in the bottom 3%.
        n = 100
        candidates = _make_pool(n)
        # Give cand-0 attack_personal=0.0 (they already have the lowest score,
        # so they will be in the bottom cutoff for attack_personal AND get zero_attacks).
        candidates[0]["rhetoric"]["attack_personal"] = 0.0

        _, awards_by_candidate = _compute_awards(candidates)
        cand0_awards = awards_by_candidate.get("cand-0", [])
        zero_attack_entries = [a for a in cand0_awards if a["type"] == "zero_attacks"]
        # Must appear exactly once, even though candidate qualifies on two paths
        assert len(zero_attack_entries) == 1

    def test_zero_attacks_still_appended_to_awards_list_when_in_bottom_pct(self):
        """The awards_list may contain both 'bottom' and 'zero_attacks' rows for the
        same candidate; that is acceptable — only awards_by_candidate is deduplicated."""
        n = 100
        candidates = _make_pool(n)
        candidates[0]["rhetoric"]["attack_personal"] = 0.0

        awards_list, _ = _compute_awards(candidates)
        cand0_list = [a for a in awards_list if a["candidate_id"] == "cand-0"]
        types = [a["type"] for a in cand0_list if a["category"] == "attack_personal"]
        # Both 'bottom' and 'zero_attacks' rows should be present in the full list
        assert "bottom" in types
        assert "zero_attacks" in types
