"""Entry point for Twitter handle -> ID conversion (weekly Sunday)."""

from shared.runner import run_scripts, job_collector

with job_collector("twitter-ids-update") as c:
    run_scripts("elite/officials", ["get twitter ids from handles.py"])
    c.set_headlines(
        [
            {
                "key": "handles_resolved",
                "label": "Handles Resolved",
                "format": "number",
            },
            {"key": "api_errors", "label": "API Errors", "format": "number"},
        ]
    )
