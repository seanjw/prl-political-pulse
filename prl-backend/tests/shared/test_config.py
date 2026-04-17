"""Tests for shared.config module."""

import json
from unittest.mock import patch, MagicMock


class TestGetSecrets:
    def test_returns_parsed_json(self, mock_secrets):
        from shared.config import get_secrets

        get_secrets.cache_clear()

        mock_client = MagicMock()
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(mock_secrets["prl/database"])
        }

        with patch("boto3.client", return_value=mock_client):
            result = get_secrets("prl/database")

        assert result["DB_USER"] == "test_user"
        assert result["DB_HOST"] == "test-proxy.rds.amazonaws.com"
        mock_client.get_secret_value.assert_called_once_with(SecretId="prl/database")

    def test_caches_results(self, mock_secrets):
        from shared.config import get_secrets

        get_secrets.cache_clear()

        mock_client = MagicMock()
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(mock_secrets["prl/database"])
        }

        with patch("boto3.client", return_value=mock_client):
            get_secrets("prl/database")
            get_secrets("prl/database")

        # Should only call once due to lru_cache
        assert mock_client.get_secret_value.call_count == 1


class TestGetDbUrl:
    def test_builds_mysql_url(self, mock_secrets):
        from shared.config import get_secrets, get_db_url

        get_secrets.cache_clear()

        mock_client = MagicMock()
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(mock_secrets["prl/database"])
        }

        with patch("boto3.client", return_value=mock_client):
            url = get_db_url("elite")

        assert "test_user" in url
        assert "test-proxy.rds.amazonaws.com" in url
        assert "/elite" in url

    def test_defaults_to_elite_database(self, mock_secrets):
        from shared.config import get_secrets, get_db_url

        get_secrets.cache_clear()

        mock_client = MagicMock()
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(mock_secrets["prl/database"])
        }

        with patch("boto3.client", return_value=mock_client):
            url = get_db_url()

        assert url.endswith("/elite")

    def test_url_encodes_special_chars_in_password(self, mock_secrets):
        """Passwords with @, :, / should be URL-encoded."""
        from shared.config import get_secrets, get_db_url

        get_secrets.cache_clear()

        secrets = {
            "DB_USER": "test_user",
            "DB_PASSWORD": "p@ss:w/rd",
            "DB_HOST": "test-proxy.rds.amazonaws.com",
            "DB_PORT": "3306",
        }
        mock_client = MagicMock()
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(secrets)
        }

        with patch("boto3.client", return_value=mock_client):
            url = get_db_url("elite")

        # Special chars should be encoded (quote() leaves / safe by default)
        assert "p%40ss%3Aw" in url
        assert (
            "@" not in url.split("://", 1)[1].split("@")[0]
        )  # @ in password portion is encoded

    def test_custom_dialect(self, mock_secrets):
        """Custom dialect should be used as prefix."""
        from shared.config import get_secrets, get_db_url

        get_secrets.cache_clear()

        mock_client = MagicMock()
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(mock_secrets["prl/database"])
        }

        with patch("boto3.client", return_value=mock_client):
            url = get_db_url("elite", dialect="mysql+pymysql")

        assert url.startswith("mysql+pymysql://")


class TestGetTortoiseDbUrl:
    def test_builds_async_mysql_url(self, mock_secrets):
        from shared.config import get_secrets, get_tortoise_db_url

        get_secrets.cache_clear()

        mock_client = MagicMock()
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(mock_secrets["prl/database"])
        }

        with patch("boto3.client", return_value=mock_client):
            url = get_tortoise_db_url("pulse")

        assert url.startswith("mysql://")
        assert "/pulse" in url


class TestLoadConfig:
    def test_sets_env_vars(self, mock_secrets):
        import os
        from shared.config import get_secrets, load_config

        get_secrets.cache_clear()

        mock_client = MagicMock()

        def side_effect(SecretId):
            return {"SecretString": json.dumps(mock_secrets[SecretId])}

        mock_client.get_secret_value.side_effect = side_effect

        with patch("boto3.client", return_value=mock_client):
            load_config()

        assert os.environ["DB_USER"] == "test_user"
        assert os.environ["CONGRESS_API"] == "test_congress_key"

    def test_sets_all_api_keys(self, mock_secrets):
        """Verify all API keys are set in environment."""
        import os
        from shared.config import get_secrets, load_config

        get_secrets.cache_clear()

        mock_client = MagicMock()

        def side_effect(SecretId):
            return {"SecretString": json.dumps(mock_secrets[SecretId])}

        mock_client.get_secret_value.side_effect = side_effect

        with patch("boto3.client", return_value=mock_client):
            load_config()

        assert os.environ["OPENAI_API_KEY"] == "test_openai_key"
        assert os.environ["CURRENT_CONGRESS"] == "119"
        assert os.environ["TWITTER_API"] == "test_twitter_key"


class TestSetupGoogleCreds:
    def test_creates_temp_file_and_sets_env(self, mock_secrets):
        """Verify temp file is written and env var set."""
        import os
        from shared.config import get_secrets, setup_google_creds

        get_secrets.cache_clear()

        mock_client = MagicMock()

        def side_effect(SecretId):
            return {"SecretString": json.dumps(mock_secrets[SecretId])}

        mock_client.get_secret_value.side_effect = side_effect

        with patch("boto3.client", return_value=mock_client):
            with setup_google_creds() as creds_path:
                assert os.path.exists(creds_path)
                assert os.environ.get("PATH_TO_GOOGLE_CREDS") == creds_path
                with open(creds_path) as f:
                    data = json.load(f)
                assert data["type"] == "service_account"

        # After context manager exits, file should be cleaned up
        assert not os.path.exists(creds_path)
        assert "PATH_TO_GOOGLE_CREDS" not in os.environ

    def test_cleans_up_on_error(self, mock_secrets):
        """Verify cleanup happens even when exception occurs."""
        import os
        from shared.config import get_secrets, setup_google_creds

        get_secrets.cache_clear()

        mock_client = MagicMock()

        def side_effect(SecretId):
            return {"SecretString": json.dumps(mock_secrets[SecretId])}

        mock_client.get_secret_value.side_effect = side_effect

        creds_path = None
        with patch("boto3.client", return_value=mock_client):
            try:
                with setup_google_creds() as path:
                    creds_path = path
                    raise RuntimeError("simulated error")
            except RuntimeError:
                pass

        assert creds_path is not None
        assert not os.path.exists(creds_path)
        assert "PATH_TO_GOOGLE_CREDS" not in os.environ
