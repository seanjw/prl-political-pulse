import concurrent.futures
import logging
import time
from functools import wraps
from urllib.parse import urljoin, urlparse

import dataset
import json5
import openai
import pandas as pd
import requests
from bs4 import BeautifulSoup
from lxml import etree
from playwright.sync_api import sync_playwright

logger = logging.getLogger(__name__)


def extract_visible_html(html):
    """Remove scripts, styles, and hidden elements from HTML."""
    soup = BeautifulSoup(html, "html.parser")

    for element in soup(["script", "style", "meta", "link", "head", "noscript"]):
        element.extract()

    for element in soup.find_all(style=True):
        style = element["style"].lower()
        if "display: none" in style or "visibility: hidden" in style:
            element.extract()

    for element in soup.find_all(attrs={"aria-hidden": "true"}):
        element.extract()

    return str(soup)


def retry_on_failure(max_attempts=3):
    """Decorator that retries a function if it fails or returns None."""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    result = func(*args, **kwargs)
                    if result is not None:
                        return result
                except Exception as e:
                    logger.warning(
                        "Attempt %d failed for %s: %s", attempt + 1, func.__name__, e
                    )
            logger.error("All %d attempts failed for %s", max_attempts, func.__name__)
            return None

        return wrapper

    return decorator


def make_url_absolute(base_url, url):
    """Convert a relative URL to an absolute URL using the given base URL."""
    parsed_url = urlparse(url)
    if parsed_url.scheme:
        return url
    return urljoin(base_url, url)


def check_if_url_valid(url, timeout=10):
    """Check if a URL is valid by making an HTTP request."""
    try:
        response = requests.get(url, timeout=timeout)
        return response.status_code < 400
    except requests.exceptions.RequestException:
        return False


def is_valid_xpath(xpath):
    try:
        etree.XPath(xpath)
        return True
    except etree.XPathSyntaxError:
        return False


def update(data, on_column, table, db_uri):
    dbx = dataset.connect(db_uri)
    dbx[table].update(data, on_column)
    dbx.close()


@retry_on_failure(max_attempts=3)
def get_press_release_url(official):
    """Fetch the official's government homepage and ask GPT-5.4 for the press release URL."""
    resp = requests.get(
        official.government_website,
        timeout=15,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    resp.raise_for_status()
    html = extract_visible_html(resp.text)

    with openai.OpenAI() as client:
        response = client.chat.completions.create(
            model="gpt-5.4",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are analyzing a US federal legislator's government website. "
                        "Find the URL for the press releases page. It may be labeled "
                        "'Press Releases', 'Press', or 'Statements'. "
                        "Return ONLY the absolute URL, nothing else. "
                        "If no press releases page exists, return NOT_FOUND."
                    ),
                },
                {"role": "user", "content": html[:80000]},
            ],
        )
        press_release_url = response.choices[0].message.content.strip()

    if "NOT_FOUND" in press_release_url.upper():
        return None

    press_release_url = press_release_url.strip("`").strip('"').strip("'")

    if check_if_url_valid(press_release_url):
        return press_release_url


def _ask_gpt_for_next_page_selector(
    source_html, failed_selector=None, failure_reason=None
):
    """Ask GPT-5.4 to find the next-page button xpath from cleaned HTML."""
    cleaned = extract_visible_html(source_html)

    system_prompt = (
        "You are extracting data from a web page that contains a "
        "paginated list of items. The page includes a navigation "
        "element that allows the user to load more results, or move "
        "on to the next page. Your task is to find the navigation "
        "button to go to the next page. Return ONLY an xpath selector that "
        "will allow a web scraper to locate that button."
    )

    messages = [{"role": "system", "content": system_prompt}]

    if failed_selector and failure_reason:
        messages.append({"role": "user", "content": cleaned[:80000]})
        messages.append({"role": "assistant", "content": failed_selector})
        messages.append(
            {
                "role": "user",
                "content": (
                    f"That selector did not work. {failure_reason} "
                    "Please analyze the HTML again and return a different xpath "
                    "selector. The page may use JavaScript-based pagination "
                    "(AJAX/fetch) triggered by a link, button, or click handler. "
                    "Look for onclick handlers, data attributes, or anchor tags "
                    "with href='#' that trigger pagination. Return ONLY the xpath."
                ),
            }
        )
    else:
        messages.append({"role": "user", "content": cleaned[:80000]})

    with openai.OpenAI() as client:
        response = client.chat.completions.create(
            model="gpt-5.4",
            messages=messages,
        )
        return response.choices[0].message.content.strip()


