"""Entry point for international survey data export (daily)."""

from shared.runner import run_scripts, print_job_summary

run_scripts("surveys/process/international", ["upload.py"])
print_job_summary(description="International survey data exported")
