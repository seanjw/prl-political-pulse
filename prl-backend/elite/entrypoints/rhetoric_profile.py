"""Entry point for rhetoric profile updates (weekly Sunday)."""

from shared.runner import run_scripts, job_collector

with job_collector("rhetoric-profile") as c:
    run_scripts("elite/rhetoric/profile", ["build.py"])
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
