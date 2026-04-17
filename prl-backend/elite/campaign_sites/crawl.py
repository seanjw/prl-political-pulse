"""
Crawl campaign and government websites for federal/state officials and challengers.

Uses Playwright for JS rendering and trafilatura for text extraction.
Stores extracted text on S3 and tracks per-page content hashes in the database
for incremental change detection.
"""

import csv
import hashlib
import io
import json
import os
import re
import time
import zipfile
from datetime import date
from urllib.parse import (
    parse_qs,
    urljoin,
    urlparse,
    urlunparse,
    urlencode,
)

import boto3
import dataset
import pymysql
import trafilatura
from playwright.sync_api import sync_playwright

S3_BUCKET = os.environ["S3_INTERNAL_BUCKET"]
S3_PREFIX = "campaign-sites"

# File extensions to skip
SKIP_EXTENSIONS = frozenset(
    {
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".zip",
        ".tar",
        ".gz",
        ".rar",
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".svg",
        ".ico",
        ".webp",
        ".bmp",
        ".mp3",
        ".mp4",
        ".avi",
        ".mov",
        ".wmv",
        ".flv",
        ".webm",
        ".css",
        ".js",
        ".json",
        ".xml",
        ".rss",
        ".atom",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
    }
)

# URL path patterns to skip
SKIP_PATH_PATTERNS = re.compile(
    r"(wp-admin|wp-login|/login|/logout|/signin|/signup|/register"
    r"|/feed|/rss|/atom|/cart|/checkout|/account|/api/"
    r"|/wp-json|/xmlrpc|/trackback|/embed"
    r"|/calendar|/archive/\d{4}/\d{2}"
    r"|/services/files/|/download/)",
    re.IGNORECASE,
)

# Query-string patterns to skip (file downloads on senate.gov etc.)
SKIP_QUERY_PATTERNS = re.compile(
    r"(^|&)(a=Files\.Serve|download=1)(&|$)",
    re.IGNORECASE,
)

# Deep pagination pattern: page 6+ (matches against parsed.query, no leading ?)
DEEP_PAGINATION = re.compile(r"(^|&)page=([6-9]|\d{2,})(&|$)", re.IGNORECASE)

POLITE_DELAY = 0.25  # seconds between page loads
MAX_PAGES_PER_SITE = 500  # hard cap to avoid runaway crawls on large archives


def normalize_url(url):
    """Normalize a URL for deduplication.

    Removes fragments, utm_* params, sorts remaining params,
    lowercases the host, and strips trailing slash (except root).
    """
    parsed = urlparse(url)
    host = parsed.hostname or ""
    host = host.lower()
    port = f":{parsed.port}" if parsed.port and parsed.port not in (80, 443) else ""

    # Remove utm_* params and sort the rest
    params = parse_qs(parsed.query, keep_blank_values=True)
    filtered = sorted((k, v) for k, v in params.items() if not k.startswith("utm_"))
    sorted_query = urlencode(filtered, doseq=True) if filtered else ""

    # Normalize path: empty -> "/", strip trailing slash except root
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    return urlunparse(
        (
            parsed.scheme,
            host + port,
            path,
            "",  # params
            sorted_query,
            "",  # fragment
        )
    )


def is_crawlable_url(url, base_domain):
    """Check if a URL should be crawled based on domain, extension, and path rules."""
    try:
        parsed = urlparse(url)
    except Exception:
        return False

    if parsed.scheme not in ("http", "https"):
        return False

    # Must be same domain (strip www. for comparison)
    url_domain = (parsed.hostname or "").lower()
    if not url_domain:
        return False
    url_root = url_domain.removeprefix("www.")
    base_root = base_domain.removeprefix("www.")
    if url_root != base_root and not url_root.endswith("." + base_root):
        return False

    path_lower = parsed.path.lower()

    # Check file extensions
    for ext in SKIP_EXTENSIONS:
        if path_lower.endswith(ext):
            return False

    # Check path patterns
    if SKIP_PATH_PATTERNS.search(parsed.path):
        return False

    # Check deep pagination
    if DEEP_PAGINATION.search(parsed.query):
        return False

    # Check file download query patterns
    if SKIP_QUERY_PATTERNS.search(parsed.query):
        return False

    return True


