"""Entry point for Google Ads ingestion (daily)."""

from shared.runner import run_scripts, print_job_summary

run_scripts("elite/ads/google-reduced", ["ingest.py"])
print_job_summary(description="Google Ads ingestion completed")
