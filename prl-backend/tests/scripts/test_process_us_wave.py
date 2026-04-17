"""Tests for process_us_wave.py utility functions."""

import os
import sys

import numpy as np
import pandas as pd
import pytest

# Add project root so we can import scripts
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from scripts.process_us_wave import (
    extract_wave_info,
    get_wave_date,
    calculate_support_rate,
    calculate_state_aggregates,
    calculate_violence_count_by_state,
    calculate_affpol,
    calculate_affpol_by_state,
    VIOLENCE_SUPPORT,
    NORM_SUPPORT,
)


# =============================================================================
# extract_wave_info
# =============================================================================


class TestExtractWaveInfo:
    def test_standard_filename(self):
        wave, year = extract_wave_info("dart0051_w178-clean_2026_label.csv")
        assert wave == 178
        assert year == 2026

    def test_path_with_directory(self):
        wave, year = extract_wave_info("/path/to/dart0051_w99-clean_2025_label.csv")
        assert wave == 99
        assert year == 2025

    def test_high_wave_number(self):
        wave, year = extract_wave_info("dart0051_w1000-clean_2030_label.csv")
        assert wave == 1000
        assert year == 2030

    def test_single_digit_wave(self):
        wave, year = extract_wave_info("dart0051_w1-clean_2024_label.csv")
        assert wave == 1
        assert year == 2024

    def test_no_match_returns_none(self):
        wave, year = extract_wave_info("unrelated_file.csv")
        assert wave is None
        assert year is None

    def test_partial_match_no_year(self):
        wave, year = extract_wave_info("dart0051_w10-clean.csv")
        assert wave is None
        assert year is None

    def test_case_insensitive(self):
        wave, year = extract_wave_info("DART0051_W178-CLEAN_2026_LABEL.CSV")
        assert wave == 178
        assert year == 2026

    def test_empty_string(self):
        wave, year = extract_wave_info("")
        assert wave is None
        assert year is None


# =============================================================================
# get_wave_date
# =============================================================================


class TestGetWaveDate:
    def test_returns_thursday(self):
        """Result should always be a Thursday."""
        df = pd.DataFrame(
            {
                "starttime": [
                    "2026-01-05 10:00:00",  # Monday
                    "2026-01-06 11:00:00",  # Tuesday
                    "2026-01-07 12:00:00",  # Wednesday
                ]
            }
        )
        result = get_wave_date(df)
        date = pd.Timestamp(result)
        assert date.weekday() == 3  # Thursday

    def test_already_thursday(self):
        df = pd.DataFrame(
            {
                "starttime": ["2026-01-08 10:00:00"] * 5  # Thursday
            }
        )
        result = get_wave_date(df)
        assert result == "2026-01-08"

    def test_handles_nat_values(self):
        """Should handle invalid dates by dropping NaT."""
        df = pd.DataFrame(
            {
                "starttime": [
                    "2026-01-05 10:00:00",
                    "invalid date",
                    "2026-01-07 12:00:00",
                    None,
                ]
            }
        )
        result = get_wave_date(df)
        assert result is not None
        date = pd.Timestamp(result)
        assert date.weekday() == 3


# =============================================================================
# calculate_support_rate
# =============================================================================


