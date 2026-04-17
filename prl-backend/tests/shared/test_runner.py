"""Tests for shared.runner module."""

import sys
import os
import pytest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


class TestRunScripts:
    @patch("shared.runner.load_config")
    @patch("subprocess.run")
    def test_calls_subprocess(self, mock_run, mock_config):
        from shared.runner import run_scripts

        run_scripts("elite/floor", ["ingest.py"])

        mock_run.assert_called_once()
        call_args = mock_run.call_args
        assert "ingest.py" in call_args[0][0]
        assert call_args[1]["check"] is True

    @patch("shared.runner.load_config")
    @patch("subprocess.run")
    def test_sets_env_vars(self, mock_run, mock_config):
        from shared.runner import run_scripts

        run_scripts("elite/floor", ["ingest.py"], env={"CUSTOM_VAR": "value"})

        assert os.environ.get("CUSTOM_VAR") == "value"

    @patch("shared.runner.load_config")
    @patch("subprocess.run")
    def test_unbuffered_flag(self, mock_run, mock_config):
        from shared.runner import run_scripts

        run_scripts("elite/floor", ["ingest.py"], unbuffered=True)

        cmd = mock_run.call_args[0][0]
        assert "-u" in cmd

    @patch("shared.runner.load_config")
    @patch("subprocess.run")
    def test_list_entry_with_args(self, mock_run, mock_config):
        from shared.runner import run_scripts

        run_scripts("elite/floor", [["script.py", "arg1", "arg2"]])

        cmd = mock_run.call_args[0][0]
        assert "script.py" in cmd
        assert "arg1" in cmd
        assert "arg2" in cmd

    @patch("shared.runner.load_config")
    @patch("subprocess.run", side_effect=Exception("script failed"))
    def test_raises_on_failure(self, mock_run, mock_config):
        from shared.runner import run_scripts

        with pytest.raises(Exception, match="script failed"):
            run_scripts("elite/floor", ["bad_script.py"])


class TestRunIngestDigest:
    @patch("shared.runner.load_config")
    @patch("subprocess.run")
    @patch("shutil.rmtree")
    @patch("os.makedirs")
    def test_creates_tmp_dir(self, mock_makedirs, mock_rmtree, mock_run, mock_config):
        from shared.runner import run_ingest_digest

        run_ingest_digest("elite/efficacy")

        # Verify .tmp dir was created
        tmp_call = mock_makedirs.call_args
        assert ".tmp" in tmp_call[0][0] or "tmp" in str(tmp_call)

    @patch("shared.runner.load_config")
    @patch("subprocess.run")
    @patch("shutil.rmtree")
    @patch("os.makedirs")
    def test_cleans_tmp_on_success(
        self, mock_makedirs, mock_rmtree, mock_run, mock_config
    ):
        from shared.runner import run_ingest_digest

        run_ingest_digest("elite/efficacy")

        # Verify .tmp dir was cleaned up
        mock_rmtree.assert_called_once()

    @patch("shared.runner.load_config")
    @patch("subprocess.run", side_effect=Exception("script failed"))
    @patch("shutil.rmtree")
    @patch("os.makedirs")
    def test_cleans_tmp_on_failure(
        self, mock_makedirs, mock_rmtree, mock_run, mock_config
    ):
        from shared.runner import run_ingest_digest

        with pytest.raises(Exception):
            run_ingest_digest("elite/efficacy")

        # Verify .tmp dir was still cleaned up
        mock_rmtree.assert_called_once()
