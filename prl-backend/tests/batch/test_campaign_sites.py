"""Tests for elite.campaign_sites.crawl module."""

import hashlib
import io
import json
import zipfile
from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from elite.campaign_sites.crawl import (
    _crawl_one_site,
    clean_site_url,
    discover_sites,
    is_crawlable_url,
    normalize_url,
    save_to_db,
    save_to_s3,
)


# ---------------------------------------------------------------------------
# normalize_url
# ---------------------------------------------------------------------------


class TestNormalizeUrl:
    def test_strips_fragment(self):
        assert (
            normalize_url("https://example.com/page#section")
            == "https://example.com/page"
        )

    def test_strips_utm_params(self):
        result = normalize_url("https://example.com/page?utm_source=twitter&id=5")
        assert "utm_source" not in result
        assert "id=5" in result

    def test_lowercases_host(self):
        assert normalize_url("https://EXAMPLE.COM/Page") == "https://example.com/Page"

    def test_strips_trailing_slash(self):
        assert (
            normalize_url("https://example.com/about/") == "https://example.com/about"
        )

    def test_preserves_root_slash(self):
        result = normalize_url("https://example.com/")
        assert result.endswith("/")

    def test_removes_default_port(self):
        result = normalize_url("https://example.com:443/page")
        assert ":443" not in result

    def test_preserves_non_default_port(self):
        result = normalize_url("https://example.com:8080/page")
        assert ":8080" in result

    def test_sorts_query_params(self):
        url1 = normalize_url("https://example.com?b=2&a=1")
        url2 = normalize_url("https://example.com?a=1&b=2")
        assert url1 == url2

    def test_identical_urls_normalize_same(self):
        a = normalize_url("https://Example.COM/about/#team?utm_source=fb")
        b = normalize_url("https://example.com/about#team?utm_source=tw")
        assert a == b


# ---------------------------------------------------------------------------
# is_crawlable_url
# ---------------------------------------------------------------------------


class TestIsCrawlableUrl:
    def test_same_domain_allowed(self):
        assert is_crawlable_url("https://example.com/about", "example.com") is True

    def test_subdomain_allowed(self):
        assert is_crawlable_url("https://www.example.com/about", "example.com") is True

    def test_www_mismatch_allowed(self):
        """www.site.com and site.com should be treated as the same domain."""
        assert is_crawlable_url("https://site.com/about", "www.site.com") is True
        assert is_crawlable_url("https://www.site.com/about", "site.com") is True

    def test_external_domain_blocked(self):
        assert is_crawlable_url("https://other.com/about", "example.com") is False

    def test_non_http_scheme_blocked(self):
        assert is_crawlable_url("mailto:test@example.com", "example.com") is False
        assert is_crawlable_url("javascript:void(0)", "example.com") is False
        assert is_crawlable_url("tel:+15551234567", "example.com") is False

    def test_media_extensions_blocked(self):
        assert is_crawlable_url("https://example.com/photo.jpg", "example.com") is False
        assert is_crawlable_url("https://example.com/doc.pdf", "example.com") is False
        assert is_crawlable_url("https://example.com/video.mp4", "example.com") is False
        assert is_crawlable_url("https://example.com/style.css", "example.com") is False

    def test_extension_check_case_insensitive(self):
        assert is_crawlable_url("https://example.com/PHOTO.JPG", "example.com") is False

    def test_wp_admin_blocked(self):
        assert (
            is_crawlable_url("https://example.com/wp-admin/edit.php", "example.com")
            is False
        )

    def test_login_blocked(self):
        assert is_crawlable_url("https://example.com/login", "example.com") is False

    def test_feed_blocked(self):
        assert is_crawlable_url("https://example.com/feed", "example.com") is False

    def test_api_blocked(self):
        assert (
            is_crawlable_url("https://example.com/api/v1/data", "example.com") is False
        )

    def test_deep_pagination_blocked(self):
        assert (
            is_crawlable_url("https://example.com/blog?page=6", "example.com") is False
        )
        assert (
            is_crawlable_url("https://example.com/blog?page=10", "example.com") is False
        )

    def test_shallow_pagination_allowed(self):
        assert (
            is_crawlable_url("https://example.com/blog?page=3", "example.com") is True
        )
        assert (
            is_crawlable_url("https://example.com/blog?page=5", "example.com") is True
        )

    def test_archive_pattern_blocked(self):
        assert (
            is_crawlable_url("https://example.com/archive/2024/03", "example.com")
            is False
        )

    def test_normal_page_allowed(self):
        assert (
            is_crawlable_url("https://example.com/issues/healthcare", "example.com")
            is True
        )

    def test_empty_hostname_blocked(self):
        assert is_crawlable_url("https:///path", "example.com") is False

    def test_category_and_tag_pages_allowed(self):
        """Government sites use /category/press-releases etc. as content hubs."""
        assert (
            is_crawlable_url(
                "https://example.com/category/press-releases", "example.com"
            )
            is True
        )
        assert is_crawlable_url("https://example.com/tag/news", "example.com") is True


