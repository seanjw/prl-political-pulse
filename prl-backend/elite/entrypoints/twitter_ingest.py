"""Entry point for Twitter tweet ingestion (daily)."""

from shared.runner import run_scripts, job_collector

with job_collector("twitter-ingest") as c:
    run_scripts("elite/twitter/ingest-tweets", ["ingest-everyone-active.py"])
    c.set_headlines(
        [
            {
                "key": "new_federal_tweets",
                "label": "Federal Tweets",
                "format": "number",
            },
            {"key": "new_state_tweets", "label": "State Tweets", "format": "number"},
        ]
    )