def clean_site_url(url):
    """Clean and normalize a site URL from the database."""
    if not url:
        return None
    url = url.strip()
    if not url:
        return None
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    # Remove trailing slash for consistency
    return url.rstrip("/")


def discover_sites(db_url, scope="weekly"):
    """Discover sites to crawl based on scope.

    Args:
        db_url: Database connection URL for the elite database.
        scope: "weekly" (federal + challengers), "state", or "all".

    Returns:
        List of dicts with keys: source_type, source_id, name, site_url
    """
    dbx = dataset.connect(db_url + "?charset=utf8mb4")
    sites = []
    seen_urls = set()

    def add_site(source_type, source_id, name, url):
        url = clean_site_url(url)
        if not url:
            return
        norm = normalize_url(url)
        if norm in seen_urls:
            return
        seen_urls.add(norm)
        sites.append(
            {
                "source_type": source_type,
                "source_id": source_id,
                "name": name,
                "site_url": url,
            }
        )

    if scope in ("weekly", "all"):
        # Federal officials
        officials = list(dbx["officials"].find(active=True, level="national"))
        for o in officials:
            bio_id = o.get("bioguide_id") or str(o.get("id", ""))
            name = (
                o.get("name")
                or f"{o.get('first_name', '')} {o.get('last_name', '')}".strip()
            )
            add_site("official_federal_gov", bio_id, name, o.get("government_website"))
            add_site(
                "official_federal_campaign", bio_id, name, o.get("campaign_website")
            )

        # Challengers
        challengers = list(dbx["challengers"].find(active=True))
        for c in challengers:
            cid = c.get("candidate_id") or str(c.get("id", ""))
            add_site("challenger", cid, c.get("name", ""), c.get("campaign_website"))

    if scope in ("state", "all"):
        # State officials
        state_officials = list(dbx["officials"].find(active=True, level="state"))
        for o in state_officials:
            sid = o.get("openstates_id") or str(o.get("id", ""))
            name = (
                o.get("name")
                or f"{o.get('first_name', '')} {o.get('last_name', '')}".strip()
            )
            add_site("official_state_gov", sid, name, o.get("government_website"))
            add_site("official_state_campaign", sid, name, o.get("campaign_website"))

    dbx.engine.dispose()
    dbx.close()

    print(f"Discovered {len(sites)} sites for scope={scope}")
    return sites


_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _extract_page(page, url):
    """Load a URL and extract text+links. Returns (page_data, links) or (None, [])."""
    response = page.goto(url, wait_until="networkidle", timeout=30000)
    if response is None or response.status >= 400:
        return None, []

    page.wait_for_timeout(1500)

    html = page.content()
    title = page.title() or ""

    links = page.eval_on_selector_all(
        "a[href]",
        "els => els.map(e => e.href)",
    )

    text = trafilatura.extract(html, include_comments=False, include_tables=False)
    page_data = None
    if text and text.strip():
        content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        page_data = {
            "url": url,
            "title": title[:500],
            "text": text,
            "hash": content_hash,
            "html": html,
        }

    return page_data, links


