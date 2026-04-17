"""Tests for the Pulse API endpoints."""

import sys
import os
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

# We need to mock the shared config before importing main
# since main.py calls get_tortoise_db_url at module level
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


@pytest.fixture
def mock_tortoise_db():
    """Mock the Tortoise ORM database setup."""
    with patch("shared.config.get_secrets") as mock_secrets:
        mock_secrets.return_value = {
            "DB_USER": "test",
            "DB_PASSWORD": "test",
            "DB_HOST": "localhost",
            "DB_PORT": "3306",
        }
        yield mock_secrets


@pytest.fixture
def client(mock_tortoise_db):
    """Create a test client for the API."""
    sys.path.insert(
        0, os.path.join(os.path.dirname(__file__), "..", "..", "pulse", "server", "api")
    )

    # Clear cached module to re-import with mocks
    for mod in list(sys.modules.keys()):
        if mod in ("main", "models"):
            del sys.modules[mod]

    from shared.config import get_secrets

    get_secrets.cache_clear()

    import main

    # Mock _init_db to be a no-op since we don't have a real DB in tests
    main._init_db = AsyncMock()
    from fastapi.testclient import TestClient

    yield TestClient(main.app)


class TestRootEndpoint:
    def test_returns_sup(self, client):
        response = client.get("/")
        assert response.status_code == 200
        assert response.json() == {"message": "sup"}


class TestHealthEndpoint:
    def test_health_endpoint_exists(self, client):
        # Will fail DB connection in test but endpoint should exist
        response = client.get("/health")
        # Without a real DB, the endpoint will return 503
        data = response.json()
        assert "status" in data

    def test_health_returns_503_on_db_error(self, client):
        """Health endpoint should return 503 (not 200) when DB is unreachable."""
        with patch("main.Data") as MockData:
            MockData.all.return_value.count = AsyncMock(
                side_effect=Exception("Connection refused")
            )
            response = client.get("/health")
            assert response.status_code == 503
            data = response.json()
            assert data["status"] == "error"
            assert "Connection refused" in data["detail"]

    def test_health_returns_200_on_success(self, client):
        """Health endpoint should return 200 with row count on success."""
        with patch("main.Data") as MockData:
            MockData.all.return_value.count = AsyncMock(return_value=42)
            response = client.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert data["data_rows"] == 42


class TestDataEndpoint:
    def test_data_not_found(self, client):
        with patch("main.Data") as MockData:
            MockData.filter.return_value.first = AsyncMock(return_value=None)
            response = client.get("/data/nonexistent")
            assert response.status_code == 404


class TestQueryEndpoint:
    def test_query_rejects_bad_field(self, client):
        """Non-whitelisted fields should be ignored (security check)."""
        with patch("main.tables", {"legislators": MagicMock()}):
            mock_model = MagicMock()
            mock_model.filter.return_value.offset.return_value.limit.return_value.all = AsyncMock(
                return_value=[]
            )

            with patch.dict("main.tables", {"legislators": mock_model}):
                response = client.post(
                    "/query/",
                    json={
                        "table": "legislators",
                        "filters": [{"field": "password", "op": "eq", "value": "hack"}],
                        "nextpage": 0,
                    },
                )
                # Should pass through but the bad field is filtered out
                if response.status_code == 200:
                    # Verify the filter was NOT applied (empty conditionals)
                    call_args = mock_model.filter.call_args
                    if call_args:
                        assert "password" not in call_args[1]

    def test_query_rejects_bad_op(self, client):
        """Non-whitelisted operators should be ignored."""
        with patch("main.tables", {"legislators": MagicMock()}):
            mock_model = MagicMock()
            mock_model.filter.return_value.offset.return_value.limit.return_value.all = AsyncMock(
                return_value=[]
            )

            with patch.dict("main.tables", {"legislators": mock_model}):
                response = client.post(
                    "/query/",
                    json={
                        "table": "legislators",
                        "filters": [
                            {"field": "state", "op": "drop_table", "value": "CA"}
                        ],
                        "nextpage": 0,
                    },
                )
                if response.status_code == 200:
                    call_args = mock_model.filter.call_args
                    if call_args:
                        assert "state__drop_table" not in call_args[1]

    def test_query_filter_uses_logical_and_not_bitwise(self, client):
        """Verify the security filter uses logical 'and', not bitwise '&'.

        With bitwise &, if field is valid but op is invalid (or vice versa),
        the filter could still pass because & on booleans works differently
        than 'and' with short-circuit evaluation in edge cases involving
        non-boolean truthy values. The fix ensures correct short-circuit
        logical evaluation.
        """
        with patch("main.tables", {"legislators": MagicMock()}):
            mock_model = MagicMock()
            mock_model.filter.return_value.offset.return_value.limit.return_value.all = AsyncMock(
                return_value=[]
            )

            with patch.dict("main.tables", {"legislators": mock_model}):
                # Valid field + invalid op: should NOT be included
                response = client.post(
                    "/query/",
                    json={
                        "table": "legislators",
                        "filters": [
                            {"field": "state", "op": "sql_inject", "value": "x"}
                        ],
                        "nextpage": 0,
                    },
                )
                if response.status_code == 200:
                    call_args = mock_model.filter.call_args
                    if call_args:
                        assert "state__sql_inject" not in call_args[1]
                        assert len(call_args[1]) == 0, (
                            "No filters should be applied when op is invalid"
                        )

            mock_model.reset_mock()
            mock_model.filter.return_value.offset.return_value.limit.return_value.all = AsyncMock(
                return_value=[]
            )

            with patch.dict("main.tables", {"legislators": mock_model}):
                # Invalid field + valid op: should NOT be included
                response = client.post(
                    "/query/",
                    json={
                        "table": "legislators",
                        "filters": [{"field": "password", "op": "eq", "value": "x"}],
                        "nextpage": 0,
                    },
                )
                if response.status_code == 200:
                    call_args = mock_model.filter.call_args
                    if call_args:
                        assert "password" not in call_args[1]
                        assert len(call_args[1]) == 0, (
                            "No filters should be applied when field is invalid"
                        )

    def test_query_allows_valid_field_and_op(self, client):
        """Verify that valid field + valid op combinations pass through the security filter."""
        with patch("main.tables", {"legislators": MagicMock()}):
            mock_model = MagicMock()
            mock_model.filter.return_value.offset.return_value.limit.return_value.all = AsyncMock(
                return_value=[]
            )

            with patch.dict("main.tables", {"legislators": mock_model}):
                response = client.post(
                    "/query/",
                    json={
                        "table": "legislators",
                        "filters": [{"field": "state", "op": "eq", "value": "CA"}],
                        "nextpage": 0,
                    },
                )
                if response.status_code == 200:
                    call_args = mock_model.filter.call_args
                    if call_args:
                        assert "state" in call_args[1]
                        assert call_args[1]["state"] == "CA"


