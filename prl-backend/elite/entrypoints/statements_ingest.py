"""Entry point for statements/press release ingestion (daily)."""

import logging
import sys
import os

logging.basicConfig(level=logging.INFO, format="%(name)s %(levelname)s: %(message)s")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config  # noqa: E402
from shared.runner import job_collector  # noqa: E402

load_config()

from elite.statements.ingest_urls import run_url_ingestion  # noqa: E402
from elite.statements.scrape_text import run_text_scraping  # noqa: E402

with job_collector("statements-ingest") as c:
    with c.step("ingest_urls"):
        url_metrics = run_url_ingestion()
    c.set("officials_processed", url_metrics["officials_processed"])
    c.set("officials_succeeded", url_metrics["officials_succeeded"])
    c.set("officials_failed", url_metrics["officials_failed"])
    c.set("urls_discovered", url_metrics["urls_discovered"])
    c.set("urls_new", url_metrics["urls_new"])

    with c.step("scrape_text"):
        scrape_metrics = run_text_scraping()
    c.set("urls_scraped", scrape_metrics["urls_succeeded"])
    c.set("urls_scrape_failed", scrape_metrics["urls_failed"])
    c.set("urls_skipped_max_retries", scrape_metrics["urls_skipped_max_retries"])

    total_processed = url_metrics["urls_new"] + scrape_metrics["urls_succeeded"]
    c.set_records_processed(total_processed)

    c.set_headlines(
        [
            {"key": "urls_new", "label": "New URLs", "format": "number"},
            {"key": "urls_scraped", "label": "Texts Scraped", "format": "number"},
        ]
    )
