"""Discover press release URLs for federal officials using GPT-5.4.

Queries officials table, fetches government websites in parallel, uses GPT-5.4
to find and validate press release page URLs, and writes results back to officials.
"""

import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

import dataset
import openai
import requests

from elite.statements.ingestion_utils import extract_visible_html
from shared.config import get_db_url

logger = logging.getLogger(__name__)

# Max HTML chars to send to GPT (avoid token limits)
MAX_HTML_LENGTH = 80_000


def _call_gpt(system_message, user_message, model="gpt-5.4"):
    """Send a system+user message to GPT and return the response text."""
    with openai.OpenAI() as client:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.content.strip()


# URL path segments that strongly indicate a press release listing page.
_PRESS_PATH_RE = re.compile(
    r"/(press-releases?|press|statements?|newsroom|news|media-center|media)"
    r"(/press-releases?|/statements?)?/?$",
    re.IGNORECASE,
)


def _url_matches_press_pattern(url):
    """Check if a URL path matches known press release page patterns."""
    try:
        path = urlparse(url).path.rstrip("/")
        return bool(_PRESS_PATH_RE.search(path))
    except Exception:
        return False


def _fetch_and_clean(url, timeout=15):
    """Fetch a URL and return cleaned visible HTML."""
    resp = requests.get(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()
    html = extract_visible_html(resp.text)
    if len(html) > MAX_HTML_LENGTH:
        html = html[:MAX_HTML_LENGTH]
    return html


def _process_official(official):
    """Find and validate press release URL for a single official.

    Returns a dict with bioguide_id, press_release_url, press_release_url_status.
    """
    bioguide_id = official["bioguide_id"]
    name = f"{official['first_name']} {official['last_name']}"
    gov_url = official["government_website"]

    result = {
        "bioguide_id": bioguide_id,
        "press_release_url": None,
        "press_release_url_status": "error",
    }

    if not gov_url:
        logger.info("[%s] No government_website - skipping", name)
        result["press_release_url_status"] = "not_found"
        return result

    # Step 1: Find candidate URL
    try:
        html = _fetch_and_clean(gov_url)
    except Exception as e:
        logger.warning("[%s] Failed to fetch %s: %s", name, gov_url, e)
        return result

    try:
        candidate_url = _call_gpt(
            system_message=(
                "You are analyzing a US federal legislator's government website. "
                "Find the URL for the **press releases** page specifically. "
                "This should be a page that lists official press releases "
                "(not general news, blog posts, or media mentions). "
                "It may be labeled 'Press Releases', 'Press', or 'Statements'. "
                "Return ONLY the absolute URL, nothing else. "
                "If no press releases page exists, return NOT_FOUND."
            ),
            user_message=html,
        )
    except Exception as e:
        logger.warning("[%s] GPT discovery call failed: %s", name, e)
        return result

    if not candidate_url or "NOT_FOUND" in candidate_url.upper():
        logger.info("[%s] No press release URL found", name)
        result["press_release_url_status"] = "not_found"
        return result

    # Clean up — GPT sometimes wraps URL in quotes or markdown
    candidate_url = candidate_url.strip().strip("`").strip('"').strip("'")

    # Step 2: Validate candidate URL
    try:
        candidate_html = _fetch_and_clean(candidate_url)
    except Exception as e:
        logger.warning("[%s] Failed to fetch candidate %s: %s", name, candidate_url, e)
        result["press_release_url"] = candidate_url
        result["press_release_url_status"] = "needs_review"
        return result

    try:
        confirmation = _call_gpt(
            system_message=(
                "You are validating whether a web page from a US federal "
                "legislator's official government website is their press "
                "release listing page. These pages typically contain:\n"
                "- Multiple headline links to individual press releases or "
                "statements\n"
                "- Dates associated with entries\n"
                "- Pagination controls (next/previous, page numbers, or "
                "'See More'/'Load More' buttons)\n"
                "- Headings like 'Press Releases', 'Press', 'Statements', "
                "'News', or 'Newsroom'\n\n"
                "The page MAY also have other content such as biography "
                "sidebars, office contact info, newsletter signups, or "
                "committee details. A page still qualifies as long as it "
                "contains a section listing press releases or official "
                "statements.\n\n"
                "Answer YES if this page lists press releases or official "
                "statements from a legislator, even if the page also "
                "includes other content. Answer NO only if the page is "
                "clearly not a listing of press releases (e.g., a single "
                "article, a biography-only page, a contact page, or a "
                "completely unrelated page). Answer YES or NO."
            ),
            user_message=candidate_html,
        )
    except Exception as e:
        logger.warning("[%s] GPT validation call failed: %s", name, e)
        result["press_release_url"] = candidate_url
        result["press_release_url_status"] = "needs_review"
        return result

    gpt_says_yes = confirmation.strip().upper().startswith("YES")
    url_matches_pattern = _url_matches_press_pattern(candidate_url)

    if gpt_says_yes:
        logger.info("[%s] Confirmed by GPT: %s", name, candidate_url)
        result["press_release_url"] = candidate_url
        result["press_release_url_status"] = "found"
    elif url_matches_pattern:
        logger.info(
            "[%s] GPT said NO (%s) but URL matches press pattern — approving: %s",
            name,
            confirmation,
            candidate_url,
        )
        result["press_release_url"] = candidate_url
        result["press_release_url_status"] = "found"
    else:
        logger.info(
            "[%s] Not confirmed (GPT said: %s): %s", name, confirmation, candidate_url
        )
        result["press_release_url"] = candidate_url
        result["press_release_url_status"] = "needs_review"

    return result


def run():
    """Discover press release URLs for all active national officials.

    Returns a metrics dict: {found, not_found, needs_review, errors}.
    """
    db_url = get_db_url("elite")
    db = dataset.connect(db_url)

    officials = list(
        db.query(
            "SELECT bioguide_id, first_name, last_name, government_website "
            "FROM officials "
            "WHERE active = 1 AND level = 'national'"
        )
    )
    db.close()

    logger.info("Processing %d officials...", len(officials))

    metrics = {"found": 0, "not_found": 0, "needs_review": 0, "errors": 0}
    results = []

    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = {
            executor.submit(_process_official, official): official
            for official in officials
        }

        for future in as_completed(futures):
            official = futures[future]
            try:
                result = future.result()
                results.append(result)
                status = result["press_release_url_status"]
                metrics[status] = metrics.get(status, 0) + 1
            except Exception as e:
                logger.error(
                    "[%s %s] Unexpected error: %s",
                    official["first_name"],
                    official["last_name"],
                    e,
                )
                metrics["errors"] += 1
                results.append(
                    {
                        "bioguide_id": official["bioguide_id"],
                        "press_release_url": None,
                        "press_release_url_status": "error",
                    }
                )

    # Write results to officials table
    logger.info("Writing %d results to officials table...", len(results))
    db = dataset.connect(db_url)
    table = db["officials"]
    for r in results:
        table.update(r, ["bioguide_id"])
    db.close()

    logger.info(
        "Done. Found: %d, Not found: %d, Needs review: %d, Errors: %d",
        metrics["found"],
        metrics["not_found"],
        metrics["needs_review"],
        metrics["errors"],
    )
    return metrics
