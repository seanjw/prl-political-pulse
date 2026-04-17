"""Entry point for Twitter media annotation via OpenAI (daily, after media ingest)."""

from shared.runner import run_scripts, job_collector

with job_collector("twitter-media-annotate") as c:
    run_scripts("elite/twitter/process-media", ["annotate.py"])
    c.set_headlines(
        [
            {
                "key": "images_annotated",
                "label": "Images Annotated",
                "format": "number",
            },
            {"key": "api_calls", "label": "API Calls", "format": "number"},
        ]
    )