class TestCalculateSupportRate:
    def test_basic_support_rate(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support", "Oppose", "Support", "Oppose"],
                "weight": [1, 1, 1, 1],
            }
        )
        rate = calculate_support_rate(df, "violence1", VIOLENCE_SUPPORT)
        assert rate == 50.0

    def test_weighted_support_rate(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support", "Oppose"],
                "weight": [3, 1],
            }
        )
        rate = calculate_support_rate(df, "violence1", VIOLENCE_SUPPORT)
        assert rate == 75.0

    def test_strongly_support_counts(self):
        df = pd.DataFrame(
            {
                "violence1": ["Strongly support", "Oppose", "Oppose", "Oppose"],
                "weight": [1, 1, 1, 1],
            }
        )
        rate = calculate_support_rate(df, "violence1", VIOLENCE_SUPPORT)
        assert rate == 25.0

    def test_norm_support_values(self):
        df = pd.DataFrame(
            {
                "norm_judges": ["Agree", "Disagree", "Strongly agree", "Disagree"],
                "weight": [1, 1, 1, 1],
            }
        )
        rate = calculate_support_rate(df, "norm_judges", NORM_SUPPORT)
        assert rate == 50.0

    def test_filter_by_party(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support", "Oppose", "Support", "Oppose"],
                "pid3": ["Democrat", "Democrat", "Republican", "Republican"],
                "weight": [1, 1, 1, 1],
            }
        )
        dem_rate = calculate_support_rate(
            df, "violence1", VIOLENCE_SUPPORT, party="Democrat"
        )
        rep_rate = calculate_support_rate(
            df, "violence1", VIOLENCE_SUPPORT, party="Republican"
        )
        assert dem_rate == 50.0
        assert rep_rate == 50.0

    def test_party_filter_all_support(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support", "Support"],
                "pid3": ["Democrat", "Democrat"],
                "weight": [1, 1],
            }
        )
        rate = calculate_support_rate(
            df, "violence1", VIOLENCE_SUPPORT, party="Democrat"
        )
        assert rate == 100.0

    def test_missing_column_returns_none(self):
        df = pd.DataFrame({"other_col": [1, 2, 3]})
        rate = calculate_support_rate(df, "violence1", VIOLENCE_SUPPORT)
        assert rate is None

    def test_missing_pid3_for_party_filter_returns_none(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support", "Oppose"],
                "weight": [1, 1],
            }
        )
        rate = calculate_support_rate(
            df, "violence1", VIOLENCE_SUPPORT, party="Democrat"
        )
        assert rate is None

    def test_empty_after_party_filter_returns_none(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support"],
                "pid3": ["Republican"],
                "weight": [1],
            }
        )
        rate = calculate_support_rate(
            df, "violence1", VIOLENCE_SUPPORT, party="Democrat"
        )
        assert rate is None

    def test_all_nan_values_returns_none(self):
        df = pd.DataFrame(
            {
                "violence1": [np.nan, np.nan, np.nan],
                "weight": [1, 1, 1],
            }
        )
        rate = calculate_support_rate(df, "violence1", VIOLENCE_SUPPORT)
        assert rate is None

    def test_nan_weights_replaced_with_one(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support", "Oppose"],
                "weight": [np.nan, np.nan],
            }
        )
        rate = calculate_support_rate(df, "violence1", VIOLENCE_SUPPORT)
        assert rate == 50.0

    def test_no_weight_column_uses_mean(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support", "Oppose", "Support"],
            }
        )
        rate = calculate_support_rate(df, "violence1", VIOLENCE_SUPPORT)
        assert rate == pytest.approx(66.7, abs=0.1)

    def test_empty_dataframe_returns_none(self):
        df = pd.DataFrame(
            {
                "violence1": pd.Series([], dtype=str),
                "weight": pd.Series([], dtype=float),
            }
        )
        rate = calculate_support_rate(df, "violence1", VIOLENCE_SUPPORT)
        assert rate is None

    def test_rounding(self):
        """Rate should be rounded to 1 decimal place."""
        df = pd.DataFrame(
            {
                "violence1": ["Support", "Oppose", "Oppose"],
                "weight": [1, 1, 1],
            }
        )
        rate = calculate_support_rate(df, "violence1", VIOLENCE_SUPPORT)
        assert rate == 33.3


# =============================================================================
# calculate_state_aggregates
# =============================================================================