def _pymysql_connect(db_url):
    """Create a raw pymysql connection from a SQLAlchemy-style URL.

    Thread-safe: each call creates an independent connection with no
    shared engine or greenlet state.
    """
    from urllib.parse import unquote

    parsed = urlparse(db_url)
    return pymysql.connect(
        host=parsed.hostname,
        port=parsed.port or 3306,
        user=unquote(parsed.username) if parsed.username else None,
        password=unquote(parsed.password) if parsed.password else None,
        database=parsed.path.lstrip("/"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def get_previous_hashes(db_url, source_type, source_id):
    """Get page content hashes from the most recent crawl for change detection.

    Returns:
        Dict mapping page_url -> content_hash from the last crawl.
    """
    conn = _pymysql_connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ph.page_url, ph.content_hash
                FROM campaign_site_page_hashes ph
                JOIN campaign_site_crawls c ON c.id = ph.crawl_id
                WHERE c.id = (
                    SELECT id FROM campaign_site_crawls
                    WHERE source_type = %s
                      AND source_id = %s
                      AND status IN ('success', 'partial')
                    ORDER BY crawl_date DESC
                    LIMIT 1
                )
                """,
                (source_type, source_id),
            )
            return {row["page_url"]: row["content_hash"] for row in cur.fetchall()}
    finally:
        conn.close()


def _create_crawl_row(db_url, site_info, crawl_date):
    """Insert an in-progress crawl row and return (conn, crawl_id).

    The caller is responsible for updating and closing the connection.
    """
    conn = _pymysql_connect(db_url)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO campaign_site_crawls
                (source_type, source_id, name, site_url, crawl_date,
                 status, pages_crawled, pages_changed, pages_new,
                 duration_seconds)
            VALUES (%s, %s, %s, %s, %s, 'in_progress', 0, 0, 0, 0)
            """,
            (
                site_info["source_type"],
                site_info["source_id"],
                site_info["name"],
                site_info["site_url"],
                crawl_date,
            ),
        )
        crawl_id = cur.lastrowid
    conn.commit()
    return conn, crawl_id


def _insert_page_hash(conn, crawl_id, page_data, prev_hashes):
    """Insert a single page hash row and return (is_new, is_changed)."""
    prev_hash = prev_hashes.get(page_data["url"])
    is_new = prev_hash is None
    is_changed = not is_new and prev_hash != page_data["hash"]

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO campaign_site_page_hashes
                (crawl_id, page_url, content_hash, title, word_count)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                crawl_id,
                page_data["url"],
                page_data["hash"],
                page_data["title"][:500] if page_data.get("title") else None,
                len(page_data["text"].split()) if page_data.get("text") else 0,
            ),
        )
    conn.commit()
    return is_new, is_changed


