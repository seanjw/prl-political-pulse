"""Step 2: Parallel text scraping with Trafilatura + Playwright fallback."""

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import dataset
import trafilatura
from playwright.sync_api import sync_playwright

from shared.config import get_db_url

logger = logging.getLogger(__name__)

MAX_RETRIES = 5
SCRAPE_WORKERS = 8
POLITE_DELAY = 1.0  # seconds between requests per worker

# Thread-local storage for per-thread Playwright instances
_thread_local = threading.local()


def _get_playwright_page():
    """Get or create a Playwright page for the current thread.

    Each thread gets its own sync_playwright() + browser + context + page
    because Playwright's sync API uses greenlets that are bound to the
    thread where sync_playwright() was started.
    """
    if not hasattr(_thread_local, "page"):
        pw = sync_playwright().start()
        browser = pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 720},
        )
        _thread_local.pw = pw
        _thread_local.browser = browser
        _thread_local.context = context
        _thread_local.page = context.new_page()
    return _thread_local.page


def _cleanup_thread_playwright():
    """Close all Playwright resources for the current thread."""
    for attr in ("page", "context", "browser"):
        obj = getattr(_thread_local, attr, None)
        if obj:
            try:
                obj.close()
            except Exception:
                pass
            delattr(_thread_local, attr)
    pw = getattr(_thread_local, "pw", None)
    if pw:
        try:
            pw.stop()
        except Exception:
            pass
        del _thread_local.pw


def _scrape_one_url(url: str, db_url: str) -> dict:
    """Scrape text from a single URL using Trafilatura, falling back to Playwright.

    Returns dict with keys: url, success, text_length, error
    """
    result = {"url": url, "success": False, "text_length": 0, "error": None}
    text = None

    # Attempt 1: Trafilatura (fast, no browser needed)
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded:
            text = trafilatura.extract(
                downloaded, include_comments=False, include_tables=False
            )
            if text:
                text = text.strip()
    except Exception as e:
        logger.debug("Trafilatura failed for %s: %s", url, e)

    # Attempt 2: Playwright fallback if Trafilatura got nothing
    if not text:
        try:
            page = _get_playwright_page()
            page.goto(url, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)
            html = page.content()
            text = trafilatura.extract(
                html, include_comments=False, include_tables=False
            )
            if text:
                text = text.strip()
        except Exception as e:
            logger.debug("Playwright fallback failed for %s: %s", url, e)
            result["error"] = str(e)[:500]
            # Recreate Playwright on error to avoid corrupted state
            _cleanup_thread_playwright()

    # Write result to DB (with deadlock retry for concurrent writes)
    for attempt in range(3):
        try:
            dbx = dataset.connect(db_url)
            if text:
                dbx["statements"].update(
                    {
                        "url": url,
                        "text": text,
                        "content_has_been_scraped": 1,
                        "scrape_error": None,
                    },
                    ["url"],
                )
                dbx.query(
                    "UPDATE statements SET scrape_attempts = scrape_attempts + 1 "
                    "WHERE url = :url",
                    url=url,
                )
                result["success"] = True
                result["text_length"] = len(text)
            else:
                error_msg = (
                    result.get("error")
                    or "No text extracted (trafilatura + playwright)"
                )
                dbx.query(
                    "UPDATE statements SET scrape_attempts = scrape_attempts + 1, "
                    "scrape_error = :error WHERE url = :url",
                    url=url,
                    error=error_msg[:2000],
                )
                result["error"] = error_msg
            dbx.close()
            break
        except Exception as e:
            if "Deadlock" in str(e) and attempt < 2:
                time.sleep(0.5 * (attempt + 1))
                continue
            logger.error("DB write failed for %s: %s", url, e)
            break

    time.sleep(POLITE_DELAY)
    return result


def run_text_scraping() -> dict[str, Any]:
    """Scrape text content for all unscraped URLs, respecting MAX_RETRIES.

    Returns dict with keys: urls_attempted, urls_succeeded, urls_failed,
    urls_skipped_max_retries
    """
    db_url = get_db_url("elite")

    # Fetch unscraped URLs that haven't exceeded retry limit
    dbx = dataset.connect(db_url)
    url_rows = list(
        dbx.query(
            "SELECT url FROM statements "
            "WHERE (content_has_been_scraped = 0 OR content_has_been_scraped IS NULL) "
            "AND scrape_attempts < :max_retries",
            max_retries=MAX_RETRIES,
        )
    )
    skipped_rows = list(
        dbx.query(
            "SELECT COUNT(*) AS cnt FROM statements "
            "WHERE (content_has_been_scraped = 0 OR content_has_been_scraped IS NULL) "
            "AND scrape_attempts >= :max_retries",
            max_retries=MAX_RETRIES,
        )
    )
    dbx.close()

    url_list = [r["url"] for r in url_rows]
    skipped_count = skipped_rows[0]["cnt"]

    logger.info(
        "Found %d URLs to scrape, %d skipped (max retries)",
        len(url_list),
        skipped_count,
    )

    metrics = {
        "urls_attempted": len(url_list),
        "urls_succeeded": 0,
        "urls_failed": 0,
        "urls_skipped_max_retries": int(skipped_count),
    }

    if not url_list:
        return metrics

    # Fan out to ThreadPoolExecutor workers
    # Each thread lazily creates its own Playwright instance on first fallback
    with ThreadPoolExecutor(max_workers=SCRAPE_WORKERS) as executor:
        futures = {
            executor.submit(_scrape_one_url, url, db_url): url for url in url_list
        }

        for future in as_completed(futures):
            url = futures[future]
            try:
                result = future.result()
                if result["success"]:
                    metrics["urls_succeeded"] += 1
                else:
                    metrics["urls_failed"] += 1
                    logger.warning(
                        "Failed: %s - %s", url, result.get("error", "unknown")
                    )
            except Exception as e:
                metrics["urls_failed"] += 1
                logger.error("Exception scraping %s: %s", url, e)

    return metrics
