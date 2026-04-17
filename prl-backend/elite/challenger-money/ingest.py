"""Download FEC candidate financial summary CSV.

Downloads the candidate_summary CSV for the current election cycle from
the FEC bulk downloads site. This file contains total receipts,
disbursements, cash on hand, and contribution breakdowns for every federal
candidate who has filed with the FEC.
"""

import os

import requests

CYCLE = os.environ.get("FEC_CYCLE", "26")
CYCLE_FULL = f"20{CYCLE}"

BASE_URL = "https://www.fec.gov/files/bulk-downloads"

os.makedirs(".tmp", exist_ok=True)

# Download candidate summary CSV (includes headers)
print(f"Downloading candidate_summary_{CYCLE_FULL}.csv...")
url = f"{BASE_URL}/{CYCLE_FULL}/candidate_summary_{CYCLE_FULL}.csv"
response = requests.get(url, allow_redirects=True)
response.raise_for_status()

out_path = f".tmp/candidate_summary_{CYCLE_FULL}.csv"
with open(out_path, "wb") as f:
    f.write(response.content)

print(f"  Saved {len(response.content):,} bytes to {out_path}")
print("FEC candidate summary download complete")
