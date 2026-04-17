"""Download Twitter profile images for national legislators and upload to S3.

Uses the Twitter v2 API (/users) to get profile_image_url by user ID,
downloads the original-size image, and stores it in S3 at:
    s3://$S3_BUCKET/elites/profiles/national/images/twitter/{bioguide_id}.jpg

The frontend falls back to these when congress.gov images are unavailable.

Requires TWITTER_API env var (bearer token), loaded via shared.config.

Run:
    cd prl-backend
    python3 scripts/download_legislator_images.py
"""

import os
import sys
import time

import boto3
import dataset
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.config import load_config, get_db_url

BUCKET = os.environ["S3_BUCKET"]
S3_PREFIX = "elites/profiles/national/images/twitter"
REQUEST_TIMEOUT = 15
DELAY = 3.0
BATCH_SIZE = 100  # Twitter v2 max for /users endpoint


def lookup_users_by_id(user_ids, bearer_token):
    """Look up user profiles by ID via Twitter v2 API.

    Returns dict mapping user_id (str) -> profile_image_url (original size).
    """
    url = "https://api.twitter.com/2/users"
    headers = {"Authorization": f"Bearer {bearer_token}"}
    params = {
        "ids": ",".join(str(uid) for uid in user_ids),
        "user.fields": "profile_image_url",
    }

    resp = requests.get(url, headers=headers, params=params, timeout=REQUEST_TIMEOUT)

    if resp.status_code == 429:
        reset = resp.headers.get("x-rate-limit-reset")
        if reset:
            wait = max(int(reset) - int(time.time()), 1) + 5
        else:
            wait = 60
        print(f"  Rate limited, waiting {wait}s...", flush=True)
        time.sleep(wait)
        resp = requests.get(
            url, headers=headers, params=params, timeout=REQUEST_TIMEOUT
        )

    resp.raise_for_status()
    data = resp.json()

    result = {}
    for user in data.get("data", []):
        img_url = user.get("profile_image_url", "")
        if img_url:
            img_url = img_url.replace("_normal.", ".")
        result[user["id"]] = img_url

    return result


def download_image(url):
    """Download an image from a URL. Returns (bytes, content_type)."""
    resp = requests.get(url, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "image/jpeg")


def main():
    load_config()

    bearer_token = os.environ.get("TWITTER_API", "")
    if not bearer_token:
        print("No TWITTER_API token available, aborting")
        return

    db = dataset.connect(get_db_url("elite"))
    s3 = boto3.client("s3", region_name="us-east-1")

    # Get all active national legislators with a twitter_id
    legislators = list(
        db.query(
            "SELECT bioguide_id, first_name, last_name, twitter_id "
            "FROM officials "
            "WHERE active = 1 AND level = 'national' AND twitter_id IS NOT NULL"
        )
    )
    print(f"Found {len(legislators)} national legislators with Twitter IDs", flush=True)

    # Check which images already exist in S3
    existing = set()
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET, Prefix=f"{S3_PREFIX}/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            basename = key.rsplit("/", 1)[-1].rsplit(".", 1)[0]
            existing.add(basename)

    print(f"Found {len(existing)} existing images in S3", flush=True)

    # Filter to only legislators that need images
    todo = [leg for leg in legislators if leg["bioguide_id"] not in existing]
    print(f"{len(todo)} legislators need images", flush=True)

    if not todo:
        print("Nothing to do!")
        db.engine.dispose()
        db.close()
        return

    # Build twitter_id -> bioguide_id mapping
    # twitter_id can be comma-separated; take the first one
    tid_to_bio = {}
    for leg in todo:
        raw_tid = str(leg["twitter_id"]).strip()
        first_tid = raw_tid.split(",")[0].strip()
        if first_tid and first_tid.isdigit():
            tid_to_bio[first_tid] = leg["bioguide_id"]

    downloaded = 0
    failed = 0
    no_profile = 0

    # Process in batches of 100
    tids = list(tid_to_bio.keys())
    for batch_start in range(0, len(tids), BATCH_SIZE):
        batch = tids[batch_start : batch_start + BATCH_SIZE]
        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (len(tids) + BATCH_SIZE - 1) // BATCH_SIZE
        print(
            f"\n--- Batch {batch_num}/{total_batches} ({len(batch)} IDs) ---",
            flush=True,
        )

        try:
            profiles = lookup_users_by_id(batch, bearer_token)
        except Exception as e:
            print(f"  Batch lookup failed: {e}", flush=True)
            failed += len(batch)
            time.sleep(DELAY)
            continue

        for tid in batch:
            bio = tid_to_bio[tid]
            img_url = profiles.get(tid, "")

            if not img_url:
                print(f"  SKIP {bio} (tid {tid}): no profile image", flush=True)
                no_profile += 1
                continue

            try:
                data, content_type = download_image(img_url)
                ext = "jpg"
                if "png" in content_type:
                    ext = "png"
                elif "webp" in content_type:
                    ext = "webp"

                s3_key = f"{S3_PREFIX}/{bio}.{ext}"
                s3.put_object(
                    Bucket=BUCKET,
                    Key=s3_key,
                    Body=data,
                    ContentType=content_type,
                    CacheControl="public, max-age=604800",
                )
                downloaded += 1
                print(f"  OK   {bio} (tid {tid}) -> {s3_key}", flush=True)
            except Exception as e:
                print(f"  FAIL {bio} (tid {tid}): {e}", flush=True)
                failed += 1

        time.sleep(DELAY)

    db.engine.dispose()
    db.close()

    print(
        f"\nDone: {downloaded} downloaded, {no_profile} no profile image, "
        f"{failed} failed, {len(existing)} already existed",
        flush=True,
    )


if __name__ == "__main__":
    main()
