"""Tests for the alert Lambda handler."""

import sys
import os
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "monitoring"))
os.environ["ALERT_TABLE_NAME"] = "prl-alert-config"
os.environ["SNS_TOPIC_ARN"] = "arn:aws:sns:us-east-1:123456:prl-batch-alerts"

from alert_handler import lambda_handler, _extract_job_name


class TestExtractJobName:
    def test_extracts_from_task_definition_arn(self):
        arn = "arn:aws:ecs:us-east-1:123:task-definition/prl-floor-ingest:3"
        assert _extract_job_name(arn) == "floor-ingest"

    def test_strips_prl_prefix(self):
        arn = "arn:aws:ecs:us-east-1:123:task-definition/prl-rhetoric-classify:1"
        assert _extract_job_name(arn) == "rhetoric-classify"

    def test_no_prl_prefix(self):
        arn = "arn:aws:ecs:us-east-1:123:task-definition/custom-job:1"
        assert _extract_job_name(arn) == "custom-job"


def _make_ecs_event(last_status="STOPPED", exit_code=1, task_def="prl-floor-ingest:3"):
    return {
        "source": "aws.ecs",
        "detail-type": "ECS Task State Change",
        "detail": {
            "lastStatus": last_status,
            "taskDefinitionArn": f"arn:aws:ecs:us-east-1:123:task-definition/{task_def}",
            "taskArn": "arn:aws:ecs:us-east-1:123:task/prl/abc123",
            "clusterArn": "arn:aws:ecs:us-east-1:123:cluster/prl",
            "stoppedReason": "Essential container exited",
            "stoppedAt": "2025-01-15T10:30:00Z",
            "containers": [{"exitCode": exit_code}],
        },
    }


class TestAlertHandler:
    def test_skips_non_stopped_event(self):
        event = _make_ecs_event(last_status="RUNNING")
        result = lambda_handler(event, None)
        assert result["action"] == "skipped"
        assert "not a STOPPED event" in result["reason"]

    def test_skips_successful_task(self):
        event = _make_ecs_event(exit_code=0)
        result = lambda_handler(event, None)
        assert result["action"] == "skipped"
        assert "exit code 0" in result["reason"]

    def test_skips_when_no_config(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_ddb = MagicMock()
        mock_ddb.Table.return_value = mock_table

        with patch("alert_handler._dynamodb_resource", return_value=mock_ddb):
            event = _make_ecs_event()
            result = lambda_handler(event, None)
            assert result["action"] == "skipped"
            assert "no alert config" in result["reason"]

    def test_skips_when_alerts_disabled(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            "Item": {
                "configId": "default",
                "enabled": False,
                "critical_jobs": ["floor-ingest"],
                "alert_emails": ["test@example.com"],
            }
        }
        mock_ddb = MagicMock()
        mock_ddb.Table.return_value = mock_table

        with patch("alert_handler._dynamodb_resource", return_value=mock_ddb):
            event = _make_ecs_event()
            result = lambda_handler(event, None)
            assert result["action"] == "skipped"
            assert "alerts disabled" in result["reason"]

    def test_skips_non_critical_job(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            "Item": {
                "configId": "default",
                "enabled": True,
                "critical_jobs": ["rhetoric-classify"],
                "alert_emails": ["test@example.com"],
            }
        }
        mock_ddb = MagicMock()
        mock_ddb.Table.return_value = mock_table

        with patch("alert_handler._dynamodb_resource", return_value=mock_ddb):
            event = _make_ecs_event(task_def="prl-floor-ingest:3")
            result = lambda_handler(event, None)
            assert result["action"] == "skipped"
            assert "not in critical jobs" in result["reason"]

    def test_sends_alert_for_critical_job_failure(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            "Item": {
                "configId": "default",
                "enabled": True,
                "critical_jobs": ["floor-ingest", "rhetoric-classify"],
                "alert_emails": ["test@example.com"],
            }
        }
        mock_ddb = MagicMock()
        mock_ddb.Table.return_value = mock_table

        mock_sns = MagicMock()

        with (
            patch("alert_handler._dynamodb_resource", return_value=mock_ddb),
            patch("alert_handler._sns_client", return_value=mock_sns),
        ):
            event = _make_ecs_event(task_def="prl-floor-ingest:3", exit_code=1)
            result = lambda_handler(event, None)
            assert result["action"] == "alert_sent"
            assert result["job_name"] == "floor-ingest"
            mock_sns.publish.assert_called_once()
            call_kwargs = mock_sns.publish.call_args[1]
            assert "floor-ingest" in call_kwargs["Subject"]
            assert "floor-ingest" in call_kwargs["Message"]

    def test_skips_when_no_sns_topic(self):
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            "Item": {
                "configId": "default",
                "enabled": True,
                "critical_jobs": ["floor-ingest"],
                "alert_emails": ["test@example.com"],
            }
        }
        mock_ddb = MagicMock()
        mock_ddb.Table.return_value = mock_table

        with (
            patch("alert_handler._dynamodb_resource", return_value=mock_ddb),
            patch("alert_handler.SNS_TOPIC_ARN", ""),
        ):
            event = _make_ecs_event()
            result = lambda_handler(event, None)
            assert result["action"] == "skipped"
            assert "SNS topic not configured" in result["reason"]
