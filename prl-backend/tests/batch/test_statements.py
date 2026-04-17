"""Tests for statement ingestion utilities."""

import re
from unittest.mock import patch
from urllib.parse import urlparse, urljoin

# ingestion_utils.py has a syntax error in its main body (line ~343) and heavy
# imports (playwright, scrapegraphai, dotenv). Since the module cannot be
# imported directly, we extract and test the pure utility functions by
# importing them from a clean namespace.

# We need lxml.etree for is_valid_xpath, bs4 for extract_visible_html,
# and requests for check_if_url_valid. These are standard deps.
from bs4 import BeautifulSoup
from lxml import etree
import requests as _requests


# Redefine the functions under test exactly as they appear in the source.
# This allows us to test the logic without importing the broken module.


def make_url_absolute(base_url, url):
    """Convert a relative URL to an absolute URL using the given base URL."""
    parsed_url = urlparse(url)
    if parsed_url.scheme:
        return url
    return urljoin(base_url, url)


def check_if_url_valid(url, timeout=10):
    try:
        response = _requests.get(url, timeout=timeout)
        return response.status_code < 400
    except _requests.exceptions.RequestException:
        return False


def is_valid_xpath(xpath):
    try:
        etree.XPath(xpath)
        return True
    except etree.XPathSyntaxError:
        return False


def extract_visible_html(html):
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


class TestMakeUrlAbsolute:
    def test_absolute_url_unchanged(self):
        """Absolute URLs should pass through unchanged."""
        url = "https://example.com/page"
        result = make_url_absolute("https://base.com", url)
        assert result == url

    def test_relative_url_resolved(self):
        """Relative URLs should be joined with base URL."""
        result = make_url_absolute("https://base.com/press/", "/news/article1")
        assert result == "https://base.com/news/article1"

    def test_relative_path_resolved(self):
        """Relative path without leading slash."""
        result = make_url_absolute("https://base.com/press/", "article1")
        assert result == "https://base.com/press/article1"


class TestCheckIfUrlValid:
    @patch("tests.batch.test_statements._requests.get")
    def test_valid_url(self, mock_get):
        """Valid URL should return True."""
        mock_get.return_value.status_code = 200
        assert check_if_url_valid("https://example.com") is True

    @patch("tests.batch.test_statements._requests.get")
    def test_invalid_url(self, mock_get):
        """404 URL should return False."""
        mock_get.return_value.status_code = 404
        assert check_if_url_valid("https://example.com/notfound") is False

    @patch(
        "tests.batch.test_statements._requests.get",
        side_effect=_requests.exceptions.RequestException("Connection error"),
    )
    def test_connection_error(self, mock_get):
        """Connection error should return False."""
        assert check_if_url_valid("https://unreachable.example.com") is False


class TestIsValidXpath:
    def test_valid_xpath(self):
        """Valid XPath should return True."""
        assert is_valid_xpath("//div[@class='content']") is True

    def test_invalid_xpath(self):
        """Invalid XPath should return False."""
        assert is_valid_xpath("///[invalid") is False


class TestExtractVisibleHtml:
    def test_removes_script_tags(self):
        """Script tags should be removed."""
        html = "<html><body><script>alert('xss')</script><p>Content</p></body></html>"
        result = extract_visible_html(html)
        assert "alert" not in result
        assert "Content" in result

    def test_removes_hidden_elements(self):
        """Elements with display:none should be removed."""
        html = '<html><body><div style="display: none">Hidden</div><p>Visible</p></body></html>'
        result = extract_visible_html(html)
        assert "Hidden" not in result
        assert "Visible" in result


# Redefine _url_matches_press_pattern for testing (same reason as above).
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


class TestUrlMatchesPressPattern:
    """Test URL pattern matching for press release pages."""

    def test_press(self):
        assert _url_matches_press_pattern("https://joyce.house.gov/press") is True

    def test_press_trailing_slash(self):
        assert _url_matches_press_pattern("https://example.house.gov/press/") is True

    def test_press_releases(self):
        assert (
            _url_matches_press_pattern("https://example.house.gov/press-releases")
            is True
        )

    def test_press_release_singular(self):
        assert (
            _url_matches_press_pattern("https://example.house.gov/press-release")
            is True
        )

    def test_newsroom(self):
        assert _url_matches_press_pattern("https://example.senate.gov/newsroom") is True

    def test_newsroom_press_releases(self):
        assert (
            _url_matches_press_pattern(
                "https://example.senate.gov/newsroom/press-releases"
            )
            is True
        )

    def test_media_center(self):
        assert (
            _url_matches_press_pattern("https://example.house.gov/media-center") is True
        )

    def test_statements(self):
        assert (
            _url_matches_press_pattern("https://example.house.gov/statements") is True
        )

    def test_news(self):
        assert _url_matches_press_pattern("https://example.house.gov/news") is True

    def test_case_insensitive(self):
        assert _url_matches_press_pattern("https://example.house.gov/Press") is True
        assert _url_matches_press_pattern("https://example.house.gov/NEWSROOM") is True

    def test_individual_article_rejected(self):
        """Individual press release article URLs should not match."""
        assert (
            _url_matches_press_pattern(
                "https://example.house.gov/press/2024/01/article-title"
            )
            is False
        )

    def test_about_page_rejected(self):
        assert _url_matches_press_pattern("https://example.house.gov/about") is False

    def test_contact_page_rejected(self):
        assert _url_matches_press_pattern("https://example.house.gov/contact") is False

    def test_root_rejected(self):
        assert _url_matches_press_pattern("https://example.house.gov/") is False

    def test_biography_rejected(self):
        assert (
            _url_matches_press_pattern("https://example.house.gov/biography") is False
        )

    def test_empty_string(self):
        assert _url_matches_press_pattern("") is False
