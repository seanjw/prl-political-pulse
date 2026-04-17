"""Step 1: Crawl press release listing pages and extract URLs, dates, and headlines."""

import logging
from typing import Any

import dataset
import pandas as pd

from elite.statements import ingestion_utils
from shared.config import get_db_url

logger = logging.getLogger(__name__)

# Set to an int for testing/debugging (e.g. 3), None for all officials
MAX_OFFICIALS = None


def run_url_ingestion() -> dict[str, Any]:
    """Crawl listing pages for all active federal officials and upsert discovered URLs.

    Returns dict with keys: officials_processed, officials_succeeded,
    officials_failed, urls_discovered, urls_new
    """
    db_url = get_db_url("elite")

    # Fetch officials joined with scrape params
    dbx = dataset.connect(db_url)
    rows = list(
        dbx.query(
            "SELECT o.bioguide_id, o.first_name, o.last_name, o.party, "
            "o.government_website, sp.press_release_url, sp.next_page_selector "
            "FROM officials o "
            "JOIN statements_scrape_params sp ON o.bioguide_id = sp.bioguide_id "
            "WHERE o.level = 'national' AND o.active = 1"
        )
    )
    existing_urls = {row["url"] for row in dbx.query("SELECT url FROM statements")}
    dbx.close()

    officials_df = pd.DataFrame(rows)

    if MAX_OFFICIALS:
        officials_df = officials_df.head(MAX_OFFICIALS)

    metrics = {
        "officials_processed": 0,
        "officials_succeeded": 0,
        "officials_failed": 0,
        "urls_discovered": 0,
        "urls_new": 0,
    }

    for _idx, official in officials_df.iterrows():
        metrics["officials_processed"] += 1

        try:
            urls_df, error, error_text = (
                ingestion_utils.ingest_new_urls_from_press_page(official, db_url)
            )

            dbx = dataset.connect(db_url)
            dbx["statements_scrape_params"].update(
                {
                    "bioguide_id": official.bioguide_id,
                    "last_run_error": error,
                    "last_run_error_text": str(error_text) if error_text else None,
                },
                "bioguide_id",
            )

            if error == 0 and urls_df is not None and not urls_df.empty:
                metrics["officials_succeeded"] += 1
                metrics["urls_discovered"] += len(urls_df)

                new_urls = urls_df[~urls_df["url"].isin(existing_urls)]
                metrics["urls_new"] += len(new_urls)

                dbx["statements"].upsert_many(urls_df.to_dict(orient="records"), "url")
                existing_urls.update(urls_df["url"].tolist())

                logger.info(
                    "[%s] %s %s: %d URLs (%d new)",
                    official.bioguide_id,
                    official.first_name,
                    official.last_name,
                    len(urls_df),
                    len(new_urls),
                )
            else:
                metrics["officials_failed"] += 1
                logger.warning(
                    "[%s] %s %s: FAILED - %s",
                    official.bioguide_id,
                    official.first_name,
                    official.last_name,
                    error_text,
                )

            dbx.close()

        except Exception as e:
            metrics["officials_failed"] += 1
            logger.error(
                "[%s] %s %s: EXCEPTION - %s",
                official.bioguide_id,
                official.first_name,
                official.last_name,
                e,
            )

    return metrics
