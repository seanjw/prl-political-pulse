"""Tests for static Tortoise ORM model definitions."""

import sys
import os

sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "..", "pulse", "server", "api")
)

from models import Data, Legislators, FederalProfiles, StateProfiles, DownloadCounts


class TestDataModel:
    def test_has_expected_fields(self):
        field_names = set(Data._meta.fields_map.keys())
        assert "id" in field_names
        assert "endpoint" in field_names
        assert "data" in field_names

    def test_table_name(self):
        assert Data._meta.db_table == "data"


class TestLegislatorsModel:
    def test_has_expected_fields(self):
        field_names = set(Legislators._meta.fields_map.keys())
        for field in [
            "id",
            "bioguide_id",
            "name",
            "state",
            "party",
            "type",
            "level",
            "source_id",
        ]:
            assert field in field_names, f"Missing field: {field}"

    def test_table_name(self):
        assert Legislators._meta.db_table == "legislators"


class TestFederalProfilesModel:
    def test_has_profile_fields(self):
        field_names = set(FederalProfiles._meta.fields_map.keys())
        for field in [
            "ideology_ideology",
            "efficacy_sponsored",
            "attendance_total",
            "money_total_money",
            "communication_scores",
        ]:
            assert field in field_names, f"Missing profile field: {field}"

    def test_table_name(self):
        assert FederalProfiles._meta.db_table == "federal_profiles"


class TestStateProfilesModel:
    def test_has_rhetoric_field(self):
        field_names = set(StateProfiles._meta.fields_map.keys())
        assert "rhetoric" in field_names

    def test_table_name(self):
        assert StateProfiles._meta.db_table == "state_profiles"


class TestDownloadCountsModel:
    def test_has_expected_fields(self):
        field_names = set(DownloadCounts._meta.fields_map.keys())
        assert "file" in field_names
        assert "downloads" in field_names

    def test_table_name(self):
        assert DownloadCounts._meta.db_table == "download_counts"