# ---------------------------------------------------------------------------
# clean_site_url
# ---------------------------------------------------------------------------


class TestCleanSiteUrl:
    def test_returns_none_for_none(self):
        assert clean_site_url(None) is None

    def test_returns_none_for_empty(self):
        assert clean_site_url("") is None
        assert clean_site_url("   ") is None

    def test_adds_https_prefix(self):
        assert clean_site_url("example.com") == "https://example.com"

    def test_preserves_existing_https(self):
        assert clean_site_url("https://example.com") == "https://example.com"

    def test_preserves_http(self):
        assert clean_site_url("http://example.com") == "http://example.com"

    def test_strips_whitespace(self):
        assert clean_site_url("  https://example.com  ") == "https://example.com"

    def test_strips_trailing_slash(self):
        assert clean_site_url("https://example.com/") == "https://example.com"


# ---------------------------------------------------------------------------
# discover_sites
# ---------------------------------------------------------------------------


class TestDiscoverSites:
    @pytest.fixture
    def mock_db(self, mocker):
        mock_dbx = mocker.MagicMock()
        mock_officials = mocker.MagicMock()
        mock_challengers = mocker.MagicMock()

        def getitem(key):
            if key == "officials":
                return mock_officials
            if key == "challengers":
                return mock_challengers
            return mocker.MagicMock()

        mock_dbx.__getitem__ = mocker.MagicMock(side_effect=getitem)
        mocker.patch(
            "elite.campaign_sites.crawl.dataset.connect", return_value=mock_dbx
        )
        return mock_dbx, mock_officials, mock_challengers

    def test_weekly_scope_queries_federal_and_challengers(self, mock_db):
        _, mock_officials, mock_challengers = mock_db
        mock_officials.find.return_value = [
            {
                "bioguide_id": "A000001",
                "name": "Alice Smith",
                "government_website": "https://smith.house.gov",
                "campaign_website": "https://alicesmith.com",
            },
        ]
        mock_challengers.find.return_value = [
            {
                "candidate_id": "H6TX22001",
                "name": "Bob Jones",
                "campaign_website": "https://bobjones.com",
            },
        ]

        sites = discover_sites("mysql+pymysql://user:pass@host/elite", scope="weekly")

        assert len(sites) == 3
        types = {s["source_type"] for s in sites}
        assert types == {
            "official_federal_gov",
            "official_federal_campaign",
            "challenger",
        }

        # Officials queried with correct filters
        mock_officials.find.assert_called_once_with(active=True, level="national")
        mock_challengers.find.assert_called_once_with(active=True)

    def test_state_scope_queries_state_officials(self, mock_db):
        _, mock_officials, mock_challengers = mock_db
        mock_officials.find.return_value = [
            {
                "openstates_id": "ocd-person/123",
                "name": "Carol Lee",
                "government_website": "https://carol.state.gov",
                "campaign_website": None,
            },
        ]

        sites = discover_sites("mysql+pymysql://user:pass@host/elite", scope="state")

        assert len(sites) == 1
        assert sites[0]["source_type"] == "official_state_gov"
        mock_officials.find.assert_called_once_with(active=True, level="state")
        mock_challengers.find.assert_not_called()

    def test_deduplicates_by_url(self, mock_db):
        _, mock_officials, mock_challengers = mock_db
        mock_officials.find.return_value = [
            {
                "bioguide_id": "A000001",
                "name": "Alice",
                "government_website": "https://example.com",
                "campaign_website": "https://example.com",  # same URL
            },
        ]
        mock_challengers.find.return_value = []

        sites = discover_sites("mysql+pymysql://user:pass@host/elite", scope="weekly")

        assert len(sites) == 1

    def test_skips_null_urls(self, mock_db):
        _, mock_officials, mock_challengers = mock_db
        mock_officials.find.return_value = [
            {
                "bioguide_id": "A000001",
                "name": "Alice",
                "government_website": None,
                "campaign_website": None,
            },
        ]
        mock_challengers.find.return_value = []

        sites = discover_sites("mysql+pymysql://user:pass@host/elite", scope="weekly")

        assert len(sites) == 0

    def test_falls_back_to_name_parts(self, mock_db):
        _, mock_officials, mock_challengers = mock_db
        mock_officials.find.return_value = [
            {
                "bioguide_id": "B000002",
                "first_name": "John",
                "last_name": "Doe",
                "government_website": "https://doe.house.gov",
                "campaign_website": None,
            },
        ]
        mock_challengers.find.return_value = []

        sites = discover_sites("mysql+pymysql://user:pass@host/elite", scope="weekly")

        assert sites[0]["name"] == "John Doe"


