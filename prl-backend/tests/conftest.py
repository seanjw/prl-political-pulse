"""Shared fixtures for PRL backend tests."""

import os
import sys
import pytest

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture(autouse=True)
def mock_env_vars(monkeypatch):
    """Set all expected environment variables for tests."""
    monkeypatch.setenv("DB_USER", "test_user")
    monkeypatch.setenv("DB_PASSWORD", "test_pass")
    monkeypatch.setenv("DB_HOST", "localhost")
    monkeypatch.setenv("DB_PORT", "3306")
    monkeypatch.setenv("DB_DIALECT", "mysql+pymysql")
    monkeypatch.setenv("CONGRESS_API", "test_congress_key")
    monkeypatch.setenv("TWITTER_API", "test_twitter_key")
    monkeypatch.setenv("OPENAI_API_KEY", "test_openai_key")
    monkeypatch.setenv("CURRENT_CONGRESS", "119")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    monkeypatch.setenv("PATH_TO_SECRETS", "")


@pytest.fixture
def mock_secrets():
    """Mock secrets data matching Secrets Manager structure."""
    return {
        "prl/database": {
            "DB_USER": "test_user",
            "DB_PASSWORD": "test_pass",
            "DB_HOST": "test-proxy.rds.amazonaws.com",
            "DB_PORT": "3306",
            "DB_DIALECT": "mysql+pymysql",
        },
        "prl/api-keys": {
            "CONGRESS_API": "test_congress_key",
            "TWITTER_API": "test_twitter_key",
            "OPENAI_API_KEY": "test_openai_key",
            "CURRENT_CONGRESS": "119",
        },
        "prl/google-credentials": {
            "type": "service_account",
            "project_id": "test-project",
        },
    }


@pytest.fixture
def mock_dataset_db(mocker):
    """Patch dataset.connect to return a mock DB."""
    mock_db = mocker.MagicMock()
    mock_table = mocker.MagicMock()
    mock_db.__getitem__ = mocker.MagicMock(return_value=mock_table)
    mock_db.__enter__ = mocker.MagicMock(return_value=mock_db)
    mock_db.__exit__ = mocker.MagicMock(return_value=False)

    mocker.patch("dataset.connect", return_value=mock_db)
    return mock_db, mock_table
