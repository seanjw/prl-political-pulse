"""Download Twitter profile images for primary candidates and upload to S3.

Uses the Twitter v2 API (users/by/username) to get profile_image_url, then
downloads the original-size image and stores it in S3 at:
    s3://$S3_BUCKET/primary/images/{candidate_id}.jpg

Requires TWITTER_API env var (bearer token), loaded via shared.config.

Run:
    cd prl-backend
    python3 scripts/download_candidate_images.py
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
S3_PREFIX = "primary/images"
REQUEST_TIMEOUT = 15
# Twitter v2 API allows 300 requests per 15-min window for user lookup
# That's 1 request per 3 seconds to stay safe
DELAY = 3.0
# Batch size for /users/by endpoint (max 100)
BATCH_SIZE = 100


def lookup_users_batch(handles, bearer_token):
    """Look up user profiles for up to 100 handles via Twitter v2 API.

    Returns dict mapping lowercase handle -> profile_image_url (original size).
    """
    url = "https://api.twitter.com/2/users/by"
    headers = {"Authorization": f"Bearer {bearer_token}"}
    params = {
        "usernames": ",".join(handles),
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
            # Twitter returns _normal size (48x48) — remove _normal for original
            img_url = img_url.replace("_normal.", ".")
        result[user["username"].lower()] = img_url

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

    # Get all active challengers with a twitter handle
    challengers = list(db["challengers"].find(active=True))
    candidates = [
        c
        for c in challengers
        if c.get("twitter_handle") and not str(c["twitter_handle"]).strip().isdigit()
    ]
    print(f"Found {len(candidates)} candidates with Twitter handles", flush=True)

    # Check which images already exist in S3
    existing = set()
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET, Prefix=f"{S3_PREFIX}/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            basename = key.rsplit("/", 1)[-1].rsplit(".", 1)[0]
            existing.add(basename)

    print(f"Found {len(existing)} existing images in S3", flush=True)

    # Filter to only candidates that need images
    todo = [c for c in candidates if c["candidate_id"] not in existing]
    print(f"{len(todo)} candidates need images", flush=True)

    if not todo:
        print("Nothing to do!")
        db.engine.dispose()
        db.close()
        return

    # Build handle -> candidate_id mapping (use first handle if multiple)
    handle_to_cid = {}
    for c in todo:
        raw = c["twitter_handle"].strip()
        # Some entries have multiple handles separated by commas
        first_handle = raw.split(",")[0].strip().lstrip("@").lower()
        if first_handle:
            handle_to_cid[first_handle] = c["candidate_id"]

    downloaded = 0
    failed = 0
    no_profile = 0

    # Process in batches of 100 (Twitter API limit)
    handles = list(handle_to_cid.keys())
    for batch_start in range(0, len(handles), BATCH_SIZE):
        batch = handles[batch_start : batch_start + BATCH_SIZE]
        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (len(handles) + BATCH_SIZE - 1) // BATCH_SIZE
        print(
            f"\n--- Batch {batch_num}/{total_batches} ({len(batch)} handles) ---",
            flush=True,
        )

        try:
            profiles = lookup_users_batch(batch, bearer_token)
        except Exception as e:
            print(f"  Batch lookup failed: {e}", flush=True)
            failed += len(batch)
            time.sleep(DELAY)
            continue

        for handle in batch:
            cid = handle_to_cid[handle]
            img_url = profiles.get(handle, "")

            if not img_url:
                print(f"  SKIP {cid} (@{handle}): no profile image", flush=True)
                no_profile += 1
                continue

            try:
                data, content_type = download_image(img_url)
                ext = "jpg"
                if "png" in content_type:
                    ext = "png"
                elif "webp" in content_type:
                    ext = "webp"

                s3_key = f"{S3_PREFIX}/{cid}.{ext}"
                s3.put_object(
                    Bucket=BUCKET,
                    Key=s3_key,
                    Body=data,
                    ContentType=content_type,
                    CacheControl="public, max-age=604800",
                )
                downloaded += 1
                print(f"  OK   {cid} (@{handle}) -> {s3_key}", flush=True)
            except Exception as e:
                print(f"  FAIL {cid} (@{handle}): {e}", flush=True)
                failed += 1

        # Respect rate limits between batches
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
