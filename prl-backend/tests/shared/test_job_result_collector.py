"""Tests for JobResultCollector and job_collector context manager."""

import json
import sys
import os
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


class TestJobResultCollector:
    def test_init_sets_defaults(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("floor-ingest")
        assert c.job_name == "floor-ingest"
        assert c.metrics == {}
        assert c.records_processed == 0
        assert c.headlines == []
        assert c.errors == []
        assert c.steps == []
        assert c.started_at is not None
        assert c.completed_at is None

    def test_set_stores_metric(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        c.set("new_speeches", 42)
        assert c.metrics["new_speeches"] == 42

    def test_set_overwrites_existing(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        c.set("count", 10)
        c.set("count", 20)
        assert c.metrics["count"] == 20

    def test_increment_creates_key(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        c.increment("api_calls")
        assert c.metrics["api_calls"] == 1

    def test_increment_adds_to_existing(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        c.increment("api_calls", 5)
        c.increment("api_calls", 3)
        assert c.metrics["api_calls"] == 8

    def test_set_records_processed(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        c.set_records_processed(100)
        assert c.records_processed == 100

    def test_set_headlines(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        headlines = [
            {"key": "new_speeches", "label": "New Speeches", "format": "number"},
            {"key": "api_calls", "label": "API Calls", "format": "number"},
        ]
        c.set_headlines(headlines)
        assert len(c.headlines) == 2
        assert c.headlines[0]["key"] == "new_speeches"

    def test_add_error(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        c.add_error("Something went wrong", "traceback here", step="ingest")
        assert len(c.errors) == 1
        assert c.errors[0]["message"] == "Something went wrong"
        assert c.errors[0]["traceback"] == "traceback here"
        assert c.errors[0]["step"] == "ingest"
        assert c.errors[0]["timestamp"] is not None

    def test_add_error_uses_current_step(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        # Simulate being inside a step
        c._current_step = {"name": "classify"}
        c.add_error("error in classify")
        assert c.errors[0]["step"] == "classify"

    def test_capture_exception(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        try:
            raise ValueError("test error")
        except ValueError as e:
            c.capture_exception(e, step="ingest")
        assert len(c.errors) == 1
        assert "test error" in c.errors[0]["message"]
        assert "ValueError" in c.errors[0]["traceback"]
        assert c.errors[0]["step"] == "ingest"

    def test_step_context_manager_success(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        with c.step("ingest") as _:
            pass  # simulate work

        assert len(c.steps) == 1
        assert c.steps[0]["name"] == "ingest"
        assert c.steps[0]["status"] == "success"
        assert c.steps[0]["duration_seconds"] is not None
        assert c.steps[0]["completed_at"] is not None
        assert c.steps[0]["error"] is None

    def test_step_context_manager_failure(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        with pytest.raises(RuntimeError, match="step failed"):
            with c.step("ingest"):
                raise RuntimeError("step failed")

        assert len(c.steps) == 1
        assert c.steps[0]["status"] == "failure"
        assert c.steps[0]["error"] == "step failed"
        assert len(c.errors) == 1

    def test_step_clears_current_step(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        with c.step("ingest"):
            assert c._current_step is not None
        assert c._current_step is None

    def test_multiple_steps(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        with c.step("step1"):
            pass
        with c.step("step2"):
            pass
        assert len(c.steps) == 2
        assert c.steps[0]["name"] == "step1"
        assert c.steps[1]["name"] == "step2"

    @patch("shared.runner._get_db_secrets")
    def test_save_writes_to_rds(self, mock_secrets):
        from shared.runner import JobResultCollector

        mock_secrets.return_value = {
            "DB_HOST": "localhost",
            "DB_PORT": "3306",
            "DB_USER": "test",
            "DB_PASSWORD": "test",
        }

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with patch("pymysql.connect", return_value=mock_conn):
            c = JobResultCollector("test-job")
            c.set("new_speeches", 42)
            c.set_records_processed(42)
            c.set_headlines(
                [{"key": "new_speeches", "label": "New Speeches", "format": "number"}]
            )
            c.save(status="success", exit_code=0)

        mock_cursor.execute.assert_called_once()
        sql = mock_cursor.execute.call_args[0][0]
        assert "INSERT INTO job_results" in sql
        params = mock_cursor.execute.call_args[0][1]
        assert params[0] == "test-job"  # job_name
        assert params[4] == "success"  # status
        assert params[5] == 0  # exit_code
        assert params[6] == 42  # records_processed
        mock_conn.commit.assert_called_once()
        mock_conn.close.assert_called_once()

    @patch("shared.runner._get_db_secrets")
    def test_save_handles_rds_failure(self, mock_secrets, capsys):
        from shared.runner import JobResultCollector

        mock_secrets.return_value = {
            "DB_HOST": "localhost",
            "DB_PORT": "3306",
            "DB_USER": "test",
            "DB_PASSWORD": "test",
        }

        with patch("pymysql.connect", side_effect=Exception("connection refused")):
            c = JobResultCollector("test-job")
            c.save(status="success", exit_code=0)

        captured = capsys.readouterr()
        assert "WARNING" in captured.out
        # Should still print JOB_SUMMARY
        assert "JOB_SUMMARY" in captured.out

    def test_save_emits_job_summary(self, capsys):
        from shared.runner import JobResultCollector

        with patch.object(
            JobResultCollector, "_write_to_rds", side_effect=Exception("skip")
        ):
            c = JobResultCollector("test-job")
            c.set("new_speeches", 10)
            c.set_records_processed(10)
            c.set_headlines(
                [{"key": "new_speeches", "label": "New Speeches", "format": "number"}]
            )
            c.save(status="success", exit_code=0)

        captured = capsys.readouterr()
        assert "JOB_SUMMARY" in captured.out
        summary_line = [
            line for line in captured.out.strip().split("\n") if "JOB_SUMMARY" in line
        ][0]
        payload = json.loads(summary_line.split("JOB_SUMMARY: ")[1])
        assert payload["records_processed"] == 10
        assert payload["new_speeches"] == 10

    def test_build_description_from_headlines(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("test-job")
        c.set("new_speeches", 42)
        c.set("api_calls", 5)
        c.set_headlines(
            [
                {"key": "new_speeches", "label": "New Speeches", "format": "number"},
                {"key": "api_calls", "label": "API Calls", "format": "number"},
            ]
        )
        desc = c._build_description()
        assert "42 new speeches" in desc
        assert "5 api calls" in desc

    def test_build_description_no_headlines(self):
        from shared.runner import JobResultCollector

        c = JobResultCollector("floor-ingest")
        desc = c._build_description()
        assert desc == "floor-ingest completed"

    def test_headline_json_includes_values(self):
        from shared.runner import JobResultCollector

        with patch.object(JobResultCollector, "_write_to_rds") as mock_write:
            c = JobResultCollector("test-job")
            c.set("files_uploaded", 3)
            c.set("data_size", 1024000)
            c.set_headlines(
                [
                    {"key": "files_uploaded", "label": "Files", "format": "number"},
                    {"key": "data_size", "label": "Size", "format": "bytes"},
                ]
            )
            c.save(status="success", exit_code=0)

        headline_json = mock_write.call_args[1]["headline_json"]
        assert len(headline_json) == 2
        assert headline_json[0]["value"] == 3
        assert headline_json[1]["value"] == 1024000


class TestJobCollector:
    @patch("shared.runner._get_db_secrets")
    def test_success_path(self, mock_secrets, capsys):
        from shared.runner import job_collector, JobResultCollector

        with patch.object(JobResultCollector, "_write_to_rds") as mock_write:
            with job_collector("test-job") as c:
                c.set("count", 10)
                c.set_records_processed(10)

        mock_write.assert_called_once()
        call_kwargs = mock_write.call_args[1]
        assert call_kwargs["status"] == "success"
        assert call_kwargs["exit_code"] == 0

    @patch("shared.runner._get_db_secrets")
    def test_failure_path(self, mock_secrets):
        from shared.runner import job_collector, JobResultCollector

        with patch.object(JobResultCollector, "_write_to_rds") as mock_write:
            with pytest.raises(ValueError, match="test error"):
                with job_collector("test-job") as _c:
                    raise ValueError("test error")

        mock_write.assert_called_once()
        call_kwargs = mock_write.call_args[1]
        assert call_kwargs["status"] == "failure"
        assert call_kwargs["exit_code"] == 1

    @patch("shared.runner._get_db_secrets")
    def test_save_exception_does_not_mask_original(self, mock_secrets):
        from shared.runner import job_collector, JobResultCollector

        with patch.object(
            JobResultCollector, "_write_to_rds", side_effect=Exception("db down")
        ):
            with pytest.raises(ValueError, match="original error"):
                with job_collector("test-job") as _c:
                    raise ValueError("original error")


class TestGetDbSecrets:
    def test_uses_env_vars_when_available(self):
        from shared.runner import _get_db_secrets

        result = _get_db_secrets()
        assert result["DB_HOST"] == "localhost"
        assert result["DB_PORT"] == "3306"
        assert result["DB_USER"] == "test_user"
        assert result["DB_PASSWORD"] == "test_pass"

    def test_falls_back_to_secrets_manager(self, monkeypatch):
        from shared.runner import _get_db_secrets

        monkeypatch.delenv("DB_HOST", raising=False)

        mock_secrets = {
            "DB_HOST": "rds.example.com",
            "DB_PORT": "3306",
            "DB_USER": "prod_user",
            "DB_PASSWORD": "prod_pass",
        }
        with patch("shared.config.get_secrets", return_value=mock_secrets):
            result = _get_db_secrets()

        assert result["DB_HOST"] == "rds.example.com"
