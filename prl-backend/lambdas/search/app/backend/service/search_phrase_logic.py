import re

BOOLEAN_SYNTAX_CHARS = set(["+", "-", '"', "~", ">", "<", "*", "(", ")"])

# Common MySQL stop words that should use LIKE instead of fulltext search
COMMON_STOP_WORDS = {
    "a",
    "about",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "being",
    "but",
    "by",
    "can",
    "com",
    "could",
    "de",
    "did",
    "do",
    "does",
    "en",
    "for",
    "from",
    "had",
    "has",
    "have",
    "how",
    "i",
    "in",
    "is",
    "it",
    "la",
    "may",
    "might",
    "must",
    "of",
    "on",
    "or",
    "should",
    "that",
    "the",
    "these",
    "this",
    "those",
    "to",
    "und",
    "was",
    "were",
    "what",
    "when",
    "where",
    "who",
    "will",
    "with",
    "would",
    "www",
}


def build_search_logic_sql(search_input, column_name="text"):
    if not search_input or not str(search_input).strip():
        return "", [], []

    text = search_input.strip()

    if contains_boolean_syntax(text):
        sql_clause = f"MATCH({column_name}) AGAINST(%s IN BOOLEAN MODE)"
        params = [text]
        highlight_terms = extract_highlight_terms_from_boolean(text)
        return sql_clause, params, highlight_terms

    tokens = text.split()

    if len(tokens) == 1:
        word = tokens[0]

        if len(word) < 3 or word.lower() in COMMON_STOP_WORDS:
            sql_clause = f"{column_name} LIKE %s"
            params = [f"%{word}%"]
            highlight_terms = [word]
        else:
            transformed = f"+{word}"
            sql_clause = f"MATCH({column_name}) AGAINST(%s IN BOOLEAN MODE)"
            params = [transformed]
            highlight_terms = [word]
    else:
        has_short_word = any(len(token) < 3 for token in tokens)
        has_stop_word = any(token.lower() in COMMON_STOP_WORDS for token in tokens)

        if has_short_word or has_stop_word:
            sql_clause = f"{column_name} LIKE %s"
            params = [f"%{text}%"]
            highlight_terms = [text]
        else:
            transformed = f'+"{text}"'
            sql_clause = f"MATCH({column_name}) AGAINST(%s IN BOOLEAN MODE)"
            params = [transformed]
            highlight_terms = [text]

    return sql_clause, params, highlight_terms


def contains_boolean_syntax(text: str) -> bool:
    return any(ch in text for ch in BOOLEAN_SYNTAX_CHARS)


def extract_highlight_terms_from_boolean(search_input: str):
    quoted_phrases = [
        q.strip() for q in re.findall(r'"([^"]+)"', search_input) if q.strip()
    ]

    text_without_phrases = re.sub(r'"[^"]+"', " ", search_input)
    cleaned = re.sub(r'[+\-~><"()*]', " ", text_without_phrases)

    words = []

    for raw in cleaned.split():
        w = raw.strip().strip("*")
        if w and len(w) > 1:
            words.append(w)

    seen = set()
    result = []

    for term in quoted_phrases + words:
        key = term.lower()
        if key not in seen:
            seen.add(key)
            result.append(term)

    return result


def build_advanced_fulltext_query(
    terms_required=None, terms_optional=None, terms_excluded=None, phrases=None
):
    parts = []

    if terms_required:
        for t in terms_required:
            if t and t.strip():
                parts.append(f"+{t.strip()}")

    if terms_optional:
        for t in terms_optional:
            if t and t.strip():
                parts.append(t.strip())

    if terms_excluded:
        for t in terms_excluded:
            if t and t.strip():
                parts.append(f"-{t.strip()}")

    if phrases:
        for p in phrases:
            if p and str(p).strip():
                parts.append(f'"{str(p).strip()}"')

    return " ".join(parts)
