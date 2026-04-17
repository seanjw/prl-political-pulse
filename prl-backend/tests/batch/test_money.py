"""Tests for campaign finance data processing."""

import pandas as pd


class TestMoneyDigest:
    def test_fec_id_expansion(self):
        """Verify FEC IDs are properly expanded from comma-separated strings."""
        legislators = pd.DataFrame(
            {
                "bioguide_id": ["A000001", "B000002"],
                "fec_ids": ["H001,S001", "H002"],
                "state": ["CA", "NY"],
            }
        )

        ids_expanded = legislators["fec_ids"].str.split(",", expand=True).reset_index()
        ids_melted = (
            ids_expanded.melt(id_vars="index", value_name="fec_ids")
            .drop("variable", axis=1)
            .dropna()
        )

        # A000001 should have 2 FEC IDs, B000002 should have 1
        assert len(ids_melted) == 3
        assert set(ids_melted["fec_ids"]) == {"H001", "S001", "H002"}

    def test_instate_outstate_calculation(self):
        """Verify in-state vs out-of-state donation calculations."""
        state_data = pd.DataFrame(
            {
                "CAND_ID": ["H001", "H001", "H001"],
                "STATE": ["CA", "NY", "TX"],
                "total": [1000, 500, 200],
                "count": [10, 5, 2],
            }
        )

        leg_state = "CA"
        instate = state_data[
            (state_data["CAND_ID"] == "H001") & (state_data["STATE"] == leg_state)
        ]
        outstate = state_data[
            (state_data["CAND_ID"] == "H001") & (state_data["STATE"] != leg_state)
        ]

        assert int(instate["total"].sum()) == 1000
        assert int(outstate["total"].sum()) == 700
        assert int(instate["count"].sum()) == 10
        assert int(outstate["count"].sum()) == 7

    def test_ranking_calculation(self):
        """Verify money and donor rankings."""
        data = pd.DataFrame(
            {
                "bioguide_id": ["A", "B", "C"],
                "total_money": [1000, 3000, 2000],
                "total_ind_don": [100, 50, 200],
            }
        )

        data["total_money_rank"] = data["total_money"].rank(
            ascending=False, method="dense"
        )
        data["total_ind_don_rank"] = data["total_ind_don"].rank(
            ascending=False, method="dense"
        )

        # B has most money (rank 1)
        assert data.loc[data["bioguide_id"] == "B", "total_money_rank"].iloc[0] == 1.0
        # C has most individual donors (rank 1)
        assert data.loc[data["bioguide_id"] == "C", "total_ind_don_rank"].iloc[0] == 1.0

    def test_handles_empty_fec_data(self):
        """Empty FEC data should produce empty aggregations."""
        data = pd.DataFrame(
            {
                "CAND_ID": pd.Series(dtype="str"),
                "STATE": pd.Series(dtype="str"),
                "total": pd.Series(dtype="float"),
                "count": pd.Series(dtype="int"),
            }
        )
        instate = data[data["STATE"] == "CA"]
        assert len(instate) == 0
        assert float(instate["total"].sum()) == 0.0

    def test_multiple_fec_ids_per_legislator(self):
        """Legislators with multiple FEC IDs should have all contributions summed."""
        contributions = pd.DataFrame(
            {
                "CAND_ID": ["H001", "S001", "H001"],
                "total": [1000, 2000, 500],
            }
        )
        total = contributions.groupby("CAND_ID")["total"].sum()
        assert total["H001"] == 1500
        assert total["S001"] == 2000
        combined = contributions["total"].sum()
        assert combined == 3500
