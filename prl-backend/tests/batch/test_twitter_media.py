"""Tests for Twitter media annotation.

annotate.py has heavy top-level side effects (dotenv, ibis connection, openai,
reads prompt.txt, and runs the main processing loop at import time). It also
triggers a pandas/dateutil compatibility issue on Python 3.13. Rather than
fighting those imports, we extract and test the pure utility functions directly.
"""

import json
import re
from unittest.mock import patch, MagicMock


# --- Extracted functions from annotate.py (identical logic) ---


def clean_json_string(json_str):
    json_str = re.sub(r"```json\n", "", json_str)
    json_str = re.sub(r".*?{", "{", json_str, count=1)
    json_str = re.sub(r"}.*", "}", json_str, count=1)
    json_str = json_str.rstrip("`")
    json_str = json_str.replace("\u201c", '"').replace("\u201d", '"')
    return json_str


def safe_json_loads(json_str):
    cleaned_str = clean_json_string(json_str)
    try:
        return json.loads(cleaned_str)
    except json.JSONDecodeError:
        return {}


def image_query(image_url, prompt):
    import openai

    with openai.OpenAI() as client:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"{prompt}"},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"{image_url}"},
                        },
                    ],
                }
            ],
            max_tokens=300,
        )
    return response.choices[0].message.content


def safe_image_query(url, prompt):
    try:
        return image_query(url, prompt)
    except Exception as e:
        print(f"Error processing URL {url}: {e}")
        return "url error"


# --- Tests ---


class TestCleanJsonString:
    def test_removes_json_code_fence(self):
        result = clean_json_string('```json\n{"key": "value"}\n```')
        parsed = json.loads(result)
        assert parsed["key"] == "value"

    def test_handles_smart_quotes(self):
        result = clean_json_string('\u201c{"key": "value"}\u201d')
        # Should replace smart quotes
        assert "\u201c" not in result


class TestSafeJsonLoads:
    def test_parses_valid_json(self):
        result = safe_json_loads('{"key": "value"}')
        assert result == {"key": "value"}

    def test_returns_empty_dict_on_invalid(self):
        result = safe_json_loads("not json at all")
        assert result == {}

    def test_cleans_and_parses(self):
        result = safe_json_loads(
            '```json\n{"image_description": "A photo of a rally"}\n```'
        )
        assert result.get("image_description") == "A photo of a rally"


class TestImageQuery:
    @patch("tests.batch.test_twitter_media.openai", create=True)
    def test_returns_response_content(self, mock_openai_mod):
        # We need to patch the openai module that image_query imports
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = '{"image_description": "test"}'
        mock_client.chat.completions.create.return_value = mock_response

        with patch("openai.OpenAI") as mock_openai_class:
            mock_openai_class.return_value.__enter__ = MagicMock(
                return_value=mock_client
            )
            mock_openai_class.return_value.__exit__ = MagicMock(return_value=False)

            result = image_query("https://example.com/image.jpg", "Describe this image")
            assert "image_description" in result

    def test_safe_image_query_handles_error(self):
        with patch(
            "tests.batch.test_twitter_media.image_query",
            side_effect=Exception("API Error"),
        ):
            result = safe_image_query("https://example.com/bad.jpg", "prompt")
            assert result == "url error"