# ---------------------------------------------------------------------------
# save_to_s3
# ---------------------------------------------------------------------------


class TestSaveToS3:
    @pytest.fixture
    def site_info(self):
        return {
            "source_type": "challenger",
            "source_id": "H6TX22001",
            "name": "Jane Smith",
            "site_url": "https://janesmith.com",
        }

    @pytest.fixture
    def sample_pages(self):
        text = "Hello world"
        return [
            {
                "url": "https://janesmith.com/",
                "title": "Jane Smith for Congress",
                "text": text,
                "hash": hashlib.sha256(text.encode()).hexdigest(),
                "html": "<html><body>Hello world</body></html>",
            },
        ]

    def test_uploads_json_and_zip(self, site_info, sample_pages):
        mock_s3 = MagicMock()
        crawl_date = date(2026, 3, 23)

        json_key, zip_key = save_to_s3(mock_s3, site_info, sample_pages, crawl_date)

        assert json_key == "campaign-sites/challenger/H6TX22001/2026-03-23.json"
        assert zip_key == "campaign-sites/challenger/H6TX22001/2026-03-23.html.zip"
        assert mock_s3.put_object.call_count == 2

    def test_json_contains_page_data(self, site_info, sample_pages):
        mock_s3 = MagicMock()
        crawl_date = date(2026, 3, 23)

        save_to_s3(mock_s3, site_info, sample_pages, crawl_date)

        # Get the JSON upload call
        json_call = mock_s3.put_object.call_args_list[0]
        body = json.loads(json_call.kwargs["Body"].decode("utf-8"))

        assert body["url"] == "https://janesmith.com"
        assert body["source_type"] == "challenger"
        assert body["source_id"] == "H6TX22001"
        assert len(body["pages"]) == 1
        assert body["pages"][0]["title"] == "Jane Smith for Congress"
        # JSON should not contain HTML
        assert "html" not in body["pages"][0]

    def test_zip_contains_html_files(self, site_info, sample_pages):
        mock_s3 = MagicMock()
        crawl_date = date(2026, 3, 23)

        save_to_s3(mock_s3, site_info, sample_pages, crawl_date)

        # Get the zip upload call
        zip_call = mock_s3.put_object.call_args_list[1]
        zip_data = zip_call.kwargs["Body"]

        with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
            names = zf.namelist()
            assert len(names) == 1
            assert names[0].endswith(".html")
            content = zf.read(names[0]).decode("utf-8")
            assert "<body>Hello world</body>" in content


