"""Tests for the Twitter tweet ingestor."""

import sys
import os
import datetime
import importlib.util
from unittest.mock import patch, MagicMock

# Use importlib to load the twitter ingestor with a unique module name
# to avoid conflicts with the floor ingestor (also named "ingestor").
_module_path = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "elite",
    "twitter",
    "ingest-tweets",
    "ingestor.py",
)
_spec = importlib.util.spec_from_file_location("twitter_ingestor", _module_path)
ingestor = importlib.util.module_from_spec(_spec)
sys.modules["twitter_ingestor"] = ingestor
_spec.loader.exec_module(ingestor)


class TestCleanText:
    def test_removes_control_characters(self):
        """Control characters should be stripped from text."""
        text = "Hello\x00World\x01Test\x02"
        cleaned = ingestor.clean_text(text)
        assert "\x00" not in cleaned
        assert "\x01" not in cleaned
        assert "\x02" not in cleaned
        assert "HelloWorldTest" == cleaned

    def test_preserves_normal_text(self):
        """Normal text including newlines should be preserved."""
        text = "Hello World! This is a test."
        cleaned = ingestor.clean_text(text)
        assert cleaned == text


class TestGetTweetsByUser:
    @patch("twitter_ingestor.requests.get")
    def test_success(self, mock_get):
        """Successful API call returns tweet data."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {
                    "id": "123",
                    "text": "Test tweet",
                    "created_at": "2024-01-15T10:30:00.000Z",
                },
            ],
            "meta": {},
        }
        mock_get.return_value = mock_response

        start = datetime.datetime(2024, 1, 1)
        end = datetime.datetime(2024, 1, 31)
        tweets = ingestor.get_tweets_by_user("user1", start, end, "test_token")

        assert len(tweets) == 1
        assert tweets[0]["id"] == "123"

    @patch("twitter_ingestor.requests.get")
    def test_pagination(self, mock_get):
        """Multiple pages of results via next_token."""
        mock_response_1 = MagicMock()
        mock_response_1.status_code = 200
        mock_response_1.json.return_value = {
            "data": [
                {"id": "1", "text": "Tweet 1", "created_at": "2024-01-15T10:30:00.000Z"}
            ],
            "meta": {"next_token": "abc123"},
        }

        mock_response_2 = MagicMock()
        mock_response_2.status_code = 200
        mock_response_2.json.return_value = {
            "data": [
                {"id": "2", "text": "Tweet 2", "created_at": "2024-01-16T10:30:00.000Z"}
            ],
            "meta": {},
        }

        mock_get.side_effect = [mock_response_1, mock_response_2]

        start = datetime.datetime(2024, 1, 1)
        end = datetime.datetime(2024, 1, 31)
        tweets = ingestor.get_tweets_by_user("user1", start, end, "test_token")

        assert len(tweets) == 2
        assert mock_get.call_count == 2

    @patch("twitter_ingestor.time.sleep")
    @patch("twitter_ingestor.requests.get")
    def test_rate_limit_429_waits(self, mock_get, mock_sleep):
        """429 response should trigger 15-second backoff."""
        mock_response_429 = MagicMock()
        mock_response_429.status_code = 429
        mock_response_429.text = "Rate limited"

        mock_response_200 = MagicMock()
        mock_response_200.status_code = 200
        mock_response_200.json.return_value = {
            "data": [
                {"id": "1", "text": "Tweet", "created_at": "2024-01-15T10:30:00.000Z"}
            ],
            "meta": {},
        }

        mock_get.side_effect = [mock_response_429, mock_response_200]

        start = datetime.datetime(2024, 1, 1)
        end = datetime.datetime(2024, 1, 31)
        ingestor.get_tweets_by_user("user1", start, end, "test_token")

        mock_sleep.assert_called_with(15)

    @patch("twitter_ingestor.requests.get")
    def test_empty_response(self, mock_get):
        """Empty tweet response returns empty list."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [],
            "meta": {},
        }
        mock_get.return_value = mock_response

        start = datetime.datetime(2024, 1, 1)
        end = datetime.datetime(2024, 1, 31)
        tweets = ingestor.get_tweets_by_user("user1", start, end, "test_token")

        assert len(tweets) == 0

    @patch("twitter_ingestor.requests.get")
    def test_media_url_extraction(self, mock_get):
        """Media URLs should be extracted and matched to tweets."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {
                    "id": "123",
                    "text": "Photo tweet",
                    "created_at": "2024-01-15T10:30:00.000Z",
                    "attachments": {"media_keys": ["media_1"]},
                }
            ],
            "includes": {
                "media": [
                    {
                        "media_key": "media_1",
                        "type": "photo",
                        "url": "https://pbs.twimg.com/photo.jpg",
                    },
                ]
            },
            "meta": {},
        }
        mock_get.return_value = mock_response

        start = datetime.datetime(2024, 1, 1)
        end = datetime.datetime(2024, 1, 31)
        tweets = ingestor.get_tweets_by_user("user1", start, end, "test_token")

        assert len(tweets) == 1
        assert tweets[0]["media_urls"] == [
            ["media_1", "https://pbs.twimg.com/photo.jpg"]
        ]


class TestIngest:
    @patch("twitter_ingestor.dataset.connect")
    def test_upserts_to_db(self, mock_connect):
        """Verify tweets are upserted to database."""
        mock_db = MagicMock()
        mock_table = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_table)
        mock_connect.return_value = mock_db

        legislator = {
            "twitter_id": "12345",
            "bioguide_id": "A000001",
            "level": "national",
        }

        with patch.object(
            ingestor,
            "get_tweets_by_user",
            return_value=[
                {
                    "id": "t1",
                    "text": "Hello world",
                    "created_at": "2024-01-15T10:30:00.000Z",
                    "public_metrics": {"like_count": 5},
                },
            ],
        ):
            ingestor.ingest(
                legislator,
                datetime.date(2024, 1, 1),
                datetime.date(2024, 1, 31),
                "mysql://test:test@localhost/elite",
                "mysql://test:test@localhost/elite",
                "test_key",
            )

        mock_table.upsert_many.assert_called_once()
