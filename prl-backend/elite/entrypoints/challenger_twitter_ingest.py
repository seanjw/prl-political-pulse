"""Entry point for challenger Twitter tweet ingestion (daily)."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.config import load_config, get_db_url
from shared.runner import job_collector

load_config()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "challengers"))
import twitter_ingest as challenger_ingest  # noqa: E402

with job_collector("challenger-twitter-ingest") as c:
    db_url = get_db_url("elite", dialect="mysql+pymysql")
    result = challenger_ingest.run(db_url)
    c.set("new_tweets", result["new_tweets"])
    c.set("candidates_processed", result["candidates_processed"])
    c.set("api_errors", result["api_errors"])
    c.set_records_processed(result["new_tweets"])
    c.set_headlines(
        [
            {
                "key": "new_tweets",
                "label": "New Tweets",
                "format": "number",
            },
            {
                "key": "candidates_processed",
                "label": "Candidates",
                "format": "number",
            },
        ]
    )