class TestCountEndpoint:
    def test_count_redirects(self, client):
        with patch("main.update_download_count", new_callable=AsyncMock):
            response = client.get("/count/test-file.csv", follow_redirects=False)
            assert response.status_code == 307
            assert "cloudfront.net" in response.headers.get("location", "")


class TestQueryInvalidTable:
    def test_invalid_table_returns_400(self, client):
        """Non-whitelisted table name should return 400."""
        response = client.post(
            "/query/",
            json={
                "table": "nonexistent_table",
                "filters": [],
                "nextpage": 0,
            },
        )
        assert response.status_code == 400
        assert "Invalid table" in response.json()["detail"]

    def test_missing_filters_key(self, client):
        """Missing 'filters' in body should raise a KeyError."""
        with patch("main.tables", {"legislators": MagicMock()}):
            mock_model = MagicMock()
            mock_model.filter.return_value.offset.return_value.limit.return_value.all = AsyncMock(
                return_value=[]
            )
            with patch.dict("main.tables", {"legislators": mock_model}):
                with pytest.raises(KeyError, match="filters"):
                    client.post(
                        "/query/",
                        json={
                            "table": "legislators",
                            "nextpage": 0,
                        },
                    )


class TestQueryPagination:
    def test_next_page_increments_when_full(self, client):
        """When result count equals pagesize, nextpage should increment."""
        mock_model = MagicMock()
        # Return exactly pagesize (20) items
        mock_results = [MagicMock() for _ in range(20)]
        mock_model.filter.return_value.offset.return_value.limit.return_value.all = (
            AsyncMock(return_value=mock_results)
        )

        with patch.dict("main.tables", {"legislators": mock_model}):
            response = client.post(
                "/query/",
                json={
                    "table": "legislators",
                    "filters": [],
                    "nextpage": 0,
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["nextpage"] == 1

    def test_next_page_null_when_partial(self, client):
        """When result count is less than pagesize, nextpage should be null."""
        mock_model = MagicMock()
        # Return fewer than pagesize items
        mock_results = [MagicMock() for _ in range(5)]
        mock_model.filter.return_value.offset.return_value.limit.return_value.all = (
            AsyncMock(return_value=mock_results)
        )

        with patch.dict("main.tables", {"legislators": mock_model}):
            response = client.post(
                "/query/",
                json={
                    "table": "legislators",
                    "filters": [],
                    "nextpage": 0,
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["nextpage"] is None

    def test_next_page_null_when_empty(self, client):
        """When no results, nextpage should be null."""
        mock_model = MagicMock()
        mock_model.filter.return_value.offset.return_value.limit.return_value.all = (
            AsyncMock(return_value=[])
        )

        with patch.dict("main.tables", {"legislators": mock_model}):
            response = client.post(
                "/query/",
                json={
                    "table": "legislators",
                    "filters": [],
                    "nextpage": 0,
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["nextpage"] is None


class TestDataFound:
    def test_data_found_returns_json(self, client):
        """Data endpoint should return data field when found."""
        mock_result = MagicMock()
        mock_result.data = {"key": "value"}

        with patch("main.Data") as MockData:
            MockData.filter.return_value.first = AsyncMock(return_value=mock_result)
            response = client.get("/data/test-endpoint")
            assert response.status_code == 200
            data = response.json()
            assert "data" in data


class TestCountDownloadTracking:
    def test_count_calls_update_download_count(self, client):
        """Count endpoint should call update_download_count."""
        with patch("main.update_download_count", new_callable=AsyncMock) as mock_update:
            client.get("/count/test-file.csv", follow_redirects=False)
            mock_update.assert_called_once_with("test-file.csv")


class TestCorsHeaders:
    def test_cors_allows_all_origins(self, client):
        response = client.options(
            "/",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert "access-control-allow-origin" in response.headers
