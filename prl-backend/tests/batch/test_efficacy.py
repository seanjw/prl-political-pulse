"""Tests for efficacy/legislative productivity processing."""

import pandas as pd


class TestEfficacyProcessing:
    def test_bill_count_aggregation(self):
        """Verify bill sponsorship counting."""
        bills = pd.DataFrame(
            {
                "sponsor_bioguide": ["A001", "A001", "B002", "A001"],
                "bill_type": ["hr", "s", "hr", "hr"],
                "status": ["introduced", "passed", "introduced", "enacted"],
            }
        )

        counts = bills.groupby("sponsor_bioguide").agg(
            total=("bill_type", "count"),
            enacted=("status", lambda x: (x == "enacted").sum()),
        )

        assert counts.loc["A001", "total"] == 3
        assert counts.loc["A001", "enacted"] == 1
        assert counts.loc["B002", "total"] == 1

    def test_handles_empty_bills(self):
        """Empty bills DataFrame should produce empty results."""
        bills = pd.DataFrame(
            {
                "sponsor_bioguide": pd.Series(dtype="str"),
                "bill_type": pd.Series(dtype="str"),
                "status": pd.Series(dtype="str"),
            }
        )
        counts = bills.groupby("sponsor_bioguide").agg(total=("bill_type", "count"))
        assert len(counts) == 0

    def test_topic_aggregation(self):
        """Verify policy area aggregation."""
        bills = pd.DataFrame(
            {
                "bioguide_id": ["A001", "A001", "A001", "B002"],
                "policy_area": ["Health", "Health", "Education", "Defense"],
                "sponsor_type": ["sponsor"] * 4,
            }
        )
        topics = (
            bills[bills["bioguide_id"] == "A001"]["policy_area"]
            .value_counts()
            .to_dict()
        )
        assert topics["Health"] == 2
        assert topics["Education"] == 1
