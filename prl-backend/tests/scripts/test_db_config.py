"""Tests for the _get_db_config pattern used across all migrated scripts.

All four scripts (process_us_wave, regenerate_all_data_zip,
generate_international_aggregate_data, generate_international_questions_data)
use the same pattern to load DB config from Secrets Manager via shared.config.
"""

import importlib
import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


# Each tuple: (module_path, patch_target, expected_default_db)
SCRIPTS_WITH_DB_CONFIG = [
    ("scripts.process_us_wave", "scripts.process_us_wave.get_secrets", "pulse"),
    (
        "scripts.regenerate_all_data_zip",
        "scripts.regenerate_all_data_zip.get_secrets",
        "surveys",
    ),
    (
        "scripts.generate_international_aggregate_data",
        "scripts.generate_international_aggregate_data.get_secrets",
        "pulse",
    ),
    (
        "scripts.generate_international_questions_data",
        "scripts.generate_international_questions_data.get_secrets",
        "pulse",
    ),
]


def _make_secrets(overrides=None):
    secrets = {
        "DB_HOST": "test-host.rds.amazonaws.com",
        "DB_USER": "test_user",
        "DB_PASSWORD": "test_p@ss!",
        "DB_PORT": "3306",
    }
    if overrides:
        secrets.update(overrides)
    return secrets


class TestGetDbConfig:
    """Test _get_db_config across all scripts."""

    @pytest.mark.parametrize(
        "module_path,patch_target,expected_db", SCRIPTS_WITH_DB_CONFIG
    )
    def test_returns_correct_fields(self, module_path, patch_target, expected_db):
        """Each script's _get_db_config returns host, user, password, port, database."""
        mod = importlib.import_module(module_path)
        with patch(patch_target, return_value=_make_secrets()):
            config = mod._get_db_config()
        assert config["host"] == "test-host.rds.amazonaws.com"
        assert config["user"] == "test_user"
        assert config["password"] == "test_p@ss!"
        assert config["port"] == 3306
        assert config["database"] == expected_db

    @pytest.mark.parametrize(
        "module_path,patch_target,expected_db", SCRIPTS_WITH_DB_CONFIG
    )
    def test_calls_get_secrets_with_prl_database(
        self, module_path, patch_target, expected_db
    ):
        """Each script calls get_secrets('prl/database')."""
        mod = importlib.import_module(module_path)
        with patch(patch_target, return_value=_make_secrets()) as mock_fn:
            mod._get_db_config()
            mock_fn.assert_called_with("prl/database")

    @pytest.mark.parametrize(
        "module_path,patch_target,expected_db", SCRIPTS_WITH_DB_CONFIG
    )
    def test_port_is_integer(self, module_path, patch_target, expected_db):
        """Port should be converted to int even if secret returns string."""
        mod = importlib.import_module(module_path)
        with patch(patch_target, return_value=_make_secrets()):
            config = mod._get_db_config()
        assert isinstance(config["port"], int)

    def test_process_us_wave_custom_database(self):
        """process_us_wave._get_db_config allows custom database parameter."""
        from scripts.process_us_wave import _get_db_config

        with patch("scripts.process_us_wave.get_secrets", return_value=_make_secrets()):
            config = _get_db_config(database="elite")
        assert config["database"] == "elite"

    def test_regenerate_uses_surveys_database(self):
        """regenerate_all_data_zip defaults to 'surveys' database."""
        from scripts.regenerate_all_data_zip import _get_db_config

        with patch(
            "scripts.regenerate_all_data_zip.get_secrets", return_value=_make_secrets()
        ):
            config = _get_db_config()
        assert config["database"] == "surveys"

    def test_special_chars_in_password(self):
        """Passwords with special chars should pass through unchanged."""
        secrets = _make_secrets({"DB_PASSWORD": "p@$$w0rd!#%&*"})
        from scripts.process_us_wave import _get_db_config

        with patch("scripts.process_us_wave.get_secrets", return_value=secrets):
            config = _get_db_config()
        assert config["password"] == "p@$$w0rd!#%&*"

    def test_port_conversion_with_non_standard_port(self):
        """Non-default port should be handled."""
        secrets = _make_secrets({"DB_PORT": "3307"})
        from scripts.process_us_wave import _get_db_config

        with patch("scripts.process_us_wave.get_secrets", return_value=secrets):
            config = _get_db_config()
        assert config["port"] == 3307

    def test_no_hardcoded_credentials(self):
        """Verify no script files contain hardcoded DB_CONFIG dicts with passwords."""
        scripts_dir = os.path.join(os.path.dirname(__file__), "..", "..", "scripts")
        for filename in os.listdir(scripts_dir):
            if filename.endswith(".py"):
                filepath = os.path.join(scripts_dir, filename)
                with open(filepath) as f:
                    content = f.read()
                assert "6@ov7VL2" not in content, (
                    f"Hardcoded password found in {filename}"
                )
                # Check for the old pattern: DB_CONFIG = { ... 'password': ... }
                if "'password'" in content:
                    # Only _get_db_config should reference 'password'
                    lines_with_password = [
                        line.strip()
                        for line in content.split("\n")
                        if "'password'" in line
                    ]
                    for line in lines_with_password:
                        assert "secrets[" in line or "DB_PASSWORD" in line, (
                            f"Suspicious hardcoded password pattern in {filename}: {line}"
                        )