@retry_on_failure(max_attempts=3)
def get_next_page_selector(official, source, failed_selector=None, failure_reason=None):
    # Use a separate thread to avoid Playwright event loop conflict
    with concurrent.futures.ThreadPoolExecutor() as executor:
        future = executor.submit(
            _ask_gpt_for_next_page_selector,
            source,
            failed_selector,
            failure_reason,
        )
        next_page_selector = future.result()

    if is_valid_xpath(next_page_selector) and next_page_selector != "NA":
        return next_page_selector
    else:
        logger.warning("Invalid XPath syntax returned: %s", next_page_selector)
        return None


@retry_on_failure(max_attempts=3)
def get_all_press_releases_on_page(official, source):
    """Extract press release URLs, dates, and headlines from page HTML using GPT-5.4.

    Returns DataFrame with columns: url, date, headline, bioguide_id, party
    or None on failure.
    """
    cleaned = extract_visible_html(source)
    with openai.OpenAI() as client:
        response = client.chat.completions.create(
            model="gpt-5.4",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are looking at the press release page of a federal US "
                        "legislator in Congress. It contains a list of press releases, "
                        "which will have a title, date, and sometimes a small snippet. "
                        "Return the headline, date, and url for all of the press releases "
                        "shown on the page. Format as a JSON list: "
                        '[{"url": "...", "date": "...", "headline": "..."}, ...]. '
                        "The date should be formatted as YYYY-MM-DD. "
                        "If you are unable to find the date, use null. "
                        "If you are unable to find the headline, use null."
                    ),
                },
                {"role": "user", "content": cleaned[:80000]},
            ],
        )
        urls = response.choices[0].message.content.strip()

    if isinstance(urls, str):
        urls = json5.loads(urls)

    urls = pd.DataFrame(urls)
    urls["date"] = pd.to_datetime(urls["date"], errors="coerce").dt.date
    urls["bioguide_id"] = official.bioguide_id
    urls["party"] = official.party

    if "headline" not in urls.columns:
        urls["headline"] = None

    urls["url"] = urls["url"].apply(
        lambda url: make_url_absolute(official.press_release_url, url)
    )

    return urls


