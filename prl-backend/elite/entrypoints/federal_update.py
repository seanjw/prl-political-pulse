"""Entry point for federal legislator profile updates (weekly Sunday).

Clones the unitedstates/congress-legislators and images repos at runtime
since we can't rely on persistent disk on Fargate.
"""

import sys
import os
import subprocess
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config
from shared.runner import job_collector

load_config()

federal_dir = os.path.join(
    os.path.dirname(__file__), "..", "officials", "federal-legislators"
)

with job_collector("federal-update") as c:
    # Clone repos to temp dir (shallow clone for speed)
    with tempfile.TemporaryDirectory() as tmp:
        legislators_dir = os.path.join(tmp, "congress-legislators")
        images_dir = os.path.join(tmp, "images")

        subprocess.run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                "https://github.com/unitedstates/congress-legislators.git",
                legislators_dir,
            ],
            check=True,
        )
        c.increment("repos_cloned")

        subprocess.run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                "https://github.com/unitedstates/images.git",
                images_dir,
            ],
            check=True,
        )
        c.increment("repos_cloned")

        # Symlink repos into expected locations
        expected_us_dir = os.path.join(federal_dir, "unitedstates")
        os.makedirs(expected_us_dir, exist_ok=True)

        cl_link = os.path.join(expected_us_dir, "congress-legislators")
        img_link = os.path.join(expected_us_dir, "images")

        # Remove existing links/dirs if present
        for link in [cl_link, img_link]:
            if os.path.islink(link):
                os.unlink(link)

        os.symlink(legislators_dir, cl_link)
        os.symlink(images_dir, img_link)

        # Run the update scripts
        with c.step("transfer_data"):
            print("=== TRANSFERRING DATA ===")
            subprocess.run(
                [sys.executable, "push-to-internal-database.py"],
                cwd=federal_dir,
                check=True,
            )

        with c.step("update_serving"):
            print("=== UPDATING SERVING AND POSITION COLUMNS ===")
            subprocess.run(
                [sys.executable, "add serving since.py"],
                cwd=federal_dir,
                check=True,
            )

        with c.step("sync_images"):
            # Sync congressional images (ignore-existing keeps any custom overrides)
            images_src = os.path.join(images_dir, "congress", "450x550")
            images_dst = os.path.join(federal_dir, "images", "set")
            os.makedirs(images_dst, exist_ok=True)
            print("=== UPDATING IMAGES ===")
            subprocess.run(
                [
                    "rsync",
                    "-av",
                    "--ignore-existing",
                    images_src + "/",
                    images_dst + "/",
                ],
                cwd=federal_dir,
                check=True,
            )

    c.set_headlines(
        [
            {
                "key": "legislators_updated",
                "label": "Legislators Updated",
                "format": "number",
            },
            {"key": "images_synced", "label": "Images Synced", "format": "number"},
        ]
    )