def _finalize_crawl(
    conn,
    crawl_id,
    status,
    pages,
    s3_keys,
    duration,
    pages_new,
    pages_changed,
    error_msg=None,
):
    """Update the crawl row with final status and S3 keys."""
    site_hash = None
    if pages:
        sorted_hashes = sorted(p["hash"] for p in pages)
        site_hash = hashlib.sha256("".join(sorted_hashes).encode()).hexdigest()

    json_key, zip_key = s3_keys or (None, None)

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE campaign_site_crawls
            SET status = %s, error_message = %s, pages_crawled = %s,
                pages_changed = %s, pages_new = %s, site_content_hash = %s,
                s3_json_key = %s, s3_html_zip_key = %s, duration_seconds = %s
            WHERE id = %s
            """,
            (
                status,
                error_msg,
                len(pages),
                pages_changed,
                pages_new,
                site_hash,
                json_key,
                zip_key,
                round(duration, 2),
                crawl_id,
            ),
        )
    conn.commit()


def save_to_s3(s3_client, site_info, pages, crawl_date):
    """Save crawled content to S3 as JSON and HTML zip.

    Args:
        s3_client: boto3 S3 client.
        site_info: Dict with source_type, source_id, name, site_url.
        pages: List of page dicts from crawl_site().
        crawl_date: Date string (YYYY-MM-DD).

    Returns:
        Tuple of (json_s3_key, zip_s3_key).
    """
    prefix = f"{S3_PREFIX}/{site_info['source_type']}/{site_info['source_id']}"
    date_str = str(crawl_date)

    # JSON output (text only, no HTML)
    json_data = {
        "url": site_info["site_url"],
        "crawl_date": date_str,
        "source_type": site_info["source_type"],
        "source_id": site_info["source_id"],
        "name": site_info["name"],
        "pages": [
            {
                "url": p["url"],
                "title": p["title"],
                "text": p["text"],
                "hash": p["hash"],
            }
            for p in pages
        ],
    }

    json_key = f"{prefix}/{date_str}.json"
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=json_key,
        Body=json.dumps(json_data, ensure_ascii=False).encode("utf-8"),
        ContentType="application/json",
    )

    # HTML zip
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in pages:
            # Use URL hash as filename to avoid path issues
            fname = hashlib.md5(p["url"].encode()).hexdigest() + ".html"
            zf.writestr(fname, p["html"])

    zip_key = f"{prefix}/{date_str}.html.zip"
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=zip_key,
        Body=zip_buffer.getvalue(),
        ContentType="application/zip",
    )

    return json_key, zip_key


def save_to_db(
    db_url,
    site_info,
    pages,
    crawl_date,
    s3_keys,
    status,
    duration,
    prev_hashes,
    error_msg=None,
):
    """Save crawl results and page hashes to the database.

    Args:
        db_url: Database connection URL.
        site_info: Dict with source_type, source_id, name, site_url.
        pages: List of page dicts from crawl_site().
        crawl_date: Date object.
        s3_keys: Tuple of (json_key, zip_key) or (None, None).
        status: Crawl status string.
        duration: Duration in seconds.
        prev_hashes: Dict of previous page_url -> content_hash.
        error_msg: Optional error message.
    """
    pages_changed = 0
    pages_new = 0
    for p in pages:
        prev_hash = prev_hashes.get(p["url"])
        if prev_hash is None:
            pages_new += 1
        elif prev_hash != p["hash"]:
            pages_changed += 1

    # Compute site-level content hash from sorted page hashes
    site_hash = None
    if pages:
        sorted_hashes = sorted(p["hash"] for p in pages)
        site_hash = hashlib.sha256("".join(sorted_hashes).encode()).hexdigest()

    json_key, zip_key = s3_keys

    conn = _pymysql_connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO campaign_site_crawls
                    (source_type, source_id, name, site_url, crawl_date,
                     status, error_message, pages_crawled, pages_changed,
                     pages_new, site_content_hash, s3_json_key,
                     s3_html_zip_key, duration_seconds)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    site_info["source_type"],
                    site_info["source_id"],
                    site_info["name"],
                    site_info["site_url"],
                    crawl_date,
                    status,
                    error_msg,
                    len(pages),
                    pages_changed,
                    pages_new,
                    site_hash,
                    json_key,
                    zip_key,
                    round(duration, 2),
                ),
            )
            crawl_id = cur.lastrowid

            if pages:
                cur.executemany(
                    """
                    INSERT INTO campaign_site_page_hashes
                        (crawl_id, page_url, content_hash, title, word_count)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    [
                        (
                            crawl_id,
                            p["url"],
                            p["hash"],
                            p["title"][:500] if p.get("title") else None,
                            len(p["text"].split()) if p.get("text") else 0,
                        )
                        for p in pages
                    ],
                )
        conn.commit()
    finally:
        conn.close()

    return {
        "pages_crawled": len(pages),
        "pages_changed": pages_changed,
        "pages_new": pages_new,
    }


