"""Entry point for regenerating all-data.zip download dataset (on-demand)."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config
from shared.runner import job_collector

load_config()


with job_collector("regenerate-data") as c:
    with c.step("export_survey_data"):
        from elite.surveys.regenerate_all_data import regenerate_all_data_zip

        stats = regenerate_all_data_zip()
        c.set("rows_exported", stats["rows_exported"])
        c.set("columns", stats["columns"])
        c.set("zip_size", stats["zip_size"])

    c.set_records_processed(c.metrics.get("rows_exported", 0))
    c.set_headlines(
        [
            {"key": "rows_exported", "label": "Rows", "format": "number"},
            {"key": "zip_size", "label": "Size", "format": "bytes"},
        ]
    )
