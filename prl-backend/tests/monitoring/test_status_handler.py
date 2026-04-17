"""Tests for the monitoring status API."""

import sys
import os
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "monitoring"))

# Set ADMIN_PASSWORD before importing handler
os.environ["ADMIN_PASSWORD"] = "test-password-123"

from handler import app

client = TestClient(app)

AUTH_HEADERS = {"x-admin-password": "test-password-123"}
BAD_AUTH_HEADERS = {"x-admin-password": "wrong"}


# ---------------------------------------------------------------------------
# Auth middleware
# ---------------------------------------------------------------------------


class TestAuthMiddleware:
    def test_missing_password_returns_401(self):
        with patch("handler._ecs_client"):
            response = client.get("/status")
            assert response.status_code == 401

    def test_wrong_password_returns_401(self):
        with patch("handler._ecs_client"):
            response = client.get("/status", headers=BAD_AUTH_HEADERS)
            assert response.status_code == 401

    def test_correct_password_passes(self):
        mock_ecs = MagicMock()
        mock_ecs.list_tasks.return_value = {"taskArns": []}
        mock_lambda = MagicMock()
        mock_lambda.get_function.side_effect = Exception("not found")
        mock_lambda.exceptions = type(
            "Exc", (), {"ResourceNotFoundException": Exception}
        )()

        with (
            patch("handler._ecs_client", return_value=mock_ecs),
            patch("handler._lambda_client", return_value=mock_lambda),
            patch(
                "handler._cw_client",
                return_value=MagicMock(
                    get_metric_statistics=MagicMock(return_value={"Datapoints": []})
                ),
            ),
            patch("handler._get_db_connection", side_effect=Exception("no db")),
        ):
            response = client.get("/status", headers=AUTH_HEADERS)
            assert response.status_code == 200

    def test_health_endpoint_no_auth(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# Overall status
# ---------------------------------------------------------------------------


class TestOverallStatus:
    def test_status_returns_combined_health(self):
        mock_ecs = MagicMock()
        mock_ecs.list_tasks.return_value = {"taskArns": []}

        mock_lambda = MagicMock()
        mock_lambda.get_function.return_value = {"Configuration": {"State": "Active"}}
        mock_lambda.exceptions = type(
            "Exc", (), {"ResourceNotFoundException": Exception}
        )()

        mock_cw = MagicMock()
        mock_cw.get_metric_statistics.return_value = {"Datapoints": []}

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with (
            patch("handler._ecs_client", return_value=mock_ecs),
            patch("handler._lambda_client", return_value=mock_lambda),
            patch("handler._cw_client", return_value=mock_cw),
            patch("handler._get_db_connection", return_value=mock_conn),
        ):
            response = client.get("/status", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert "jobs" in data
            assert "apis" in data
            assert "database" in data

    def test_status_degrades_on_api_error(self):
        mock_ecs = MagicMock()
        mock_ecs.list_tasks.return_value = {"taskArns": []}

        with (
            patch("handler._ecs_client", return_value=mock_ecs),
            patch("handler._lambda_client", side_effect=Exception("Lambda error")),
            patch("handler._get_db_connection", side_effect=Exception("DB error")),
        ):
            response = client.get("/status", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "error"


# ---------------------------------------------------------------------------
# List jobs
# ---------------------------------------------------------------------------


class TestListJobs:
    def test_lists_running_and_stopped(self):
        mock_ecs = MagicMock()
        mock_ecs.list_tasks.return_value = {"taskArns": []}

        with patch("handler._ecs_client", return_value=mock_ecs):
            response = client.get("/status/jobs", headers=AUTH_HEADERS)
            assert response.status_code == 200
            assert "jobs" in response.json()

    def test_with_running_tasks(self):
        mock_ecs = MagicMock()
        mock_ecs.list_tasks.side_effect = [
            {"taskArns": ["arn:aws:ecs:us-east-1:123:task/prl/abc123"]},
            {"taskArns": []},
        ]
        mock_ecs.describe_tasks.return_value = {
            "tasks": [
                {
                    "taskArn": "arn:aws:ecs:us-east-1:123:task/prl/abc123",
                    "taskDefinitionArn": "arn:aws:ecs:us-east-1:123:task-definition/prl-floor-ingest:1",
                    "lastStatus": "RUNNING",
                    "startedAt": datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc),
                    "containers": [{"exitCode": None}],
                }
            ],
        }

        with patch("handler._ecs_client", return_value=mock_ecs):
            response = client.get("/status/jobs", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            assert len(data["jobs"]) == 1
            assert data["jobs"][0]["status"] == "RUNNING"


# ---------------------------------------------------------------------------
# Job history
# ---------------------------------------------------------------------------


class TestJobHistory:
    def test_returns_history_per_job(self):
        mock_logs = MagicMock()
        mock_logs.describe_log_streams.return_value = {
            "logStreams": [
                {
                    "logStreamName": "floor-ingest/abc123",
                    "firstEventTimestamp": 1705312200000,
                    "lastEventTimestamp": 1705312260000,
                },
            ],
        }

        with patch("handler._logs_client", return_value=mock_logs):
            response = client.get("/status/jobs/history", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            assert "history" in data
            assert data["period_days"] == 30
            assert "floor-ingest" in data["history"]

    def test_handles_empty_history(self):
        mock_logs = MagicMock()
        mock_logs.describe_log_streams.return_value = {"logStreams": []}

        with patch("handler._logs_client", return_value=mock_logs):
            response = client.get("/status/jobs/history", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            for job in data["history"].values():
                assert job["run_count"] == 0


# ---------------------------------------------------------------------------
# Job detail
# ---------------------------------------------------------------------------


class TestJobDetail:
    def test_returns_recent_logs(self):
        mock_logs = MagicMock()
        mock_logs.filter_log_events.return_value = {"events": []}

        with patch("handler._logs_client", return_value=mock_logs):
            response = client.get("/status/jobs/floor-ingest", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            assert data["job_name"] == "floor-ingest"
            assert "recent_logs" in data

    def test_with_log_events(self):
        mock_logs = MagicMock()
        mock_logs.filter_log_events.return_value = {
            "events": [
                {"timestamp": 1705312200000, "message": "Starting floor ingest"},
                {"timestamp": 1705312260000, "message": "Processed 100 records"},
            ]
        }

        with patch("handler._logs_client", return_value=mock_logs):
            response = client.get("/status/jobs/floor-ingest", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            assert len(data["recent_logs"]) == 2

    def test_handles_log_error(self):
        mock_logs = MagicMock()
        mock_logs.filter_log_events.side_effect = Exception("Log group not found")

        with patch("handler._logs_client", return_value=mock_logs):
            response = client.get("/status/jobs/floor-ingest", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            assert "error" in data["recent_logs"][0]


# ---------------------------------------------------------------------------
# Paginated logs
# ---------------------------------------------------------------------------


class TestJobLogs:
    def test_returns_paginated_logs(self):
        mock_logs = MagicMock()
        mock_logs.filter_log_events.return_value = {
            "events": [
                {
                    "timestamp": 1705312200000,
                    "message": "Test log",
                    "logStreamName": "floor-ingest/abc",
                },
            ],
            "nextForwardToken": "next-token-123",
        }

        with patch("handler._logs_client", return_value=mock_logs):
            response = client.get(
                "/status/jobs/floor-ingest/logs?limit=50",
                headers=AUTH_HEADERS,
            )
            assert response.status_code == 200
            data = response.json()
            assert len(data["events"]) == 1
            assert data["next_token"] == "next-token-123"
            assert data["job_name"] == "floor-ingest"

    def test_passes_search_filter(self):
        mock_logs = MagicMock()
        mock_logs.filter_log_events.return_value = {"events": []}

        with patch("handler._logs_client", return_value=mock_logs):
            response = client.get(
                "/status/jobs/floor-ingest/logs?search=ERROR",
                headers=AUTH_HEADERS,
            )
            assert response.status_code == 200
            # Verify filterPattern was passed
            call_kwargs = mock_logs.filter_log_events.call_args[1]
            assert call_kwargs["filterPattern"] == "ERROR"

    def test_passes_next_token(self):
        mock_logs = MagicMock()
        mock_logs.filter_log_events.return_value = {"events": []}

        with patch("handler._logs_client", return_value=mock_logs):
            response = client.get(
                "/status/jobs/floor-ingest/logs?next_token=abc123",
                headers=AUTH_HEADERS,
            )
            assert response.status_code == 200
            call_kwargs = mock_logs.filter_log_events.call_args[1]
            assert call_kwargs["nextToken"] == "abc123"


# ---------------------------------------------------------------------------
# API metrics
# ---------------------------------------------------------------------------


class TestApiMetrics:
    def test_returns_metrics_for_all_functions(self):
        mock_lam = MagicMock()
        mock_lam.get_function.return_value = {"Configuration": {"State": "Active"}}
        mock_lam.exceptions = type(
            "Exc", (), {"ResourceNotFoundException": Exception}
        )()

        mock_cw = MagicMock()
        mock_cw.get_metric_statistics.return_value = {"Datapoints": []}

        with (
            patch("handler._lambda_client", return_value=mock_lam),
            patch("handler._cw_client", return_value=mock_cw),
        ):
            response = client.get("/status/api", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            assert "api_metrics" in data
            assert "pulse-api" in data["api_metrics"]
            assert "search-api" in data["api_metrics"]
            assert "admin-api" in data["api_metrics"]

    def test_handles_missing_function(self):
        mock_lam = MagicMock()
        mock_lam.get_function.side_effect = Exception("not found")
        mock_lam.exceptions = type(
            "Exc", (), {"ResourceNotFoundException": Exception}
        )()

        with patch("handler._lambda_client", return_value=mock_lam):
            response = client.get("/status/api", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            for api in data["api_metrics"].values():
                assert api["status"] == "not_found"


# ---------------------------------------------------------------------------
# Database health
# ---------------------------------------------------------------------------


class TestDbHealth:
    def test_returns_ok_with_row_counts(self):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = [12345]
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with patch("handler._get_db_connection", return_value=mock_conn):
            response = client.get("/status/db", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert "tables" in data

    def test_connection_failure(self):
        with patch(
            "handler._get_db_connection", side_effect=Exception("Connection refused")
        ):
            response = client.get("/status/db", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "error"
            assert "Connection" in data["detail"]


# ---------------------------------------------------------------------------
# Alert configuration
# ---------------------------------------------------------------------------


class TestAlertConfig:
    def test_get_empty_config(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_ddb = MagicMock()
        mock_ddb.Table.return_value = mock_table

        with patch("handler._dynamodb_resource", return_value=mock_ddb):
            response = client.get("/status/alerts/config", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            assert data["enabled"] is False
            assert data["critical_jobs"] == []
            assert data["alert_emails"] == []

    def test_get_existing_config(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            "Item": {
                "configId": "default",
                "critical_jobs": ["floor-ingest"],
                "alert_emails": ["test@example.com"],
                "enabled": True,
                "updated_at": "2025-01-01T00:00:00",
            }
        }
        mock_ddb = MagicMock()
        mock_ddb.Table.return_value = mock_table

        with patch("handler._dynamodb_resource", return_value=mock_ddb):
            response = client.get("/status/alerts/config", headers=AUTH_HEADERS)
            assert response.status_code == 200
            data = response.json()
            assert data["enabled"] is True
            assert "floor-ingest" in data["critical_jobs"]

    def test_update_config(self):
        mock_table = MagicMock()
        mock_ddb = MagicMock()
        mock_ddb.Table.return_value = mock_table

        with (
            patch("handler._dynamodb_resource", return_value=mock_ddb),
            patch("handler.SNS_TOPIC_ARN", ""),
        ):
            response = client.post(
                "/status/alerts/config",
                headers=AUTH_HEADERS,
                json={
                    "critical_jobs": ["floor-ingest", "rhetoric-classify"],
                    "alert_emails": ["test@example.com"],
                    "enabled": True,
                },
            )
            assert response.status_code == 200
            mock_table.put_item.assert_called_once()


# ---------------------------------------------------------------------------
# Test alert
# ---------------------------------------------------------------------------


class TestTestAlert:
    def test_sends_test_alert(self):
        mock_sns = MagicMock()
        with (
            patch("handler._sns_client", return_value=mock_sns),
            patch("handler.SNS_TOPIC_ARN", "arn:aws:sns:us-east-1:123:test"),
        ):
            response = client.post("/status/alerts/test", headers=AUTH_HEADERS)
            assert response.status_code == 200
            mock_sns.publish.assert_called_once()

    def test_no_topic_returns_error(self):
        with patch("handler.SNS_TOPIC_ARN", ""):
            response = client.post("/status/alerts/test", headers=AUTH_HEADERS)
            assert response.status_code == 400