def _crawl_one_site(site, db_url, s3_client, crawl_date, idx, total):
    """Crawl a single site: BFS pages, streaming each to DB as extracted.

    Each call creates its own Playwright browser instance because
    Playwright's sync API uses greenlets with thread affinity.

    Returns a dict with keys: status ("success"/"failure"), pages_crawled,
    pages_changed, pages_new.
    """
    from collections import deque

    print(
        f"\n[{idx}/{total}] Crawling {site['name']} "
        f"({site['source_type']}): {site['site_url']}"
    )
    start_time = time.monotonic()
    conn = None

    try:
        prev_hashes = get_previous_hashes(
            db_url, site["source_type"], site["source_id"]
        )
        conn, crawl_id = _create_crawl_row(db_url, site, crawl_date)

        parsed = urlparse(site["site_url"])
        base_domain = (parsed.hostname or "").lower()
        if not base_domain:
            raise ValueError(f"Invalid site URL: {site['site_url']}")

        start_url = normalize_url(site["site_url"])
        visited = {start_url}
        url_queue = deque()
        pages_data = []
        pages_new = 0
        pages_changed = 0

        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            )
            context = browser.new_context(
                user_agent=_USER_AGENT,
                viewport={"width": 1280, "height": 720},
                java_script_enabled=True,
            )
            page = context.new_page()
            try:
                # First page — detect redirects
                page_data, links = _extract_page(page, start_url)

                final_url = page.url
                final_domain = (urlparse(final_url).hostname or "").lower()
                if final_domain and final_domain != base_domain:
                    print(f"  Redirect detected: {base_domain} -> {final_domain}")
                    base_domain = final_domain
                    start_url = normalize_url(final_url)
                    visited.add(start_url)

                if page_data:
                    pages_data.append(page_data)
                    is_new, is_changed = _insert_page_hash(
                        conn, crawl_id, page_data, prev_hashes
                    )
                    pages_new += is_new
                    pages_changed += is_changed

                for link in links:
                    if link:
                        normalized = normalize_url(urljoin(start_url, link))
                        if normalized not in visited and is_crawlable_url(
                            normalized, base_domain
                        ):
                            visited.add(normalized)
                            url_queue.append(normalized)

                # BFS remaining pages
                page_num = 1
                hit_page_limit = False
                while url_queue:
                    if page_num >= MAX_PAGES_PER_SITE:
                        hit_page_limit = True
                        print(
                            f"  [{base_domain}] Hit MAX_PAGES_PER_SITE={MAX_PAGES_PER_SITE}, stopping BFS"
                        )
                        break
                    url = url_queue.popleft()
                    page_num += 1
                    if page_num % 25 == 0:
                        print(
                            f"  [{base_domain}] Page {page_num}, "
                            f"{len(pages_data)} extracted, "
                            f"{len(url_queue)} queued"
                        )
                    try:
                        page_data, links = _extract_page(page, url)

                        if page_data:
                            pages_data.append(page_data)
                            is_new, is_changed = _insert_page_hash(
                                conn, crawl_id, page_data, prev_hashes
                            )
                            pages_new += is_new
                            pages_changed += is_changed

                        for link in links:
                            if link:
                                normalized = normalize_url(urljoin(url, link))
                                if normalized not in visited and is_crawlable_url(
                                    normalized, base_domain
                                ):
                                    visited.add(normalized)
                                    url_queue.append(normalized)
                    except Exception as e:
                        print(f"  Error crawling {url}: {e}")

                    time.sleep(POLITE_DELAY)

            finally:
                page.close()
                context.close()
                browser.close()

        duration = time.monotonic() - start_time

        if not pages_data:
            _finalize_crawl(
                conn,
                crawl_id,
                "failure",
                [],
                None,
                duration,
                0,
                0,
                error_msg="No content extracted from site",
            )
            print("  No content extracted, marking as failure")
            return {
                "status": "failure",
                "pages_crawled": 0,
                "pages_changed": 0,
                "pages_new": 0,
                "error": "No content extracted from site",
            }

        crawl_status = "partial" if hit_page_limit else "success"
        s3_keys = save_to_s3(s3_client, site, pages_data, crawl_date)
        _finalize_crawl(
            conn,
            crawl_id,
            crawl_status,
            pages_data,
            s3_keys,
            duration,
            pages_new,
            pages_changed,
        )

        print(
            f"  Done ({crawl_status}): {len(pages_data)} pages, "
            f"{pages_new} new, {pages_changed} changed "
            f"({duration:.1f}s)"
        )
        return {
            "status": crawl_status,
            "error": None,
            "pages_crawled": len(pages_data),
            "pages_changed": pages_changed,
            "pages_new": pages_new,
        }

    except Exception as e:
        duration = time.monotonic() - start_time
        print(f"  Site failed: {e}")
        if conn and crawl_id:
            try:
                _finalize_crawl(
                    conn,
                    crawl_id,
                    "failure",
                    [],
                    None,
                    duration,
                    0,
                    0,
                    error_msg=str(e)[:1000],
                )
            except Exception as db_err:
                print(f"  Failed to save error to DB: {db_err}")
        return {
            "status": "failure",
            "pages_crawled": 0,
            "pages_changed": 0,
            "pages_new": 0,
            "error": str(e)[:500],
        }
    finally:
        if conn:
            conn.close()


