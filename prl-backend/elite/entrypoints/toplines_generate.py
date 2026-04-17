"""Entry point for survey toplines PDF generation (on-demand)."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config
from shared.runner import job_collector

load_config()

with job_collector("toplines-generate") as c:
    with c.step("us_toplines"):
        from elite.surveys.toplines.generate_us import generate_us_toplines

        stats = generate_us_toplines(update=True)
        c.set("us_pdfs_generated", stats["generated"])
        c.set("us_pdfs_skipped", stats["skipped"])

    with c.step("international_toplines"):
        from elite.surveys.toplines.generate_international import (
            generate_international_toplines,
        )

        stats = generate_international_toplines(update=True)
        c.set("intl_pdfs_generated", stats["generated"])

    # Regenerate toplines index so the frontend picks up new waves
    with c.step("toplines_index"):
        from elite.surveys.toplines.generate_index import generate_toplines_index

        idx_stats = generate_toplines_index()
        c.set("index_us_waves", idx_stats["us_waves"])

    total = c.metrics.get("us_pdfs_generated", 0) + c.metrics.get(
        "intl_pdfs_generated", 0
    )
    c.set_records_processed(total)
    c.set_headlines(
        [
            {"key": "us_pdfs_generated", "label": "US PDFs", "format": "number"},
            {"key": "intl_pdfs_generated", "label": "Intl PDFs", "format": "number"},
            {"key": "index_us_waves", "label": "Indexed Waves", "format": "number"},
        ]
    )
