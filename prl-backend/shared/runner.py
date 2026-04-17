"""Shared entrypoint runner for ECS Fargate batch jobs."""

import json
import sys
import os
import subprocess
import time
import traceback
from contextlib import contextmanager
from datetime import datetime, timezone

# Ensure project root is on sys.path
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from shared.config import load_config  # noqa: E402


def print_job_summary(records_processed=0, description="", **extra):
    """Print a standardized summary line for monitoring to parse.

    Outputs a JOB_SUMMARY: JSON line that the monitoring Lambda can extract
    from CloudWatch logs to display on the Operations Dashboard.
    """
    summary = {"records_processed": records_processed, "description": description}
    summary.update(extra)
    print(f"JOB_SUMMARY: {json.dumps(summary)}")


# ---------------------------------------------------------------------------
# JobResultCollector — structured job metrics for operations.job_results
# ---------------------------------------------------------------------------


class JobResultCollector:
    """Collects metrics, steps, and errors during a batch job run.

    Writes a structured result row to ``operations.job_results`` on save().
    Also emits the legacy JOB_SUMMARY line for backward compatibility.
    """

    def __init__(self, job_name: str):
        self.job_name = job_name
        self.started_at = datetime.now(timezone.utc)
        self.completed_at = None
        self.metrics: dict = {}
        self.records_processed = 0
        self.headlines: list[dict] = []
        self.errors: list[dict] = []
        self.steps: list[dict] = []
        self._current_step = None

    # -- Metric accumulation --

    def set(self, key: str, value):
        """Set a metric to a specific value."""
        self.metrics[key] = value

    def increment(self, key: str, amount=1):
        """Increment a numeric metric (creates it at 0 if missing)."""
        self.metrics[key] = self.metrics.get(key, 0) + amount

    def set_records_processed(self, count: int):
        """Set the standard records_processed counter."""
        self.records_processed = count

    def set_headlines(self, headlines: list[dict]):
        """Define 1-2 headline metrics for dashboard display.

        Each entry: ``{"key": "metric_key", "label": "Display Label", "format": "number"}``
        Format options: ``number``, ``bytes``, ``currency``, ``duration``, ``percent``
        """
        self.headlines = headlines

    # -- Step tracking --

    @contextmanager
    def step(self, name: str):
        """Context manager that tracks a sub-step with timing and error capture."""
        step_info = {
            "name": name,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
            "duration_seconds": None,
            "status": "running",
            "metrics": {},
            "error": None,
        }
        self.steps.append(step_info)
        self._current_step = step_info
        step_start = time.monotonic()
        try:
            yield self
            step_info["status"] = "success"
        except Exception as exc:
            step_info["status"] = "failure"
            step_info["error"] = str(exc)
            self.capture_exception(exc, step=name)
            raise
        finally:
            elapsed = time.monotonic() - step_start
            step_info["duration_seconds"] = round(elapsed, 2)
            step_info["completed_at"] = datetime.now(timezone.utc).isoformat()
            self._current_step = None

    # -- Error recording --

    def add_error(self, message: str, traceback_str: str = None, step: str = None):
        """Record an error with optional traceback and step name."""
        self.errors.append(
            {
                "message": message,
                "traceback": traceback_str,
                "step": step
                or (self._current_step["name"] if self._current_step else None),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

    def capture_exception(self, exc: Exception, step: str = None):
        """Capture an exception with its full traceback."""
        tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
        self.add_error(str(exc), "".join(tb), step=step)

    # -- Persistence --

    def save(self, status: str = "success", exit_code: int = 0):
        """Finalize and write the result to RDS + emit legacy JOB_SUMMARY."""
        self.completed_at = datetime.now(timezone.utc)
        duration = (self.completed_at - self.started_at).total_seconds()

        # Build headline metrics JSON
        headline_json = None
        if self.headlines:
            headline_json = []
            for h in self.headlines:
                headline_json.append(
                    {
                        "key": h["key"],
                        "label": h["label"],
                        "format": h.get("format", "number"),
                        "value": self.metrics.get(h["key"]),
                    }
                )

        # Write to RDS
        try:
            self._write_to_rds(
                status=status,
                exit_code=exit_code,
                duration=duration,
                headline_json=headline_json,
            )
        except Exception as e:
            print(f"WARNING: Failed to write job result to RDS: {e}")

        # Backward-compatible JOB_SUMMARY
        description = self._build_description()
        print_job_summary(
            records_processed=self.records_processed,
            description=description,
            **{
                k: v
                for k, v in self.metrics.items()
                if isinstance(v, (int, float, str, bool))
            },
        )

    def _build_description(self) -> str:
        """Build a human-readable description from headline metrics."""
        if not self.headlines:
            return f"{self.job_name} completed"
        parts = []
        for h in self.headlines:
            val = self.metrics.get(h["key"])
            if val is not None:
                parts.append(
                    f"{val:,} {h['label'].lower()}"
                    if isinstance(val, (int, float))
                    else f"{val} {h['label'].lower()}"
                )
        return ", ".join(parts) if parts else f"{self.job_name} completed"

    def _write_to_rds(self, status, exit_code, duration, headline_json):
        """Insert a row into operations.job_results via pymysql."""
        import pymysql

        db_secrets = _get_db_secrets()
        conn = pymysql.connect(
            host=db_secrets["DB_HOST"],
            port=int(db_secrets["DB_PORT"]),
            user=db_secrets["DB_USER"],
            password=db_secrets["DB_PASSWORD"],
            database="operations",
            connect_timeout=10,
        )
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """INSERT INTO job_results
                       (job_name, started_at, completed_at, duration_seconds,
                        status, exit_code, records_processed, error_count,
                        errors_json, metrics_json, headline_metrics_json, steps_json)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        self.job_name,
                        self.started_at.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                        self.completed_at.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                        round(duration, 2),
                        status,
                        exit_code,
                        self.records_processed,
                        len(self.errors),
                        json.dumps(self.errors) if self.errors else None,
                        json.dumps(self.metrics),
                        json.dumps(headline_json) if headline_json else None,
                        json.dumps(self.steps) if self.steps else None,
                    ),
                )
            conn.commit()
        finally:
            conn.close()


def _get_db_secrets() -> dict:
    """Get database secrets, preferring env vars (already loaded by load_config)."""
    required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD"]
    if all(k in os.environ for k in required):
        return {k: os.environ[k] for k in required}
    # Fallback to Secrets Manager
    from shared.config import get_secrets

    return get_secrets("prl/database")


@contextmanager
def job_collector(job_name: str):
    """Context manager that creates a JobResultCollector, yields it, and auto-saves.

    Usage::

        with job_collector("floor-ingest") as c:
            c.set("new_speeches", 42)
            c.set_records_processed(42)
            c.set_headlines([
                {"key": "new_speeches", "label": "New Speeches", "format": "number"},
            ])
    """
    collector = JobResultCollector(job_name)
    try:
        yield collector
        collector.save(status="success", exit_code=0)
    except Exception as exc:
        collector.capture_exception(exc)
        try:
            collector.save(
                status="failure"
                if not collector.errors or len(collector.errors) <= 1
                else "partial",
                exit_code=1,
            )
        except Exception:
            pass
        raise


def run_scripts(module_path, scripts, env=None, unbuffered=False):
    """Run one or more Python scripts in a module directory.

    Args:
        module_path: Path relative to project root (e.g. "elite/twitter/ingest-tweets")
        scripts: List of script filenames (or [filename, arg1, ...] lists) to run sequentially
        env: Optional extra env vars to set
        unbuffered: If True, run with -u flag for unbuffered stdout/stderr
    """
    load_config()
    if env:
        os.environ.update(env)

    cwd = os.path.join(_project_root, module_path)
    for entry in scripts:
        # Support both plain strings and [script, arg1, arg2, ...] lists
        if isinstance(entry, str):
            script_name = entry
            extra_args = []
        else:
            script_name = entry[0]
            extra_args = list(entry[1:])

        cmd = [sys.executable]
        if unbuffered:
            cmd.append("-u")
        cmd.append(script_name)
        cmd.extend(extra_args)

        print(f"=== Running {script_name} ===")
        subprocess.run(cmd, cwd=cwd, check=True)


def run_ingest_digest(module_path, scripts=None):
    """Run ingest+digest pattern with .tmp directory management.

    Args:
        module_path: Path relative to project root (e.g. "elite/efficacy")
        scripts: List of scripts to run (default: ["ingest.py", "digest.py"])
    """
    import shutil

    load_config()

    cwd = os.path.join(_project_root, module_path)
    tmp_dir = os.path.join(cwd, ".tmp")
    os.makedirs(tmp_dir, exist_ok=True)

    try:
        for script in scripts or ["ingest.py", "digest.py"]:
            print(f"=== Running {script} ===")
            subprocess.run([sys.executable, script], cwd=cwd, check=True)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