def ingest_new_urls_from_press_page(official, db_uri):
    """Crawl an official's press release page and paginate to collect all new URLs.

    Returns (urls_df, error, error_text) tuple.
    """
    logger.info(
        "Starting scrape for %s %s | %s | %s | press: %s",
        official.first_name,
        official.last_name,
        official.bioguide_id,
        official.government_website,
        official.press_release_url,
    )

    urls = None
    error = 0
    error_text = None

    update_press_release_url = False
    update_next_page_selector = False

    # Get last date with data
    dbx = dataset.connect(db_uri)
    result = list(
        dbx.query(
            "SELECT MAX(date) AS max_date FROM statements WHERE bioguide_id = :bid",
            bid=official.bioguide_id,
        )
    )
    dbx.close()
    max_date = result[0]["max_date"] if result and result[0]["max_date"] else None
    logger.info("Max date from existing data: %s", max_date)

    # Check if they have a press release url
    if official.press_release_url is None:
        logger.info("No press release URL; asking LLM to find it...")
        press_release_url = get_press_release_url(official)
        if press_release_url:
            logger.info("Press release URL found; updating database")
            official.press_release_url = press_release_url
            update_press_release_url = True
        else:
            error = 1
            error_text = "UNABLE TO FIND PRESS RELEASE URL"
            logger.error("%s", error_text)

    # Collect urls page by page
    if official.press_release_url:
        logger.info(
            "Collecting URLs from press release page %s", official.press_release_url
        )

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            page.goto(official.press_release_url)
            page.wait_for_load_state("networkidle")

            page_content = page.content()

            # Collect the first page
            logger.info("Collecting first page of press releases")
            urls = get_all_press_releases_on_page(official, source=page_content)

            if urls is not None and not urls.empty:
                if update_press_release_url:
                    update(
                        official[["press_release_url", "bioguide_id"]],
                        "bioguide_id",
                        "statements_scrape_params",
                        db_uri,
                    )
                urls = urls.sort_values(by=["date", "url"], ascending=[True, True])
            else:
                error = 1
                error_text = "NO URLS FOUND ON PRESS RELEASE PAGE"
                logger.error("%s", error_text)
                return urls, error, error_text

            logger.info(
                "First page: %d URLs from %s to %s",
                urls.shape[0],
                urls["date"].dropna().min(),
                urls["date"].max(),
            )

            # Begin pagination
            logger.info("Starting pagination loop")
            gpt_selector_retries = 0
            MAX_GPT_SELECTOR_RETRIES = 3
            for i in range(30):  # cap pagination at 30 pages max
                logger.debug("Iteration %d | Current page: %s", i, page.url)

                # Check if we've gone far enough back
                if not pd.notna(max_date):
                    logger.warning("max_date is NaT; ending pagination")
                    break
                elif urls["date"].dropna().min() < max_date:
                    logger.info(
                        "Finished: min date (%s) < max date (%s)",
                        urls["date"].dropna().min(),
                        max_date,
                    )
                    break
                else:
                    logger.info(
                        "Continuing: min date (%s) >= max date (%s)",
                        urls["date"].dropna().min(),
                        max_date,
                    )

                    # Check if next page selector exists
                    if official.next_page_selector is None:
                        logger.info("No next page selector; asking LLM to find it...")
                        next_page_selector = get_next_page_selector(
                            official,
                            source=page_content.encode("utf-8", errors="ignore").decode(
                                "utf-8"
                            ),
                        )
                        if next_page_selector:
                            logger.info("Page selector found: %s", next_page_selector)
                            official["next_page_selector"] = next_page_selector
                            update_next_page_selector = True
                        else:
                            error = 1
                            error_text = "NO NEXT PAGE SELECTOR FOUND"
                            logger.error("%s", error_text)
                            break

                    # Click to the next page
                    logger.info("Attempting to click to the next page")
                    if official.next_page_selector:
                        selector = official.next_page_selector
                        if selector.startswith("//") or selector.startswith("/"):
                            selector = f"xpath={selector}"
                        next_button = page.locator(selector)
                        if next_button.count() == 0:
                            for frame in page.frames:
                                element = frame.locator(selector)
                                if element.count() > 0:
                                    next_button = element

                        pagination_succeeded = False
                        failure_reason = None

                        if next_button.count() == 0:
                            failure_reason = (
                                f"Selector '{official.next_page_selector}' "
                                "matched 0 elements on the page."
                            )
                        elif next_button.count() > 10:
                            failure_reason = (
                                f"Selector '{official.next_page_selector}' "
                                f"matched {next_button.count()} elements (too many)."
                            )
                        else:
                            # Try data-href navigation first (for AJAX-paginated sites)
                            data_href = None
                            for bi in range(next_button.count()):
                                try:
                                    href = next_button.nth(bi).get_attribute(
                                        "data-href"
                                    )
                                    if href:
                                        href_lower = href.lower()
                                        if any(
                                            kw in href_lower
                                            for kw in [
                                                "press",
                                                "statement",
                                                "news",
                                                "release",
                                                "resultset",
                                            ]
                                        ):
                                            data_href = href
                                            logger.info(
                                                "Found press-related data-href on button %d: %s",
                                                bi,
                                                href,
                                            )
                                            break
                                except Exception:
                                    pass

                            if data_href:
                                nav_url = make_url_absolute(
                                    official.press_release_url, data_href
                                )
                                logger.info("Navigating to data-href: %s", nav_url)
                                page.goto(nav_url)
                            else:
                                logger.info(
                                    "No press-related data-href; attempting click..."
                                )
                                for btn_idx in range(next_button.count()):
                                    button = next_button.nth(btn_idx)
                                    try:
                                        button.scroll_into_view_if_needed()
                                        button.focus()
                                        button.hover()
                                        button.click()
                                        logger.info("Button click dispatched")
                                        break
                                    except Exception:
                                        logger.debug(
                                            "Failed click on button %d", btn_idx
                                        )

                            page.wait_for_load_state("networkidle")
                            time.sleep(3)

                            page_content = page.content()
                            new_urls = get_all_press_releases_on_page(
                                official, source=page_content
                            )

                            if new_urls is not None and not new_urls.empty:
                                new_urls = new_urls.sort_values(
                                    by=["date", "url"], ascending=[True, True]
                                )

                                if new_urls["url"].iloc[0] == urls["url"].iloc[0]:
                                    failure_reason = (
                                        f"Clicking '{official.next_page_selector}' "
                                        "did not change the page content."
                                    )
                                else:
                                    pagination_succeeded = True
                                    logger.info("New URLs found; pagination succeeded")
                                    if update_next_page_selector:
                                        update(
                                            official[
                                                ["next_page_selector", "bioguide_id"]
                                            ],
                                            "bioguide_id",
                                            "statements_scrape_params",
                                            db_uri,
                                        )
                            else:
                                failure_reason = (
                                    f"Clicking '{official.next_page_selector}' "
                                    "resulted in no URLs found."
                                )

                        # If pagination failed, retry with GPT
                        if not pagination_succeeded and failure_reason:
                            logger.warning("Pagination failed: %s", failure_reason)
                            gpt_selector_retries += 1
                            if gpt_selector_retries > MAX_GPT_SELECTOR_RETRIES:
                                error = 1
                                error_text = (
                                    f"PAGINATION FAILED AFTER {MAX_GPT_SELECTOR_RETRIES} "
                                    f"GPT SELECTOR RETRIES: {failure_reason}"
                                )
                                logger.error("%s", error_text)
                                break
                            logger.info(
                                "Asking GPT for new selector (attempt %d/%d)...",
                                gpt_selector_retries,
                                MAX_GPT_SELECTOR_RETRIES,
                            )
                            new_selector = get_next_page_selector(
                                official,
                                source=page_content.encode(
                                    "utf-8", errors="ignore"
                                ).decode("utf-8"),
                                failed_selector=official.next_page_selector,
                                failure_reason=failure_reason,
                            )
                            if (
                                new_selector
                                and new_selector != official.next_page_selector
                            ):
                                logger.info(
                                    "GPT suggested new selector: %s", new_selector
                                )
                                official["next_page_selector"] = new_selector
                                update_next_page_selector = True
                                continue
                            else:
                                error = 1
                                error_text = (
                                    f"PAGINATION FAILED AND GPT RETRY DID NOT HELP: "
                                    f"{failure_reason}"
                                )
                                logger.error("%s", error_text)
                                break

                        urls = (
                            pd.concat([urls, new_urls])
                            .drop_duplicates(subset=["url"])
                            .reset_index(drop=True)
                            .sort_values(by=["date", "url"], ascending=[True, True])
                        )
                        urls["date"] = pd.to_datetime(
                            urls["date"], errors="coerce"
                        ).dt.date
                        logger.info(
                            "URLs range: %s to %s",
                            urls["date"].dropna().min(),
                            urls["date"].dropna().max(),
                        )

            logger.info("Pagination loop finished; closing browser")
            browser.close()

    return urls, error, error_text
