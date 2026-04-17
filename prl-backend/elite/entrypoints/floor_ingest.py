"""Entry point for floor speech ingestion (daily)."""

import sys
import os
import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config, get_db_url
from shared.runner import job_collector

load_config()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "floor"))
import ingestor  # noqa: E402

import dataset  # noqa: E402
import sqlalchemy as sql  # noqa: E402

with job_collector("floor-ingest") as c:
    db = get_db_url("elite")
    logdb = db
    api_key = os.environ["CONGRESS_API"]

    # Initialize table
    ingestor.init(db)

    # Get date ranges
    start_date = datetime.date(2024, 6, 3)

    dbx = dataset.connect(db)
    max_date = (
        sql.select(sql.func.max(dbx[ingestor.tablename].table.c.date))
        .execute()
        .first()[0]
    )
    init_count = dbx[ingestor.tablename].count()
    dbx.engine.dispose()
    dbx.close()

    if max_date:
        start_date = max_date + datetime.timedelta(days=1)

    end_date = datetime.datetime.now().date()
    days_to_process = (end_date - start_date).days + 1
    c.set("days_processed", 0)
    c.set("api_calls", 0)
    c.set("new_speeches", 0)

    # Execute ingestion
    for day in range(days_to_process):
        date = start_date + datetime.timedelta(days=day)
        print("collecting for:", date)

        dbx = dataset.connect(db)
        existing = dbx[ingestor.tablename].find_one(date=date)
        dbx.engine.dispose()
        dbx.close()

        if existing:
            print(f"Skipping {date} since there are already existing entries")
        else:
            ingestor.ingest(date, date, db, logdb, api_key)
            c.increment("api_calls")

        c.increment("days_processed")

    dbx = dataset.connect(db)
    end_count = dbx[ingestor.tablename].count()
    dbx.engine.dispose()
    dbx.close()

    new = end_count - init_count
    c.set("new_speeches", new)
    c.set_records_processed(new)
    c.set_headlines(
        [
            {"key": "new_speeches", "label": "New Speeches", "format": "number"},
            {"key": "api_calls", "label": "API Calls", "format": "number"},
        ]
    )
    print(f"\titems processed: {new}")