# ---------------------------------------------------------------------------
# save_to_db
# ---------------------------------------------------------------------------


class TestSaveToDb:
    @pytest.fixture
    def site_info(self):
        return {
            "source_type": "official_federal_gov",
            "source_id": "A000001",
            "name": "Alice Smith",
            "site_url": "https://smith.house.gov",
        }

    @pytest.fixture
    def sample_pages(self):
        return [
            {
                "url": "https://smith.house.gov/",
                "title": "Home",
                "text": "Welcome to my site",
                "hash": hashlib.sha256(b"Welcome to my site").hexdigest(),
                "html": "<html>...</html>",
            },
            {
                "url": "https://smith.house.gov/about",
                "title": "About",
                "text": "About me",
                "hash": hashlib.sha256(b"About me").hexdigest(),
                "html": "<html>about</html>",
            },
        ]

    @pytest.fixture
    def mock_conn(self, mocker):
        mock = mocker.MagicMock()
        mock_cursor = mocker.MagicMock()
        mock_cursor.lastrowid = 42
        mock.cursor.return_value.__enter__ = mocker.MagicMock(return_value=mock_cursor)
        mock.cursor.return_value.__exit__ = mocker.MagicMock(return_value=False)
        mocker.patch("elite.campaign_sites.crawl._pymysql_connect", return_value=mock)
        return mock, mock_cursor

    def test_inserts_crawl_and_page_hashes(self, mock_conn, site_info, sample_pages):
        mock, mock_cursor = mock_conn

        result = save_to_db(
            "mysql+pymysql://user:pass@host/elite",
            site_info,
            sample_pages,
            date(2026, 3, 23),
            ("json_key", "zip_key"),
            "success",
            12.5,
            {},  # no previous hashes
        )

        assert result["pages_crawled"] == 2
        assert result["pages_new"] == 2
        assert result["pages_changed"] == 0

        # One INSERT for crawl + one executemany for page hashes
        assert mock_cursor.execute.call_count == 1
        assert mock_cursor.executemany.call_count == 1
        mock.commit.assert_called_once()

    def test_counts_changed_pages(self, mock_conn, site_info, sample_pages):
        # Home page existed with different hash; about page is new
        prev_hashes = {
            "https://smith.house.gov/": "old_hash_that_differs",
        }

        result = save_to_db(
            "mysql+pymysql://user:pass@host/elite",
            site_info,
            sample_pages,
            date(2026, 3, 23),
            ("json_key", "zip_key"),
            "success",
            10.0,
            prev_hashes,
        )

        assert result["pages_changed"] == 1
        assert result["pages_new"] == 1

    def test_unchanged_pages_counted_correctly(
        self, mock_conn, site_info, sample_pages
    ):
        # Both pages existed with same hashes
        prev_hashes = {
            "https://smith.house.gov/": sample_pages[0]["hash"],
            "https://smith.house.gov/about": sample_pages[1]["hash"],
        }

        result = save_to_db(
            "mysql+pymysql://user:pass@host/elite",
            site_info,
            sample_pages,
            date(2026, 3, 23),
            ("json_key", "zip_key"),
            "success",
            10.0,
            prev_hashes,
        )

        assert result["pages_changed"] == 0
        assert result["pages_new"] == 0
        assert result["pages_crawled"] == 2

    def test_failure_with_no_pages(self, mock_conn, site_info):
        mock, mock_cursor = mock_conn

        result = save_to_db(
            "mysql+pymysql://user:pass@host/elite",
            site_info,
            [],
            date(2026, 3, 23),
            (None, None),
            "failure",
            5.0,
            {},
            error_msg="No content",
        )

        assert result["pages_crawled"] == 0
        # Verify the INSERT includes failure status
        insert_call = mock_cursor.execute.call_args
        insert_params = insert_call[0][1]
        assert insert_params[5] == "failure"  # status
        assert insert_params[6] == "No content"  # error_message


