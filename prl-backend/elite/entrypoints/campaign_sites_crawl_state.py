"""Entry point for campaign site crawl — state officials (quarterly)."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.config import load_config  # noqa: E402
from shared.runner import job_collector  # noqa: E402

load_config()

from elite.campaign_sites.crawl import run_crawl  # noqa: E402

with job_collector("campaign-sites-crawl-state") as c:
    with c.step("crawl_sites"):
        result = run_crawl(scope="state")
    c.set("sites_crawled", result["sites_crawled"])
    c.set("sites_failed", result["sites_failed"])
    c.set("total_pages", result["total_pages"])
    c.set("total_changed", result["total_changed"])
    c.set("problem_sites", result.get("problem_sites", 0))
    if result.get("problem_sites_data"):
        c.set("problem_sites_data", result["problem_sites_data"])
    c.set_records_processed(result["sites_crawled"])
    c.set_headlines(
        [
            {
                "key": "sites_crawled",
                "label": "Sites Crawled",
                "format": "number",
            },
            {
                "key": "problem_sites",
                "label": "Problem Sites",
                "format": "number",
            },
        ]
    )
