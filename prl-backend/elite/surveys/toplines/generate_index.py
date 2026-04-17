"""Generate toplines index JSON from S3.

Scans the toplines/ prefix in S3, parses filenames to extract wave/year/week
metadata, and uploads a toplines/index.json manifest so the frontend can
dynamically list available topline PDFs without hardcoding.
"""

import json
import os
import re

import boto3

S3_BUCKET = os.environ["S3_BUCKET"]


def generate_toplines_index():
    """Scan S3 for topline PDFs and upload index.json.

    Returns:
        dict with 'us_waves' count and 'international' country counts.
    """
    s3 = boto3.resource("s3")
    bucket = s3.Bucket(S3_BUCKET)

    us_waves = []
    international = {}

    # US pattern: toplines/s{survey}-{year}_week{week}.pdf
    us_pattern = re.compile(r"^toplines/s(\d+)-(\d{4})_week(\d+)\.pdf$")
    # International: toplines/international/{country}-wave{wave}-toplines.pdf
    intl_pattern = re.compile(
        r"^toplines/international/([a-z]+)-wave(\d+)-toplines\.pdf$", re.IGNORECASE
    )

    for obj in bucket.objects.filter(Prefix="toplines/"):
        key = obj.key

        us_match = us_pattern.match(key)
        if us_match:
            wave = int(us_match.group(1))
            year = int(us_match.group(2))
            week = int(us_match.group(3))
            us_waves.append(
                {
                    "wave": wave,
                    "file": f"s{wave}-{year}_week{week}.pdf",
                }
            )
            continue

        intl_match = intl_pattern.match(key)
        if intl_match:
            country = intl_match.group(1).lower()
            wave = int(intl_match.group(2))
            if country not in international:
                international[country] = []
            international[country].append(wave)

    # Sort US waves by wave number
    us_waves.sort(key=lambda w: w["wave"])

    # Sort international waves
    for country in international:
        international[country].sort()

    index = {
        "us_waves": us_waves,
        "international": international,
    }

    # Upload to S3
    s3_client = boto3.client("s3")
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key="toplines/index.json",
        Body=json.dumps(index),
        ContentType="application/json",
        CacheControl="max-age=300",
    )

    print(
        f"Uploaded toplines/index.json: {len(us_waves)} US waves, "
        f"{sum(len(v) for v in international.values())} international PDFs"
    )

    return {
        "us_waves": len(us_waves),
        "international": {k: len(v) for k, v in international.items()},
    }