# ---------------------------------------------------------------------------
# _crawl_one_site
# ---------------------------------------------------------------------------


class TestCrawlOneSite:
    @pytest.fixture
    def site(self):
        return {
            "source_type": "challenger",
            "source_id": "H6TX22001",
            "name": "Jane Smith",
            "site_url": "https://janesmith.com",
        }

    @patch("elite.campaign_sites.crawl._finalize_crawl")
    @patch("elite.campaign_sites.crawl._insert_page_hash")
    @patch("elite.campaign_sites.crawl.save_to_s3")
    @patch("elite.campaign_sites.crawl._extract_page")
    @patch("elite.campaign_sites.crawl.sync_playwright")
    @patch("elite.campaign_sites.crawl._create_crawl_row")
    @patch("elite.campaign_sites.crawl.get_previous_hashes")
    def test_success_flow(
        self,
        mock_prev,
        mock_create,
        mock_pw,
        mock_extract,
        mock_s3,
        mock_insert,
        mock_finalize,
        site,
    ):
        mock_prev.return_value = {}
        mock_conn = MagicMock()
        mock_create.return_value = (mock_conn, 42)
        mock_extract.return_value = (
            {
                "url": "https://janesmith.com",
                "title": "Home",
                "text": "Hi",
                "hash": "abc",
                "html": "<p>Hi</p>",
            },
            [],  # no links
        )
        mock_insert.return_value = (True, False)  # is_new, is_changed
        mock_s3.return_value = ("json_key", "zip_key")

        # Set up Playwright mock so page.url returns the site URL
        mock_page = MagicMock()
        mock_page.url = "https://janesmith.com"
        mock_context = MagicMock()
        mock_context.new_page.return_value = mock_page
        mock_browser = MagicMock()
        mock_browser.new_context.return_value = mock_context
        mock_pw_instance = MagicMock()
        mock_pw_instance.chromium.launch.return_value = mock_browser
        mock_pw.return_value.__enter__ = MagicMock(return_value=mock_pw_instance)
        mock_pw.return_value.__exit__ = MagicMock(return_value=False)

        result = _crawl_one_site(site, "db_url", MagicMock(), date(2026, 3, 23), 1, 1)

        assert result["status"] == "success"
        assert result["pages_crawled"] == 1
        mock_s3.assert_called_once()
        mock_finalize.assert_called_once()
        assert mock_finalize.call_args[0][2] == "success"

    @patch("elite.campaign_sites.crawl._finalize_crawl")
    @patch("elite.campaign_sites.crawl._extract_page")
    @patch("elite.campaign_sites.crawl.sync_playwright")
    @patch("elite.campaign_sites.crawl._create_crawl_row")
    @patch("elite.campaign_sites.crawl.get_previous_hashes")
    def test_no_content_marks_failure(
        self, mock_prev, mock_create, mock_pw, mock_extract, mock_finalize, site
    ):
        mock_prev.return_value = {}
        mock_create.return_value = (MagicMock(), 42)
        mock_extract.return_value = (None, [])  # no text extracted

        result = _crawl_one_site(site, "db_url", MagicMock(), date(2026, 3, 23), 1, 1)

        assert result["status"] == "failure"
        assert result["pages_crawled"] == 0
        mock_finalize.assert_called_once()
        assert mock_finalize.call_args[0][2] == "failure"

    @patch("elite.campaign_sites.crawl._finalize_crawl")
    @patch("elite.campaign_sites.crawl.sync_playwright")
    @patch("elite.campaign_sites.crawl._create_crawl_row")
    @patch("elite.campaign_sites.crawl.get_previous_hashes")
    def test_exception_marks_failure(
        self, mock_prev, mock_create, mock_pw, mock_finalize, site
    ):
        mock_prev.return_value = {}
        mock_create.return_value = (MagicMock(), 42)
        # sync_playwright context manager raises
        mock_pw.return_value.__enter__ = MagicMock(
            side_effect=RuntimeError("Browser crashed")
        )

        result = _crawl_one_site(site, "db_url", MagicMock(), date(2026, 3, 23), 1, 1)

        assert result["status"] == "failure"
        mock_finalize.assert_called_once()
        assert mock_finalize.call_args[0][2] == "failure"


