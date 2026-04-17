"""Entry point for challenger FEC financial summary updates (weekly)."""

import sys
import os
import subprocess

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config
from shared.runner import job_collector

load_config()

money_dir = os.path.join(os.path.dirname(__file__), "..", "challenger-money")

with job_collector("challenger-money-update") as c:
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
                "key": "candidates_with_data",
                "label": "Candidates with Data",
                "format": "number",
            },
            {
                "key": "total_raised",
                "label": "Total Raised",
                "format": "currency",
            },
        ]
    )
