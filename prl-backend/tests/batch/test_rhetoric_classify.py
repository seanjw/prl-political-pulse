"""Tests for rhetoric classification modules."""

import sys
import os
import pytest
from unittest.mock import MagicMock

sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(__file__), "..", "..", "elite", "rhetoric", "classify"
    ),
)

# prompt.py imports hjson and llms which may not be installed locally.
# Mock them before any test imports prompt.
sys.modules.setdefault("hjson", MagicMock())
sys.modules.setdefault("llms", MagicMock())


class TestTextCleaning:
    def test_general_tokenizer_removes_urls(self):
        import text

        result = text.general_tokenizer("Check out https://example.com for more info.")
        joined = " ".join(result)
        assert "https://example.com" not in joined

    def test_general_tokenizer_normalizes_whitespace(self):
        import text

        result = text.general_tokenizer("Hello    world   test")
        joined = " ".join(result)
        assert "    " not in joined

    def test_chunk_splits_correctly(self):
        import text

        sentences = [
            "Sentence one.",
            "Sentence two.",
            "Sentence three.",
            "Sentence four.",
        ]
        chunks = text.chunk("", sentences, size=2)
        assert len(chunks) == 2
        assert chunks[0] == "Sentence one. Sentence two."
        assert chunks[1] == "Sentence three. Sentence four."


class TestTokenCounting:
    def test_get_num_tokens_returns_int(self):
        import text

        count = text.get_num_tokens("Hello world, this is a test.")
        assert isinstance(count, int)
        assert count > 0

    def test_get_num_tokens_handles_error(self):
        import text

        count = text.get_num_tokens(None)
        assert count == 1


class TestPromptGeneration:
    def test_user_prompt_format(self):
        import prompt

        result = prompt.get_user_prompt("This is a policy speech about healthcare.")
        assert "Analyze this text:" in result
        assert "healthcare" in result

    def test_user_prompt_rejects_empty(self):
        import prompt

        with pytest.raises(ValueError):
            prompt.get_user_prompt("")

    def test_user_prompt_rejects_nan(self):
        import prompt

        with pytest.raises(ValueError):
            prompt.get_user_prompt("nan")

    def test_system_prompt_exists(self):
        import prompt

        assert len(prompt.system_prompt) > 100
        assert "JSON" in prompt.system_prompt


class TestYesNo:
    def test_yesno_yes(self):
        import prompt

        assert prompt.yesno("yes") == 1
        assert prompt.yesno("Yes") == 1
        assert prompt.yesno("YES") == 1

    def test_yesno_no(self):
        import prompt

        assert prompt.yesno("no") == 0
        assert prompt.yesno("No") == 0

    def test_yesno_none(self):
        import prompt

        assert prompt.yesno(None) is None