# ---------------------------------------------------------------------------
# run_crawl
# ---------------------------------------------------------------------------


class TestRunCrawl:
    @patch("elite.campaign_sites.crawl.boto3.client")
    @patch("elite.campaign_sites.crawl.discover_sites")
    @patch("shared.config.get_db_url")
    def test_no_sites_returns_zeros(self, mock_db_url, mock_discover, mock_boto):
        mock_db_url.return_value = "mysql+pymysql://user:pass@host/elite"
        mock_discover.return_value = []

        from elite.campaign_sites.crawl import run_crawl

        result = run_crawl(scope="weekly")

        assert result["sites_crawled"] == 0
        assert result["sites_failed"] == 0
        assert result["total_pages"] == 0

    @patch("elite.campaign_sites.crawl._crawl_one_site")
    @patch("elite.campaign_sites.crawl.boto3.client")
    @patch("elite.campaign_sites.crawl.discover_sites")
    @patch("shared.config.get_db_url")
    def test_aggregates_results_from_workers(
        self, mock_db_url, mock_discover, mock_boto, mock_crawl_one
    ):
        mock_db_url.return_value = "mysql+pymysql://user:pass@host/elite"
        mock_discover.return_value = [
            {
                "source_type": "challenger",
                "source_id": "1",
                "name": "A",
                "site_url": "https://a.com",
            },
            {
                "source_type": "challenger",
                "source_id": "2",
                "name": "B",
                "site_url": "https://b.com",
            },
        ]

        # First site succeeds, second fails
        mock_crawl_one.side_effect = [
            {
                "status": "success",
                "pages_crawled": 5,
                "pages_changed": 2,
                "pages_new": 3,
            },
            {
                "status": "failure",
                "pages_crawled": 0,
                "pages_changed": 0,
                "pages_new": 0,
            },
        ]

        from elite.campaign_sites.crawl import run_crawl

        result = run_crawl(scope="weekly", max_workers=1)

        assert result["sites_crawled"] == 1
        assert result["sites_failed"] == 1
        assert result["total_pages"] == 5
        assert result["total_changed"] == 5  # changed + new


# ---------------------------------------------------------------------------
# get_previous_hashes
# ---------------------------------------------------------------------------


class TestGetPreviousHashes:
    def test_returns_hash_dict(self, mocker):
        mock_conn = mocker.MagicMock()
        mock_cursor = mocker.MagicMock()
        mock_cursor.fetchall.return_value = [
            {"page_url": "https://example.com/", "content_hash": "abc123"},
            {"page_url": "https://example.com/about", "content_hash": "def456"},
        ]
        mock_conn.cursor.return_value.__enter__ = mocker.MagicMock(
            return_value=mock_cursor
        )
        mock_conn.cursor.return_value.__exit__ = mocker.MagicMock(return_value=False)
        mocker.patch(
            "elite.campaign_sites.crawl._pymysql_connect", return_value=mock_conn
        )

        from elite.campaign_sites.crawl import get_previous_hashes

        result = get_previous_hashes("db_url", "challenger", "H6TX22001")

        assert result == {
            "https://example.com/": "abc123",
            "https://example.com/about": "def456",
        }

    def test_returns_empty_dict_when_no_previous(self, mocker):
        mock_conn = mocker.MagicMock()
        mock_cursor = mocker.MagicMock()
        mock_cursor.fetchall.return_value = []
        mock_conn.cursor.return_value.__enter__ = mocker.MagicMock(
            return_value=mock_cursor
        )
        mock_conn.cursor.return_value.__exit__ = mocker.MagicMock(return_value=False)
        mocker.patch(
            "elite.campaign_sites.crawl._pymysql_connect", return_value=mock_conn
        )

        from elite.campaign_sites.crawl import get_previous_hashes

        result = get_previous_hashes("db_url", "challenger", "H6TX22001")

        assert result == {}
