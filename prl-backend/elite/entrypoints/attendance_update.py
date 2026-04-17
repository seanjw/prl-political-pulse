"""Entry point for attendance/voting participation updates (weekly Sunday)."""

from shared.runner import run_ingest_digest, job_collector

with job_collector("attendance-update") as c:
    run_ingest_digest("elite/attendance")
    c.set_headlines(
        [
            {
                "key": "legislators_scored",
                "label": "Legislators Scored",
                "format": "number",
            },
            {"key": "total_votes", "label": "Total Votes", "format": "number"},
        ]
    )
