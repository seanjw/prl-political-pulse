"""Entry point for ideology/DW-NOMINATE score updates (weekly Sunday)."""

from shared.runner import run_ingest_digest, job_collector

with job_collector("ideology-update") as c:
    run_ingest_digest("elite/ideology")
    c.set_headlines(
        [
            {
                "key": "legislators_scored",
                "label": "Legislators Scored",
                "format": "number",
            },
            {"key": "api_calls", "label": "API Calls", "format": "number"},
        ]
    )
