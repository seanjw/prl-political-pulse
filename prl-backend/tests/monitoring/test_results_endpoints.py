"""Tests for the monitoring /results endpoints (job_results from RDS)."""

import json
import sys
import os
from unittest.mock import patch, MagicMock
from datetime import datetime
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "monitoring"))

# Set ADMIN_PASSWORD before importing handler
os.environ["ADMIN_PASSWORD"] = "test-password-123"

from handler import app

client = TestClient(app)

AUTH_HEADERS = {"x-admin-password": "test-password-123"}


def _mock_db_connection(rows, columns):
    """Helper to create a mock DB connection with cursor results."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = rows
    mock_cursor.fetchone.return_value = rows[0] if rows else None
    mock_cursor.description = [(col,) for col in columns]
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return mock_conn


# ---------------------------------------------------------------------------
# /results/summary
# ---------------------------------------------------------------------------


class TestResultsSummary:
    def test_returns_summary_for_all_jobs(self):
        columns = [
            "job_name",
            "started_at",
            "completed_at",
            "duration_seconds",
            "status",
            "records_processed",
            "error_count",
            "headline_metrics_json",
            "metrics_json",
        ]
        rows = [
            (
                "floor-ingest",
                datetime(2025, 1, 15, 10, 0, 0),
                datetime(2025, 1, 15, 10, 2, 30),
                150.0,
                "success",
                42,
                0,
                json.dumps(
                    [
                        {
                            "key": "new_speeches",
                            "label": "New Speeches",
                            "format": "number",
                            "value": 42,
                        }
                    ]
                ),
                json.dumps({"new_speeches": 42, "api_calls": 5}),
            ),
            (
                "twitter-ingest",
                datetime(2025, 1, 15, 10, 5, 0),
                datetime(2025, 1, 15, 10, 10, 0),
                300.0,
                "success",
                100,
                0,
                None,
                json.dumps({"new_federal_tweets": 80, "new_state_tweets": 20}),
            ),
        ]
        mock_conn = _mock_db_connection(rows, columns)

        with patch("handler._get_db_connection", return_value=mock_conn):
            response = client.get("/results/summary", headers=AUTH_HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "floor-ingest" in data["summary"]
        assert "twitter-ingest" in data["summary"]
        fi = data["summary"]["floor-ingest"]
        assert fi["status"] == "success"
        assert fi["records_processed"] == 42
        assert fi["error_count"] == 0
        assert fi["headline_metrics"][0]["value"] == 42

    def test_returns_empty_summary_when_no_results(self):
        columns = [
            "job_name",
            "started_at",
            "completed_at",
            "duration_seconds",
            "status",
            "records_processed",
            "error_count",
            "headline_metrics_json",
            "metrics_json",
        ]
        mock_conn = _mock_db_connection([], columns)

        with patch("handler._get_db_connection", return_value=mock_conn):
            response = client.get("/results/summary", headers=AUTH_HEADERS)

        assert response.status_code == 200
        assert response.json()["summary"] == {}

    def test_handles_db_connection_failure(self):
        with patch(
            "handler._get_db_connection", side_effect=Exception("connection refused")
        ):
            response = client.get("/results/summary", headers=AUTH_HEADERS)

        assert response.status_code == 500

    def test_requires_auth(self):
        response = client.get("/results/summary")
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# /results/{job_name}
# ---------------------------------------------------------------------------


class TestResultsHistory:
    def test_returns_history_for_job(self):
        columns = [
            "id",
            "started_at",
            "completed_at",
            "duration_seconds",
            "status",
            "records_processed",
            "error_count",
            "metrics_json",
            "headline_metrics_json",
        ]
        rows = [
            (
                1,
                datetime(2025, 1, 15, 10, 0, 0),
                datetime(2025, 1, 15, 10, 2, 30),
                150.0,
                "success",
                42,
                0,
                json.dumps({"new_speeches": 42}),
                None,
            ),
            (
                2,
                datetime(2025, 1, 14, 10, 0, 0),
                datetime(2025, 1, 14, 10, 3, 0),
                180.0,
                "success",
                38,
                0,
                json.dumps({"new_speeches": 38}),
                None,
            ),
        ]
        mock_conn = _mock_db_connection(rows, columns)

        with patch("handler._get_db_connection", return_value=mock_conn):
            response = client.get("/results/floor-ingest", headers=AUTH_HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert data["job_name"] == "floor-ingest"
        assert len(data["results"]) == 2
        assert data["days"] == 30

    def test_respects_days_parameter(self):
        columns = [
            "id",
            "started_at",
            "completed_at",
            "duration_seconds",
            "status",
            "records_processed",
            "error_count",
            "metrics_json",
            "headline_metrics_json",
        ]
        mock_conn = _mock_db_connection([], columns)
        mock_cursor = mock_conn.cursor.return_value.__enter__.return_value

        with patch("handler._get_db_connection", return_value=mock_conn):
            response = client.get("/results/floor-ingest?days=7", headers=AUTH_HEADERS)

        assert response.status_code == 200
        assert response.json()["days"] == 7
        # Verify the days parameter was passed in the SQL
        sql_params = mock_cursor.execute.call_args[0][1]
        assert sql_params[0] == "floor-ingest"
        assert sql_params[1] == 7

    def test_caps_days_at_90(self):
        columns = [
            "id",
            "started_at",
            "completed_at",
            "duration_seconds",
            "status",
            "records_processed",
            "error_count",
            "metrics_json",
            "headline_metrics_json",
        ]
        mock_conn = _mock_db_connection([], columns)

        with patch("handler._get_db_connection", return_value=mock_conn):
            response = client.get(
                "/results/floor-ingest?days=365", headers=AUTH_HEADERS
            )

        assert response.status_code == 200
        assert response.json()["days"] == 90

    def test_handles_db_failure(self):
        with patch("handler._get_db_connection", side_effect=Exception("db error")):
            response = client.get("/results/floor-ingest", headers=AUTH_HEADERS)

        assert response.status_code == 500


# ---------------------------------------------------------------------------
# /results/{job_name}/latest
# ---------------------------------------------------------------------------


class TestResultsLatest:
    def test_returns_latest_result(self):
        columns = [
            "id",
            "started_at",
            "completed_at",
            "duration_seconds",
            "status",
            "exit_code",
            "records_processed",
            "error_count",
            "errors_json",
            "metrics_json",
            "headline_metrics_json",
            "steps_json",
        ]
        rows = [
            (
                5,
                datetime(2025, 1, 15, 10, 0, 0),
                datetime(2025, 1, 15, 10, 2, 30),
                150.0,
                "success",
                0,
                42,
                0,
                None,
                json.dumps({"new_speeches": 42, "api_calls": 5}),
                json.dumps(
                    [
                        {
                            "key": "new_speeches",
                            "label": "New Speeches",
                            "format": "number",
                            "value": 42,
                        }
                    ]
                ),
                json.dumps(
                    [
                        {
                            "name": "ingest",
                            "status": "success",
                            "duration_seconds": 120.5,
                        }
                    ]
                ),
            )
        ]
        mock_conn = _mock_db_connection(rows, columns)

        with patch("handler._get_db_connection", return_value=mock_conn):
            response = client.get("/results/floor-ingest/latest", headers=AUTH_HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert data["job_name"] == "floor-ingest"
        result = data["result"]
        assert result["id"] == 5
        assert result["status"] == "success"
        assert result["exit_code"] == 0
        assert result["records_processed"] == 42
        assert result["metrics"]["new_speeches"] == 42
        assert result["steps"][0]["name"] == "ingest"

    def test_returns_null_when_no_results(self):
        columns = [
            "id",
            "started_at",
            "completed_at",
            "duration_seconds",
            "status",
            "exit_code",
            "records_processed",
            "error_count",
            "errors_json",
            "metrics_json",
            "headline_metrics_json",
            "steps_json",
        ]
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_cursor.description = [(col,) for col in columns]
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with patch("handler._get_db_connection", return_value=mock_conn):
            response = client.get("/results/floor-ingest/latest", headers=AUTH_HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert data["result"] is None

    def test_returns_errors_when_present(self):
        columns = [
            "id",
            "started_at",
            "completed_at",
            "duration_seconds",
            "status",
            "exit_code",
            "records_processed",
            "error_count",
            "errors_json",
            "metrics_json",
            "headline_metrics_json",
            "steps_json",
        ]
        errors = [
            {
                "message": "Connection timeout",
                "traceback": "Traceback ...",
                "step": "ingest",
                "timestamp": "2025-01-15T10:01:00",
            }
        ]
        rows = [
            (
                6,
                datetime(2025, 1, 15, 10, 0, 0),
                datetime(2025, 1, 15, 10, 1, 30),
                90.0,
                "failure",
                1,
                0,
                1,
                json.dumps(errors),
                json.dumps({}),
                None,
                None,
            )
        ]
        mock_conn = _mock_db_connection(rows, columns)

        with patch("handler._get_db_connection", return_value=mock_conn):
            response = client.get("/results/floor-ingest/latest", headers=AUTH_HEADERS)

        assert response.status_code == 200
        result = response.json()["result"]
        assert result["status"] == "failure"
        assert result["error_count"] == 1
        assert len(result["errors"]) == 1
        assert result["errors"][0]["message"] == "Connection timeout"

    def test_handles_db_failure(self):
        with patch("handler._get_db_connection", side_effect=Exception("db error")):
            response = client.get("/results/floor-ingest/latest", headers=AUTH_HEADERS)

        assert response.status_code == 500
