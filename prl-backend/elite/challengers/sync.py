"""
Sync challenger candidates from S3 CSV into the challengers table.
Also resolves Twitter handles to IDs for new candidates.
"""

import os
import time
import tempfile
import datetime

import boto3
import dataset
import pandas as pd
import requests


def clean_twitter_handle(handle):
    """Clean a Twitter handle string, removing URLs and @ prefixes."""
    handle = (
        handle.replace("https://twitter.com/", "")
        .replace("https://www.twitter.com/", "")
        .replace("https://mobile.twitter.com/", "")
        .replace("https://x.com/", "")
        .replace("https://www.x.com/", "")
        .replace("twitter.com/", "")
        .replace("www.twitter.com/", "")
        .replace("mobile.twitter.com/", "")
        .replace("x.com/", "")
        .replace("www.x.com/", "")
        .replace("@", "")
        .replace("?lang=en", "")
        .strip()
    )
    handle = handle.split("?")[0].strip()
    return handle


def batch_resolve_twitter_ids(handles, bearer_token):
    """Resolve up to 100 Twitter handles to user IDs in a single API call.

    Uses GET /2/users/by?usernames=handle1,handle2,...
    Returns dict mapping handle (lowercase) -> user ID string.
    """
    if not handles:
        return {}, []

    api_url = "https://api.twitter.com/2/users/by"
    headers = {"Authorization": f"Bearer {bearer_token}"}
    params = {"usernames": ",".join(handles)}
    max_retries = 3
    wait_time = 15 * 60

    for attempt in range(max_retries):
        try:
            response = requests.get(api_url, headers=headers, params=params)
            if response.status_code == 429:
                print(
                    f"  Rate limited, waiting 15 min "
                    f"(attempt {attempt + 1}/{max_retries})"
                )
                time.sleep(wait_time)
                continue
            response.raise_for_status()
            data = response.json()

            resolved = {}
            for user in data.get("data", []):
                resolved[user["username"].lower()] = user["id"]

            not_found = []
            for err in data.get("errors", []):
                not_found.append(err.get("value", "unknown"))

            return resolved, not_found

        except requests.exceptions.HTTPError:
            if response.status_code in [500, 502, 503, 504]:
                print(f"  Server error {response.status_code}, retrying...")
                time.sleep(5)
            else:
                print(f"  HTTP {response.status_code}: {response.text[:200]}")
                return {}, handles
        except Exception as e:
            print(f"  Unexpected error in batch resolve: {e}")
            return {}, handles

    return {}, handles


def parse_csv_date(val):
    """Parse a date string in M/D/YY format, returning None on failure."""
    if pd.isna(val) or str(val).strip() == "":
        return None
    try:
        return datetime.datetime.strptime(str(val).strip(), "%m/%d/%y").date()
    except ValueError:
        return None