class TestCalculateStateAggregates:
    def test_basic_aggregation(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support", "Oppose", "Support", "Support"],
                "inputstate": ["CA", "CA", "TX", "TX"],
                "weight": [1, 1, 1, 1],
            }
        )
        results = calculate_state_aggregates(df, "violence1", VIOLENCE_SUPPORT)
        assert len(results) == 2
        # TX has 100% support, CA has 50%
        assert results[0]["name"] == "TX"
        assert results[0]["value"] == 100.0
        assert results[1]["name"] == "CA"
        assert results[1]["value"] == 50.0

    def test_sorted_descending(self):
        df = pd.DataFrame(
            {
                "violence1": ["Oppose", "Support", "Support"],
                "inputstate": ["NY", "FL", "FL"],
                "weight": [1, 1, 1],
            }
        )
        results = calculate_state_aggregates(df, "violence1", VIOLENCE_SUPPORT)
        assert results[0]["value"] >= results[-1]["value"]

    def test_missing_inputstate_column(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support"],
                "weight": [1],
            }
        )
        results = calculate_state_aggregates(df, "violence1", VIOLENCE_SUPPORT)
        assert results == []

    def test_missing_target_column(self):
        df = pd.DataFrame(
            {
                "inputstate": ["CA"],
                "weight": [1],
            }
        )
        results = calculate_state_aggregates(df, "violence1", VIOLENCE_SUPPORT)
        assert results == []

    def test_nan_state_excluded(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support", "Oppose"],
                "inputstate": ["CA", np.nan],
                "weight": [1, 1],
            }
        )
        results = calculate_state_aggregates(df, "violence1", VIOLENCE_SUPPORT)
        assert len(results) == 1
        assert results[0]["name"] == "CA"


# =============================================================================
# calculate_violence_count_by_state
# =============================================================================


class TestCalculateViolenceCountByState:
    def test_basic_count(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support", "Oppose"],
                "violence2": ["Support", "Oppose"],
                "violence3": ["Support", "Oppose"],
                "violence4": ["Oppose", "Oppose"],
                "violence5": ["Oppose", "Oppose"],
                "violence6": ["Oppose", "Oppose"],
                "inputstate": ["CA", "CA"],
                "weight": [1, 1],
            }
        )
        results = calculate_violence_count_by_state(df)
        assert len(results) == 1
        # Person 1 supports 3, person 2 supports 0 → avg = 1.5
        assert results[0]["value"] == 1.5

    def test_missing_inputstate(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support"],
                "weight": [1],
            }
        )
        results = calculate_violence_count_by_state(df)
        assert results == []

    def test_weighted(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support", "Oppose"],
                "violence2": ["Oppose", "Oppose"],
                "violence3": ["Oppose", "Oppose"],
                "violence4": ["Oppose", "Oppose"],
                "violence5": ["Oppose", "Oppose"],
                "violence6": ["Oppose", "Oppose"],
                "inputstate": ["CA", "CA"],
                "weight": [3, 1],
            }
        )
        results = calculate_violence_count_by_state(df)
        # Person 1: 1 act * weight 3 = 3, Person 2: 0 acts * weight 1 = 0
        # Total: 3 / (3+1) = 0.75
        assert results[0]["value"] == 0.75

    def test_nan_weight_treated_as_one(self):
        df = pd.DataFrame(
            {
                "violence1": ["Support"],
                "violence2": ["Oppose"],
                "violence3": ["Oppose"],
                "violence4": ["Oppose"],
                "violence5": ["Oppose"],
                "violence6": ["Oppose"],
                "inputstate": ["TX"],
                "weight": [np.nan],
            }
        )
        results = calculate_violence_count_by_state(df)
        assert len(results) == 1
        assert results[0]["value"] == 1.0


# =============================================================================
# calculate_affpol
# =============================================================================


