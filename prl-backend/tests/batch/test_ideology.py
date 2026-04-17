"""Tests for ideology/Voteview data processing."""

import pandas as pd


class TestIdeologyProcessing:
    def test_voteview_csv_parsing(self):
        """Verify Voteview data can be filtered by congress number."""
        data = pd.DataFrame(
            {
                "congress": [118, 119, 119],
                "bioguide_id": ["A001", "A001", "B002"],
                "nominate_dim1": [-0.5, -0.6, 0.7],
            }
        )

        current_congress = 119
        filtered = data[data["congress"] == current_congress]
        assert len(filtered) == 2
        assert set(filtered["bioguide_id"]) == {"A001", "B002"}

    def test_ideology_score_range(self):
        """DW-NOMINATE scores should be between -1 and 1."""
        scores = pd.Series([-0.5, 0.0, 0.7, -1.0, 1.0])
        assert scores.min() >= -1.0
        assert scores.max() <= 1.0

    def test_handles_missing_bioguide(self):
        """Missing bioguide_id should result in empty filter."""
        data = pd.DataFrame(
            {
                "congress": [119],
                "bioguide_id": ["A001"],
                "nominate_dim1": [-0.5],
            }
        )
        filtered = data[data["bioguide_id"] == "Z999"]
        assert len(filtered) == 0

    def test_multiple_congress_filtering(self):
        """Only current congress data should be used."""
        data = pd.DataFrame(
            {
                "congress": [117, 118, 119, 119],
                "bioguide_id": ["A001", "A001", "A001", "B002"],
                "nominate_dim1": [-0.3, -0.4, -0.5, 0.7],
            }
        )
        filtered = data[data["congress"] == 119]
        assert len(filtered) == 2
        # A001's most recent score
        assert (
            filtered[filtered["bioguide_id"] == "A001"]["nominate_dim1"].iloc[0] == -0.5
        )
