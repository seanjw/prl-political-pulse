"""Entry point for challenger CSV sync from S3 (weekly Sunday)."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from shared.config import load_config, get_db_url
from shared.runner import job_collector

load_config()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "challengers"))
import sync  # noqa: E402

with job_collector("challenger-sync") as c:
    db_url = get_db_url("elite", dialect="mysql+pymysql")
    result = sync.run(db_url)
    c.set("candidates_upserted", result["upserted"])
    c.set("candidates_deactivated", result["deactivated"])
    c.set("ids_resolved", result["ids_resolved"])
    c.set_records_processed(result["upserted"])
    c.set_headlines(
        [
            {
                "key": "candidates_upserted",
                "label": "Candidates Upserted",
                "format": "number",
            },
            {
                "key": "ids_resolved",
                "label": "IDs Resolved",
                "format": "number",
            },
        ]
    )
