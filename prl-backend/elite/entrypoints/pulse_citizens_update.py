"""Entry point for Pulse citizens dashboard data update (daily).

Skipped — citizens data is now handled by the survey-processor Lambda.
The old pulse/site/src/citizens/ build scripts were removed during the
repo reorganisation.  This entrypoint is kept so the ECS task definition
still resolves; it simply logs a summary and exits.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config
from shared.runner import print_job_summary

load_config()

print("Citizens data is now handled by the survey-processor Lambda.")
print("This batch job is a no-op.")

print_job_summary(
    description="Skipped — citizens data handled by survey-processor Lambda"
)