def run(db_url):
    """Download CSV from S3, upsert candidates, resolve Twitter IDs."""
    bucket = os.environ.get("CHALLENGER_CSV_S3_BUCKET", os.environ["S3_BUCKET"])
    key = os.environ.get(
        "CHALLENGER_CSV_S3_KEY", "data/challengers/primary_candidates_2026.csv"
    )
    bearer_token = os.environ.get("TWITTER_API", "")

    # Download CSV from S3
    s3 = boto3.client("s3")
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        print(f"Downloading s3://{bucket}/{key}...")
        s3.download_file(bucket, key, tmp_path)
        df = pd.read_csv(tmp_path, dtype=str)
    finally:
        os.unlink(tmp_path)

    print(f"CSV loaded: {len(df)} total rows")

    # Filter to incumbents, challengers, and open seat
    df = df[df["incumbent_challenge"].isin(["I", "C", "O"])].copy()
    print(f"After filtering (I + C + O): {len(df)} candidates")

    # Clean twitter handles
    def clean_handles(val):
        if pd.isna(val) or str(val).strip() == "":
            return None
        handles = []
        raw = str(val).replace(" ", ",")
        for h in raw.split(","):
            cleaned = clean_twitter_handle(h.strip())
            if cleaned:
                handles.append(cleaned)
        return ", ".join(handles) if handles else None

    df["twitter_handle"] = df["twitter_handle"].apply(clean_handles)

    # Parse boolean columns
    bool_cols = ["candidate_inactive", "has_raised_funds", "federal_funds_flag"]
    for col in bool_cols:
        df[col] = df[col].apply(
            lambda x: True if str(x).strip().upper() == "TRUE" else False
        )

    # Parse date columns
    date_cols = ["first_file_date", "last_file_date"]
    for col in date_cols:
        df[col] = df[col].apply(parse_csv_date)

    # Drop columns we don't need in the DB
    drop_cols = ["last_f2_date", "cycles"]
    df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors="ignore")

    # Build a lookup of existing officials by twitter handle for linking
    # This identifies current officeholders running for new office (e.g. House -> Senate)
    dbx = dataset.connect(db_url + "?charset=utf8mb4")
    officials = list(dbx["officials"].find(active=True))
    dbx.engine.dispose()
    dbx.close()

    # Map each cleaned handle to the official's bioguide_id
    handle_to_bioguide = {}
    for official in officials:
        if official.get("twitter_handle"):
            for h in str(official["twitter_handle"]).replace(" ", ",").split(","):
                cleaned = clean_twitter_handle(h.strip())
                if cleaned and official.get("bioguide_id"):
                    handle_to_bioguide[cleaned.lower()] = official["bioguide_id"]

    # Upsert into challengers table
    dbx = dataset.connect(db_url + "?charset=utf8mb4")
    table = dbx["challengers"]

    csv_candidate_ids = set(df["candidate_id"].tolist())
    upserted = 0
    incumbents_linked = 0

    for _, row in df.iterrows():
        record = row.to_dict()
        # Replace NaN with None
        record = {k: (None if pd.isna(v) else v) for k, v in record.items()}
        record["active"] = True

        # Link to existing official if their twitter handle matches
        if record.get("twitter_handle"):
            for h in str(record["twitter_handle"]).split(","):
                h = h.strip().lower()
                if h in handle_to_bioguide:
                    record["bioguide_id"] = handle_to_bioguide[h]
                    incumbents_linked += 1
                    print(
                        f"  Linked {record['name']} -> bioguide {record['bioguide_id']} "
                        f"(existing officeholder)"
                    )
                    break

        table.upsert(record, ["candidate_id"])
        upserted += 1

    # Deactivate candidates no longer in CSV
    deactivated = 0
    existing = list(table.find(active=True))
    for row in existing:
        if row["candidate_id"] not in csv_candidate_ids:
            table.update(
                {"candidate_id": row["candidate_id"], "active": False},
                ["candidate_id"],
            )
            deactivated += 1

    dbx.engine.dispose()
    dbx.close()

    print(
        f"Upserted {upserted} candidates, deactivated {deactivated}, "
        f"linked {incumbents_linked} existing officeholders"
    )

    # Resolve Twitter IDs for candidates missing them (batch API: 100 per request)
    ids_resolved = 0
    ids_failed = 0
    if bearer_token:
        dbx = dataset.connect(db_url + "?charset=utf8mb4")
        table = dbx["challengers"]
        needs_resolution = list(
            table.find(active=True, twitter_id=None, order_by="candidate_id")
        )
        dbx.engine.dispose()
        dbx.close()

        # Build list of (candidate, [handles]) needing resolution
        candidates_to_resolve = []
        for candidate in needs_resolution:
            handle_str = candidate.get("twitter_handle")
            if not handle_str:
                continue
            handles = [h.strip() for h in handle_str.split(",") if h.strip()]
            if handles:
                candidates_to_resolve.append((candidate, handles))

        # Collect all unique handles and batch-resolve them
        all_handles = []
        for _, handles in candidates_to_resolve:
            all_handles.extend(handles)
        unique_handles = list(dict.fromkeys(all_handles))  # dedup, preserve order

        print(
            f"Resolving {len(unique_handles)} unique handles for "
            f"{len(candidates_to_resolve)} candidates via batch API..."
        )

        # Batch resolve in chunks of 100 (API limit)
        handle_to_id = {}
        failed_handles = set()
        batch_size = 100

        for i in range(0, len(unique_handles), batch_size):
            chunk = unique_handles[i : i + batch_size]
            print(
                f"  Batch {i // batch_size + 1}/"
                f"{(len(unique_handles) + batch_size - 1) // batch_size}: "
                f"{len(chunk)} handles"
            )
            resolved, not_found = batch_resolve_twitter_ids(chunk, bearer_token)
            handle_to_id.update(resolved)
            failed_handles.update(h.lower() for h in not_found)

        print(
            f"  Batch resolution complete: {len(handle_to_id)} found, "
            f"{len(failed_handles)} not found"
        )

        # Update each candidate with their resolved IDs
        for candidate, handles in candidates_to_resolve:
            resolved_ids = []
            errs = ""
            for handle in handles:
                tid = handle_to_id.get(handle.lower())
                if tid:
                    resolved_ids.append(tid)
                else:
                    errs += f"failed: @{handle}; "

            update_data = {"candidate_id": candidate["candidate_id"]}

            if resolved_ids:
                update_data["twitter_id"] = ",".join(resolved_ids)
                ids_resolved += 1
                print(f"  Resolved {candidate['name']}: {','.join(resolved_ids)}")
            else:
                ids_failed += 1

            if errs:
                error_flags = candidate.get("error_flags") or {}
                if isinstance(error_flags, str):
                    import json

                    error_flags = json.loads(error_flags)
                error_flags["twitter_handle"] = errs
                update_data["error_flags"] = error_flags

            if len(update_data) > 1:  # has more than just candidate_id
                dbx = dataset.connect(db_url + "?charset=utf8mb4")
                dbx["challengers"].update(update_data, ["candidate_id"])
                dbx.engine.dispose()
                dbx.close()
    else:
        print("No TWITTER_API token available, skipping ID resolution")

    print(f"Resolved {ids_resolved} Twitter IDs, {ids_failed} failed")

    return {
        "upserted": upserted,
        "deactivated": deactivated,
        "ids_resolved": ids_resolved,
    }
