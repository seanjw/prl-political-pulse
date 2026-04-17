"""Entry point for campaign finance/FEC data updates (quarterly)."""

import sys
import os
import subprocess

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config
from shared.runner import job_collector

load_config()

money_dir = os.path.join(os.path.dirname(__file__), "..", "money")

with job_collector("money-update") as c:
    with c.step("ingest"):
        subprocess.run(
            [sys.executable, "ingest.py"],
            cwd=money_dir,
            check=True,
        )

    with c.step("digest"):
        subprocess.run(
            [sys.executable, "digest.py"],
            cwd=money_dir,
            check=True,
        )

    c.set_headlines(
        [
            {
                "key": "contribution_records",
                "label": "Contribution Records",
                "format": "number",
            },
            {"key": "total_dollars", "label": "Total Dollars", "format": "currency"},
        ]
    )
