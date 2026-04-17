"""Entry point for efficacy/legislative productivity updates (weekly Sunday)."""

from shared.runner import run_ingest_digest, job_collector

with job_collector("efficacy-update") as c:
    run_ingest_digest("elite/efficacy")
    c.set_headlines(
        [
            {"key": "bills_parsed", "label": "Bills Parsed", "format": "number"},
            {
                "key": "legislators_scored",
                "label": "Legislators Scored",
                "format": "number",
            },
        ]
    )
