"""Entry point for Twitter media image download (daily, after tweet ingest)."""

from shared.runner import run_scripts, job_collector

with job_collector("twitter-media-ingest") as c:
    run_scripts(
        "elite/twitter/process-media", ["pull-images-from-url.py"], unbuffered=True
    )
    c.set_headlines(
        [
            {
                "key": "images_downloaded",
                "label": "Images Downloaded",
                "format": "number",
            },
            {"key": "failures", "label": "Failures", "format": "number"},
        ]
    )
