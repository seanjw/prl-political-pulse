"""Entry point for state legislator profile updates (weekly).

Runs the update pipeline: openstates sync, openstates backfill for
unreviewed officials, and image download (OpenStates + X API fallback).
"""

import sys
import os
import subprocess
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config
from shared.runner import job_collector

load_config()

state_dir = os.path.join(
    os.path.dirname(__file__), "..", "officials", "state-legislators"
)
openstates_dir = os.path.join(state_dir, "openstates")
images_dir = os.path.join(state_dir, "images")

with job_collector("state-update") as c:
    # Clone openstates/people repo
    with tempfile.TemporaryDirectory() as tmp:
        people_dir = os.path.join(tmp, "people")
        subprocess.run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                "https://github.com/openstates/people.git",
                people_dir,
            ],
            check=True,
        )

        # Symlink into expected location
        expected_people = os.path.join(openstates_dir, "people")
        if os.path.islink(expected_people):
            os.unlink(expected_people)
        os.symlink(people_dir, expected_people)

        with c.step("openstates_sync"):
            print("=== UPDATE OPENSTATES REPO AND PULL DATA ===")
            subprocess.run(
                [sys.executable, "openstates repo --> db table.py"],
                cwd=openstates_dir,
                check=True,
            )
            subprocess.run(
                [sys.executable, "openstates table --> officials table.py"],
                cwd=openstates_dir,
                check=True,
            )

        with c.step("openstates_backfill"):
            print("=== OVERWRITE DB WITH DATA FROM OPENSTATES ===")
            subprocess.run(
                [sys.executable, "officials openstates column --> empty cells.py"],
                cwd=openstates_dir,
                check=True,
            )

        with c.step("update_images"):
            print("=== UPDATE IMAGES ===")
            os.makedirs(os.path.join(images_dir, "set"), exist_ok=True)
            subprocess.run(
                [sys.executable, "save images.py"],
                cwd=images_dir,
                check=True,
            )

    c.set_headlines(
        [
            {
                "key": "legislators_updated",
                "label": "Legislators Updated",
                "format": "number",
            },
            {
                "key": "images_downloaded",
                "label": "Images Downloaded",
                "format": "number",
            },
        ]
    )
