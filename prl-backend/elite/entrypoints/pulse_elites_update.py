"""Entry point for Pulse elites dashboard data update (daily).

Runs the build scripts that populate pulse DB tables:
- pulse.data (elites/landing page stats)
- pulse.legislators (legislator cards)
- pulse.federal_profiles (full federal profiles)
- pulse.state_profiles (full state profiles)
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config
from shared.runner import job_collector

load_config()

from pulse.build import (  # noqa: E402
    build_landing,
    build_legislators,
    build_rankings,
    build_federal_profiles,
    build_state_profiles,
)

with job_collector("pulse-elites-update") as c:
    with c.step("build_landing"):
        print("=== Building Elites Landing ===")
        build_landing.build()

    with c.step("build_legislators"):
        print("=== Building Legislators Table ===")
        build_legislators.build()

    with c.step("build_rankings"):
        print("=== Building Rankings JSON ===")
        build_rankings.build()

    with c.step("build_federal_profiles"):
        print("=== Building Federal Profiles ===")
        build_federal_profiles.build()

    with c.step("build_state_profiles"):
        print("=== Building State Profiles ===")
        build_state_profiles.build()

    c.set_headlines(
        [
            {
                "key": "federal_profiles",
                "label": "Federal Profiles",
                "format": "number",
            },
            {"key": "state_profiles", "label": "State Profiles", "format": "number"},
        ]
    )
