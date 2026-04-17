"""Entry point for state rhetoric public data export to S3 (daily)."""

import sys
import os
import subprocess

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config
from shared.runner import job_collector

load_config()

public_dir = os.path.join(os.path.dirname(__file__), "..", "rhetoric", "public")

with job_collector("state-rhetoric-public-s3") as c:
    # Collect data
    print("COLLECTING STATE DATA; SAVING LOCALLY")
    subprocess.run(
        [sys.executable, "collect_state.py"],
        cwd=public_dir,
        check=True,
    )

    # Push to S3 if .tmp directory exists (collect_state.py creates it only if there are changes)
    tmp_dir = os.path.join(public_dir, ".tmp")
    if os.path.isdir(tmp_dir):
        print("PUSHING STATE DATA; SENDING TO S3")
        import boto3
        import shutil

        s3 = boto3.client("s3")
        bucket = os.environ["S3_BUCKET"]
        prefix = "data/elite/"
        uploaded = 0
        total_size = 0
        for fname in os.listdir(tmp_dir):
            if not fname.startswith("state-"):
                continue
            fpath = os.path.join(tmp_dir, fname)
            if os.path.isfile(fpath):
                key = prefix + fname
                print(f"  Uploading {fname} -> s3://{bucket}/{key}")
                total_size += os.path.getsize(fpath)
                s3.upload_file(
                    fpath, bucket, key, ExtraArgs={"StorageClass": "REDUCED_REDUNDANCY"}
                )
                uploaded += 1
        shutil.rmtree(tmp_dir)
        c.set("files_uploaded", uploaded)
        c.set("data_size", total_size)
        c.set_records_processed(uploaded)
    else:
        print("No changes to export. Exiting.")
        c.set("files_uploaded", 0)
        c.set("data_size", 0)

    c.set_headlines(
        [
            {"key": "files_uploaded", "label": "Files Uploaded", "format": "number"},
            {"key": "data_size", "label": "Data Size", "format": "bytes"},
        ]
    )
