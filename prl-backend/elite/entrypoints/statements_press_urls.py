"""Entry point for press release URL discovery — active federal officials."""

import logging
import sys
import os

logging.basicConfig(level=logging.INFO, format="%(name)s %(levelname)s: %(message)s")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.config import load_config  # noqa: E402
from shared.runner import job_collector  # noqa: E402

load_config()

from elite.statements.discover_press_urls import run  # noqa: E402

with job_collector("statements-press-urls") as c:
    with c.step("discover_urls"):
        result = run()
    c.set("found", result["found"])
    c.set("not_found", result["not_found"])
    c.set("needs_review", result["needs_review"])
    c.set("errors", result["errors"])
    c.set_records_processed(result["found"])
    c.set_headlines(
        [
            {"key": "found", "label": "Found", "format": "number"},
            {"key": "needs_review", "label": "Needs Review", "format": "number"},
        ]
    )