def run_crawl(scope="weekly", max_workers=8):
    """Main orchestrator: discover sites, crawl in parallel, save results.

    Args:
        scope: "weekly" (federal + challengers), "state", or "all".
        max_workers: Number of concurrent browser contexts for parallel crawling.

    Returns:
        Dict with sites_crawled, sites_failed, sites_skipped,
        total_pages, total_changed.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    from shared.config import get_db_url

    db_url = get_db_url("elite", dialect="mysql+pymysql")
    sites = discover_sites(db_url, scope=scope)

    if not sites:
        print("No sites to crawl")
        return {
            "sites_crawled": 0,
            "sites_failed": 0,
            "sites_skipped": 0,
            "total_pages": 0,
            "total_changed": 0,
        }

    s3_client = boto3.client("s3")
    crawl_date = date.today()
    crawl_start = time.monotonic()

    stats = {
        "sites_crawled": 0,
        "sites_failed": 0,
        "sites_skipped": 0,
        "total_pages": 0,
        "total_changed": 0,
    }
    problem_sites = []

    total = len(sites)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(
                _crawl_one_site,
                site,
                db_url,
                s3_client,
                crawl_date,
                i + 1,
                total,
            ): site
            for i, site in enumerate(sites)
        }

        for future in as_completed(futures):
            site = futures[future]
            result = future.result()
            if result["status"] in ("success", "partial"):
                stats["sites_crawled"] += 1
                if result["pages_crawled"] <= 1:
                    problem_sites.append(
                        {
                            "source_type": site["source_type"],
                            "source_id": site["source_id"],
                            "name": site["name"],
                            "site_url": site["site_url"],
                            "issue": "single_page",
                            "pages_crawled": result["pages_crawled"],
                            "error": "",
                        }
                    )
            else:
                stats["sites_failed"] += 1
                problem_sites.append(
                    {
                        "source_type": site["source_type"],
                        "source_id": site["source_id"],
                        "name": site["name"],
                        "site_url": site["site_url"],
                        "issue": "dead",
                        "pages_crawled": 0,
                        "error": result.get("error", ""),
                    }
                )
            stats["total_pages"] += result["pages_crawled"]
            stats["total_changed"] += result["pages_changed"] + result["pages_new"]

            done = stats["sites_crawled"] + stats["sites_failed"]
            if done % 25 == 0 or done == total:
                elapsed = time.monotonic() - crawl_start
                rate = done / elapsed * 3600 if elapsed > 0 else 0
                print(
                    f"\n=== Progress: {done}/{total} sites "
                    f"({stats['sites_crawled']} ok, {stats['sites_failed']} failed), "
                    f"{stats['total_pages']} pages, "
                    f"{rate:.0f} sites/hr ==="
                )

    # Upload problem sites CSV to S3
    if problem_sites:
        _upload_problem_sites_csv(s3_client, problem_sites, crawl_date, scope)

    stats["problem_sites"] = len(problem_sites)
    stats["problem_sites_data"] = problem_sites
    print(
        f"\nCrawl complete: {stats['sites_crawled']} succeeded, "
        f"{stats['sites_failed']} failed, "
        f"{len(problem_sites)} problem sites, "
        f"{stats['total_pages']} total pages, "
        f"{stats['total_changed']} changed"
    )
    return stats


def _upload_problem_sites_csv(s3_client, problem_sites, crawl_date, scope):
    """Write problem sites (dead or single-page) to a CSV on S3."""
    fieldnames = [
        "source_type",
        "source_id",
        "name",
        "site_url",
        "issue",
        "pages_crawled",
        "error",
    ]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(sorted(problem_sites, key=lambda r: (r["issue"], r["name"])))

    key = f"{S3_PREFIX}/reports/problem-sites-{scope}-{crawl_date}.csv"
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=buf.getvalue().encode("utf-8"),
        ContentType="text/csv",
    )
    print(f"Problem sites CSV uploaded to s3://{S3_BUCKET}/{key}")
