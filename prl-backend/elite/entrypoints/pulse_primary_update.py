"""Entry point for Pulse primary/challenger dashboard data update (daily).

Runs the build scripts that populate:
- pulse.data (primary/candidates and primary/races)
- pulse.primary_statements (per-candidate classified statements)
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config
from shared.runner import job_collector

load_config()

from pulse.build import build_primary  # noqa: E402

with job_collector("pulse-primary-update") as c:
    with c.step("build_candidates_and_races"):
        print("=== Building Primary Candidates & Races ===")
        build_primary.build_candidates_and_races()

    with c.step("build_statements"):
        print("=== Building Primary Statements ===")
        build_primary.build_statements()

    c.set_headlines(
        [
            {
                "key": "candidates",
                "label": "Primary Candidates",
                "format": "number",
            },
            {
                "key": "statements",
                "label": "Primary Statements",
                "format": "number",
            },
        ]
    )