class TestCalculateAffpol:
    def test_basic(self):
        df = pd.DataFrame(
            {
                "democrat_therm_1": [80, 20],
                "republican_therm_1": [20, 80],
                "weight": [1, 1],
            }
        )
        result = calculate_affpol(df)
        assert result["dem_therm"] == 50.0
        assert result["rep_therm"] == 50.0

    def test_filter_by_party(self):
        df = pd.DataFrame(
            {
                "democrat_therm_1": [90, 30],
                "republican_therm_1": [20, 80],
                "pid3": ["Democrat", "Republican"],
                "weight": [1, 1],
            }
        )
        dem_result = calculate_affpol(df, party="Democrat")
        assert dem_result["dem_therm"] == 90.0
        assert dem_result["rep_therm"] == 20.0

    def test_empty_data_returns_none(self):
        df = pd.DataFrame(
            {
                "democrat_therm_1": pd.Series([], dtype=float),
                "republican_therm_1": pd.Series([], dtype=float),
                "weight": pd.Series([], dtype=float),
            }
        )
        result = calculate_affpol(df)
        assert result is None

    def test_all_nan_therms_returns_none(self):
        df = pd.DataFrame(
            {
                "democrat_therm_1": [np.nan, np.nan],
                "republican_therm_1": [np.nan, np.nan],
                "weight": [1, 1],
            }
        )
        result = calculate_affpol(df)
        assert result is None

    def test_mixed_nan_and_valid(self):
        df = pd.DataFrame(
            {
                "democrat_therm_1": [80, np.nan],
                "republican_therm_1": [20, 50],
                "weight": [1, 1],
            }
        )
        result = calculate_affpol(df)
        # Only first row is valid (both therms present)
        assert result["dem_therm"] == 80.0
        assert result["rep_therm"] == 20.0

    def test_nan_weight_defaults_to_one(self):
        df = pd.DataFrame(
            {
                "democrat_therm_1": [80],
                "republican_therm_1": [40],
                "weight": [np.nan],
            }
        )
        result = calculate_affpol(df)
        assert result["dem_therm"] == 80.0
        assert result["rep_therm"] == 40.0

    def test_invalid_therm_values_skipped(self):
        df = pd.DataFrame(
            {
                "democrat_therm_1": [80, "not a number"],
                "republican_therm_1": [20, "also bad"],
                "weight": [1, 1],
            }
        )
        result = calculate_affpol(df)
        assert result["dem_therm"] == 80.0

    def test_missing_pid3_with_party_filter_returns_none(self):
        df = pd.DataFrame(
            {
                "democrat_therm_1": [80],
                "republican_therm_1": [20],
                "weight": [1],
            }
        )
        result = calculate_affpol(df, party="Democrat")
        assert result is None

    def test_no_matching_party_returns_none(self):
        df = pd.DataFrame(
            {
                "democrat_therm_1": [80],
                "republican_therm_1": [20],
                "pid3": ["Republican"],
                "weight": [1],
            }
        )
        result = calculate_affpol(df, party="Democrat")
        assert result is None


# =============================================================================
# calculate_affpol_by_state
# =============================================================================


class TestCalculateAffpolByState:
    def test_basic(self):
        df = pd.DataFrame(
            {
                "democrat_therm_1": [90, 30],
                "republican_therm_1": [20, 80],
                "pid3": ["Democrat", "Republican"],
                "inputstate": ["CA", "CA"],
                "weight": [1, 1],
            }
        )
        results = calculate_affpol_by_state(df)
        assert len(results) == 1
        # Democrat: 90-20=70, Republican: 80-30=50. avg = 60
        assert results[0]["value"] == 60.0

    def test_missing_inputstate(self):
        df = pd.DataFrame(
            {
                "democrat_therm_1": [80],
                "republican_therm_1": [20],
                "pid3": ["Democrat"],
                "weight": [1],
            }
        )
        results = calculate_affpol_by_state(df)
        assert results == []

    def test_independent_party_excluded(self):
        """Only Democrat and Republican are included in affpol calculation."""
        df = pd.DataFrame(
            {
                "democrat_therm_1": [50, 80],
                "republican_therm_1": [50, 20],
                "pid3": ["Independent", "Democrat"],
                "inputstate": ["CA", "CA"],
                "weight": [1, 1],
            }
        )
        results = calculate_affpol_by_state(df)
        assert len(results) == 1
        # Only Democrat row: 80 - 20 = 60
        assert results[0]["value"] == 60.0

    def test_sorted_descending(self):
        df = pd.DataFrame(
            {
                "democrat_therm_1": [90, 50],
                "republican_therm_1": [10, 40],
                "pid3": ["Democrat", "Democrat"],
                "inputstate": ["CA", "TX"],
                "weight": [1, 1],
            }
        )
        results = calculate_affpol_by_state(df)
        assert results[0]["value"] >= results[1]["value"]
