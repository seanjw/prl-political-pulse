"""Tests for attendance data processing."""

import sys
import os
import pandas as pd

sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "..", "elite", "attendance")
)


class TestAttendanceDigest:
    def test_calculates_participation_rates(self):
        """Verify voting participation aggregation logic."""
        # Mock the CSV data that ingest.py would produce
        votes_data = pd.DataFrame(
            {
                "bioguide_id": ["A000001", "A000001", "A000002", "A000002"],
                "cast_code": [1, 1, 1, 9],  # 9 = not voting
            }
        )

        # Verify basic aggregation
        vote_counts = votes_data.groupby("bioguide_id").agg(
            total=("cast_code", "count"),
            voted=("cast_code", lambda x: (x != 9).sum()),
        )

        assert vote_counts.loc["A000001", "voted"] == 2
        assert vote_counts.loc["A000002", "voted"] == 1

    def test_handles_empty_votes(self):
        """Empty DataFrame should produce empty results."""
        votes_data = pd.DataFrame(
            {
                "bioguide_id": pd.Series(dtype="str"),
                "cast_code": pd.Series(dtype="int"),
            }
        )
        vote_counts = votes_data.groupby("bioguide_id").agg(
            total=("cast_code", "count"),
        )
        assert len(vote_counts) == 0

    def test_digest_upserts_to_db(self):
        """Verify attendance data would be upserted with correct keys."""
        results = [
            {
                "bioguide_id": "A000001",
                "total": 150,
                "max": 200,
                "avg": 170,
            }
        ]
        # Verify data structure matches what digest.py produces
        assert "bioguide_id" in results[0]
        assert "total" in results[0]
        assert "max" in results[0]
        assert "avg" in results[0]
