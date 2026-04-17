"""Tests for legislator profile data processing."""

import pytest


class TestFederalLegislatorProcessing:
    def test_yaml_parsing(self, tmp_path):
        """Verify YAML legislator data can be parsed."""
        yaml_data = [
            {
                "id": {"bioguide": "A000001"},
                "name": {"first": "Jane", "last": "Doe"},
                "terms": [{"type": "sen", "state": "CA", "party": "Democrat"}],
            }
        ]

        yaml_file = tmp_path / "legislators.yaml"
        import yaml as pyyaml

        yaml_file.write_text(pyyaml.dump(yaml_data))

        loaded = pyyaml.safe_load(yaml_file.read_text())
        assert loaded[0]["id"]["bioguide"] == "A000001"
        assert loaded[0]["name"]["first"] == "Jane"

    def test_bioguide_id_format(self):
        """Bioguide IDs should be 7 characters: letter + 6 digits."""
        import re

        valid_ids = ["A000001", "W000800", "S001191"]
        for bid in valid_ids:
            assert re.match(r"^[A-Z]\d{6}$", bid), f"Invalid bioguide: {bid}"

    def test_handles_malformed_yaml(self, tmp_path):
        """Malformed YAML should raise an error."""
        import yaml as pyyaml

        yaml_file = tmp_path / "bad.yaml"
        yaml_file.write_text("{ invalid yaml: [")

        with pytest.raises(Exception):
            pyyaml.safe_load(yaml_file.read_text())

    def test_multiple_terms(self, tmp_path):
        """Legislators with multiple terms should have all terms accessible."""
        import yaml as pyyaml

        yaml_data = [
            {
                "id": {"bioguide": "A000001"},
                "name": {"first": "Jane", "last": "Doe"},
                "terms": [
                    {
                        "type": "rep",
                        "state": "CA",
                        "party": "Democrat",
                        "start": "2019-01-03",
                    },
                    {
                        "type": "sen",
                        "state": "CA",
                        "party": "Democrat",
                        "start": "2021-01-03",
                    },
                ],
            }
        ]
        yaml_file = tmp_path / "legislators.yaml"
        yaml_file.write_text(pyyaml.dump(yaml_data))

        loaded = pyyaml.safe_load(yaml_file.read_text())
        assert len(loaded[0]["terms"]) == 2
        assert loaded[0]["terms"][1]["type"] == "sen"
