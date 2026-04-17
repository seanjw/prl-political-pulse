#!/usr/bin/env python3
"""
Parse LaTeX CV and BibTeX files to generate JSON for the ProfileWestwood page.

Usage:
    python parse_cv.py --cv path/to/cv.tex --bib path/to/published.bib [--output output.json]

If --output is not specified, prints JSON to stdout.
Use --merge to preserve existing profile data from the current JSON file.
"""

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import bibtexparser
    from bibtexparser.bparser import BibTexParser
    from bibtexparser.customization import convert_to_unicode
except ImportError:
    print(
        "Error: bibtexparser not installed. Run: pip install bibtexparser",
        file=sys.stderr,
    )
    sys.exit(1)


# =============================================================================
# LaTeX Text Cleaning
# =============================================================================


def strip_latex_comments(text: str) -> str:
    """Remove LaTeX comments (lines starting with % or content after %)."""
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        # Skip lines that are entirely comments (after stripping whitespace)
        stripped = line.lstrip()
        if stripped.startswith("%"):
            continue
        # Remove inline comments (% and everything after, but not escaped \%)
        # Simple approach: remove everything after first unescaped %
        result = []
        i = 0
        while i < len(line):
            if line[i] == "%" and (i == 0 or line[i - 1] != "\\"):
                break  # Found unescaped %, ignore rest of line
            result.append(line[i])
            i += 1
        cleaned_lines.append("".join(result))
    return "\n".join(cleaned_lines)


def clean_latex(text: str) -> str:
    """Clean LaTeX formatting from text."""
    if not text:
        return ""

    # Remove {\textbf{...}} patterns (bold author names in BibTeX)
    # Handle nested braces: {\textbf{Westwood, Sean J.}}
    text = re.sub(r"\{\\textbf\{([^}]+)\}\}", r"\1", text)

    # Remove standalone \textbf{...}
    text = re.sub(r"\\textbf\{([^}]+)\}", r"\1", text)

    # Remove leftover \textbf without proper braces
    text = re.sub(r"\\textbf([A-Za-z])", r"\1", text)

    # Convert \uppercase{X} to uppercase X
    # Handle the pattern: \uppercase{A}merican -> American
    text = re.sub(r"\\uppercase\{([^}]+)\}", lambda m: m.group(1).upper(), text)

    # Handle \p̆ercase pattern that might result from encoding issues
    text = re.sub(r"\\p̆ercase([A-Z])", r"\1", text)
    text = re.sub(r"p̆percase", "", text)

    # Handle escaped special characters
    text = text.replace(r"\&", "&")
    text = text.replace(r"\%", "%")
    text = text.replace(r"\_", "_")
    text = text.replace(r"\#", "#")
    text = text.replace(r"\$", "$")

    # Remove escaped braces
    text = text.replace(r"\{", "").replace(r"\}", "")

    # Remove standalone braces around single words
    text = re.sub(r"\{([^{}]+)\}", r"\1", text)

    # Normalize dashes
    text = text.replace("--", "–")

    # Remove trailing tildes, periods, and whitespace
    text = text.rstrip("~. \t")

    # Clean up multiple spaces
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def clean_author_string(authors: str) -> str:
    """Clean and format author string for JSON output."""
    if not authors:
        return ""

    # Clean LaTeX formatting
    authors = clean_latex(authors)

    # Fix common patterns
    # "Lastname, Firstname and Lastname2, Firstname2" format
    # Convert to "Lastname, F., Lastname2, F2." format

    # Replace " and " with ", & "
    authors = re.sub(r"\s+and\s+", ", & ", authors, flags=re.IGNORECASE)

    # Clean up any double commas or spaces
    authors = re.sub(r",\s*,", ",", authors)
    authors = re.sub(r"\s+", " ", authors)

    return authors.strip()


def parse_year(year_str: str) -> str | int:
    """Parse year string, handling special cases like 'forthcoming', 'in press'."""
    if not year_str:
        return ""

    year_str = str(year_str).strip()

    # Check for special cases
    lower = year_str.lower()
    if "forthcoming" in lower:
        return "forthcoming"
    if "in press" in lower:
        return "in press"
    if "in preparation" in lower:
        return "In preparation"

    # Try to extract a year number
    match = re.search(r"(\d{4})", year_str)
    if match:
        return int(match.group(1))

    return year_str


# =============================================================================
# BibTeX Parsing
# =============================================================================


def parse_bibtex(bib_path: str) -> dict[str, dict]:
    """Parse BibTeX file and return dict of entries keyed by citation key."""
    with open(bib_path, "r", encoding="utf-8") as f:
        bib_content = f.read()

    # Custom parser to handle unicode
    parser = BibTexParser(common_strings=True)
    parser.customization = convert_to_unicode

    bib_database = bibtexparser.loads(bib_content, parser=parser)

    entries = {}
    for entry in bib_database.entries:
        key = entry.get("ID", "")
        entries[key] = entry

    return entries


def bibtex_to_publication(entry: dict) -> dict:
    """Convert a BibTeX entry to publication JSON format."""
    pub = {
        "authors": clean_author_string(entry.get("author", "")),
        "year": parse_year(entry.get("year", "")),
        "title": clean_latex(entry.get("title", "")),
        "citationKey": entry.get(
            "ID", ""
        ),  # BibTeX citation key for matching during imports
    }

    # Add journal for articles
    journal = entry.get("journal", "")
    if journal:
        pub["journal"] = clean_latex(journal)

    # Add volume if present
    volume = entry.get("volume", "")
    number = entry.get("number", "")
    if volume:
        if number:
            pub["volume"] = f"{volume}({number})"
        else:
            pub["volume"] = volume

    # Add pages if present
    pages = entry.get("pages", "")
    if pages:
        pub["pages"] = clean_latex(pages)

    # Add note if present (for "Revise and Resubmit" etc.)
    note = entry.get("note", "")
    if note:
        pub["note"] = clean_latex(note)

    # Add URL (empty by default, can be filled in later)
    pub["url"] = entry.get("url", "")

    return pub


def bibtex_to_book(entry: dict) -> dict:
    """Convert a BibTeX book entry to book JSON format."""
    return {
        "title": clean_latex(entry.get("title", "")),
        "authors": clean_author_string(entry.get("author", "")),
        "year": parse_year(entry.get("year", "")),
        "publisher": clean_latex(entry.get("publisher", "")),
        "url": entry.get("url", ""),
        "citationKey": entry.get(
            "ID", ""
        ),  # BibTeX citation key for matching during imports
    }


def bibtex_to_chapter(entry: dict) -> dict:
    """Convert a BibTeX inbook entry to chapter JSON format."""
    return {
        "authors": clean_author_string(entry.get("author", "")),
        "year": parse_year(entry.get("year", "")),
        "title": clean_latex(entry.get("chapter", entry.get("title", ""))),
        "book": clean_latex(entry.get("booktitle", entry.get("title", ""))),
        "editors": clean_latex(entry.get("editor", "")),
        "publisher": clean_latex(entry.get("publisher", "")),
        "url": entry.get("url", ""),
        "citationKey": entry.get(
            "ID", ""
        ),  # BibTeX citation key for matching during imports
    }


def bibtex_to_techreport(entry: dict) -> dict:
    """Convert a BibTeX techreport entry to technical report JSON format."""
    return {
        "authors": clean_author_string(entry.get("author", "")),
        "year": parse_year(entry.get("year", "")),
        "title": clean_latex(entry.get("title", "")),
        "note": clean_latex(entry.get("institution", "Tech. Rep.")),
        "citationKey": entry.get(
            "ID", ""
        ),  # BibTeX citation key for matching during imports
    }


# =============================================================================
# LaTeX CV Parsing
# =============================================================================


def extract_publication_keys_from_section(
    cv_content: str, section_start: str, section_end: str
) -> list[str]:
    r"""Extract \publication{key} references from a CV section."""
    # Find the section
    start_match = re.search(
        rf"\\section\*\{{{section_start}\}}", cv_content, re.IGNORECASE
    )
    if not start_match:
        # Try without asterisk
        start_match = re.search(
            rf"\\section\{{{section_start}\}}", cv_content, re.IGNORECASE
        )
    if not start_match:
        return []

    start_pos = start_match.end()

    # Find the end of section
    end_match = re.search(r"\\section\*?\{", cv_content[start_pos:])
    if end_match:
        end_pos = start_pos + end_match.start()
    else:
        end_pos = len(cv_content)

    section_text = cv_content[start_pos:end_pos]

    # Strip LaTeX comments before extracting keys
    section_text = strip_latex_comments(section_text)

    # Extract all \publication{key} references
    keys = re.findall(r"\\publication\{([^}]+)\}", section_text)

    return keys


def extract_subsection_keys(
    cv_content: str, section_name: str, subsection_name: str
) -> list[str]:
    """Extract publication keys from a subsection within a section."""
    # Find the section
    section_match = re.search(
        rf"\\section\*?\{{{section_name}\}}", cv_content, re.IGNORECASE
    )
    if not section_match:
        return []

    section_start = section_match.end()

    # Find next section
    next_section = re.search(r"\\section\*?\{", cv_content[section_start:])
    section_end = (
        section_start + next_section.start() if next_section else len(cv_content)
    )

    section_text = cv_content[section_start:section_end]

    # Find the subsection
    subsection_match = re.search(
        rf"\\subsection\*?\{{{subsection_name}\}}", section_text, re.IGNORECASE
    )
    if not subsection_match:
        return []

    subsection_start = subsection_match.end()

    # Find next subsection or end of section
    next_subsection = re.search(r"\\subsection\*?\{", section_text[subsection_start:])
    subsection_end = (
        subsection_start + next_subsection.start()
        if next_subsection
        else len(section_text)
    )

    subsection_text = section_text[subsection_start:subsection_end]

    # Strip LaTeX comments before extracting keys
    subsection_text = strip_latex_comments(subsection_text)

    # Extract keys
    keys = re.findall(r"\\publication\{([^}]+)\}", subsection_text)

    return keys


def extract_awards_from_cv(cv_content: str) -> list[dict]:
    """Extract awards from the CV Awards section."""
    awards = []

    # Find Awards section
    section_match = re.search(r"\\section\*?\{Awards\}", cv_content, re.IGNORECASE)
    if not section_match:
        return awards

    section_start = section_match.end()

    # Find next section
    next_section = re.search(r"\\section\*?\{", cv_content[section_start:])
    section_end = (
        section_start + next_section.start() if next_section else len(cv_content)
    )

    section_text = cv_content[section_start:section_end]

    # Strip LaTeX comments
    section_text = strip_latex_comments(section_text)

    # Extract \WorkEntry{name}{institution}{year}{} patterns
    # Format: \WorkEntry{Award Name}{Institution}{Year}{}
    work_entries = re.findall(
        r"\\WorkEntry\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{[^}]*\}", section_text
    )

    for name, institution, year in work_entries:
        try:
            year_int = int(year)
        except ValueError:
            year_int = year

        awards.append(
            {
                "name": clean_latex(name),
                "year": year_int,
                "institution": clean_latex(institution),
            }
        )

    return awards


def extract_grants_from_cv(cv_content: str) -> list[dict]:
    """Extract grants from the CV Grants section."""
    grants = []

    # Find Grants section
    section_match = re.search(r"\\section\*?\{Grants[^}]*\}", cv_content, re.IGNORECASE)
    if not section_match:
        return grants

    section_start = section_match.end()

    # Find next section
    next_section = re.search(r"\\section\*?\{", cv_content[section_start:])
    section_end = (
        section_start + next_section.start() if next_section else len(cv_content)
    )

    section_text = cv_content[section_start:section_end]

    # Strip LaTeX comments
    section_text = strip_latex_comments(section_text)

    # Extract \WorkEntry{title}{funder}{role - $amount - year}{} patterns
    # Format: \WorkEntry{``Grant Title''}{Funder}{PI - $amount - year}{}
    work_entries = re.findall(
        r"\\WorkEntry\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{[^}]*\}", section_text
    )

    for title, funder, details in work_entries:
        # Clean up the title (remove `` and '')
        title = clean_latex(title).replace("``", "").replace("''", "").strip()
        funder = clean_latex(funder)

        # Parse details: "PI - $amount - year" or "Co-PI - $amount - year"
        role = ""
        amount = ""
        year = ""

        # Extract role
        role_match = re.match(r"(PI|Co-PI)\s*-?\s*", details)
        if role_match:
            role = role_match.group(1)
            details = details[role_match.end() :]

        # Extract amount
        amount_match = re.search(r"\$([0-9,]+)", details)
        if amount_match:
            amount = f"${amount_match.group(1)}"

        # Extract year(s)
        year_match = re.search(r"(\d{4}(?:-\d{4})?)", details)
        if year_match:
            year = year_match.group(1)

        grants.append(
            {
                "title": title,
                "funder": funder,
                "role": role,
                "amount": amount,
                "year": year,
            }
        )

    return grants


def extract_invited_talks_from_cv(cv_content: str) -> list[dict]:
    """Extract invited talks from the CV Invited Talks section."""
    talks = []

    # Find Invited Talks section
    section_match = re.search(
        r"\\section\*?\{Invited Talks\}", cv_content, re.IGNORECASE
    )
    if not section_match:
        return talks

    section_start = section_match.end()

    # Find next section
    next_section = re.search(r"\\section\*?\{", cv_content[section_start:])
    section_end = (
        section_start + next_section.start() if next_section else len(cv_content)
    )

    section_text = cv_content[section_start:section_end]

    # Strip LaTeX comments
    section_text = strip_latex_comments(section_text)

    # Extract \item entries: "Institution Year"
    items = re.findall(
        r"\\item\s+(.+?)(?=\\item|\\end\{itemize\}|$)", section_text, re.DOTALL
    )

    for item in items:
        item = item.strip()
        if not item:
            continue

        # Parse "Institution Year" format
        # Year is typically at the end
        year_match = re.search(r"\b(\d{4})\s*$", item)
        if year_match:
            year = int(year_match.group(1))
            institution = item[: year_match.start()].strip()
        else:
            # No year found
            year = ""
            institution = item

        # Clean up institution name
        institution = clean_latex(institution)
        # Remove trailing commas or dashes
        institution = institution.rstrip(",-").strip()

        if institution:
            talks.append(
                {
                    "institution": institution,
                    "year": year,
                }
            )

    return talks


def extract_conference_presentations_from_cv(cv_content: str) -> list[dict]:
    """Extract conference presentations from the CV Conference Presentations section."""
    presentations = []

    # Find Conference Presentations section
    section_match = re.search(
        r"\\section\*?\{Conference Presentations\}", cv_content, re.IGNORECASE
    )
    if not section_match:
        return presentations

    section_start = section_match.end()

    # Find next section
    next_section = re.search(r"\\section\*?\{", cv_content[section_start:])
    section_end = (
        section_start + next_section.start() if next_section else len(cv_content)
    )

    section_text = cv_content[section_start:section_end]

    # Strip LaTeX comments
    section_text = strip_latex_comments(section_text)

    # Extract \item entries: "Conference: year (count), year, ..."
    items = re.findall(
        r"\\item\s+(.+?)(?=\\item|\\end\{itemize\}|$)", section_text, re.DOTALL
    )

    for item in items:
        item = item.strip()
        if not item:
            continue

        # Parse "Conference: years" format
        if ":" in item:
            parts = item.split(":", 1)
            conference = clean_latex(parts[0]).strip()
            years_str = parts[1].strip()

            # Parse years, handling "(count)" notation
            # e.g., "2011 (2), 2012, 2013" -> expand to individual entries
            year_entries = re.findall(r"(\d{4})(?:\s*\((\d+)\))?", years_str)

            for year, count in year_entries:
                count = int(count) if count else 1
                for _ in range(count):
                    presentations.append(
                        {
                            "conference": conference,
                            "year": int(year),
                        }
                    )

    return presentations


def extract_service_from_cv(cv_content: str) -> list[dict]:
    """Extract service activities from the CV Service section."""
    service = []

    # Find Service section
    section_match = re.search(r"\\section\*?\{Service\}", cv_content, re.IGNORECASE)
    if not section_match:
        return service

    section_start = section_match.end()

    # Find next section
    next_section = re.search(r"\\section\*?\{", cv_content[section_start:])
    section_end = (
        section_start + next_section.start() if next_section else len(cv_content)
    )

    section_text = cv_content[section_start:section_end]

    # Strip LaTeX comments
    section_text = strip_latex_comments(section_text)

    # Extract \item entries
    items = re.findall(
        r"\\item\s+(.+?)(?=\\item|\\end\{itemize\}|$)", section_text, re.DOTALL
    )

    for item in items:
        item = item.strip()
        if not item:
            continue

        # Clean up the item
        role = clean_latex(item)

        # Try to extract year range if present
        year = ""
        year_match = re.search(r"\((\d{4})-?\)?", role)
        if year_match:
            year = year_match.group(1) + "-"
            # Remove year from role
            role = role[: year_match.start()].strip()

        if role:
            service.append(
                {
                    "role": role,
                    "year": year,
                }
            )

    return service


def parse_cv_sections(cv_path: str) -> dict[str, list[str]]:
    """Parse CV to extract which BibTeX keys belong to which section."""
    with open(cv_path, "r", encoding="utf-8") as f:
        cv_content = f.read()

    sections = {
        "books": [],
        "publications": [],
        "otherFieldPublications": [],
        "underReview": [],
        "worksInProgress": [],
        "datasets": [],
        "technicalReports": [],
        "chapters": [],
    }

    # Extract Books section (uses enumerate, not etaremune)
    books_match = re.search(r"\\section\*?\{Books\}", cv_content, re.IGNORECASE)
    if books_match:
        books_start = books_match.end()
        next_section = re.search(r"\\section\*?\{", cv_content[books_start:])
        books_end = (
            books_start + next_section.start() if next_section else len(cv_content)
        )
        books_text = cv_content[books_start:books_end]
        # Strip LaTeX comments
        books_text = strip_latex_comments(books_text)
        sections["books"] = re.findall(r"\\publication\{([^}]+)\}", books_text)

    # Extract main Publications section (handles "Publications and Accepted Papers")
    pub_match = re.search(
        r"\\section\*?\{Publications[^}]*\}", cv_content, re.IGNORECASE
    )
    if pub_match:
        pub_start = pub_match.end()
        next_section = re.search(r"\\section\*?\{", cv_content[pub_start:])
        pub_end = pub_start + next_section.start() if next_section else len(cv_content)
        pub_text = cv_content[pub_start:pub_end]
        # Strip LaTeX comments
        pub_text = strip_latex_comments(pub_text)

        # Check if there's a subsection for "Other Fields"
        subsection_match = re.search(
            r"\\subsection\*?\{[^}]*Other\s+Field[^}]*\}", pub_text, re.IGNORECASE
        )
        if subsection_match:
            # Main publications are before the subsection
            main_pub_text = pub_text[: subsection_match.start()]
            other_pub_text = pub_text[subsection_match.end() :]

            sections["publications"] = re.findall(
                r"\\publication\{([^}]+)\}", main_pub_text
            )
            sections["otherFieldPublications"] = re.findall(
                r"\\publication\{([^}]+)\}", other_pub_text
            )
        else:
            sections["publications"] = re.findall(r"\\publication\{([^}]+)\}", pub_text)

    # Under Review section
    sections["underReview"] = extract_publication_keys_from_section(
        cv_content, "Under Review", ""
    )

    # Work in Progress section
    sections["worksInProgress"] = extract_publication_keys_from_section(
        cv_content, "Work in Progress", ""
    )

    # Datasets section
    sections["datasets"] = extract_publication_keys_from_section(
        cv_content, "Datasets", ""
    )

    # White Paper Reports / Technical Reports section
    white_papers = extract_publication_keys_from_section(
        cv_content, "White Paper Reports", ""
    )
    if not white_papers:
        white_papers = extract_publication_keys_from_section(
            cv_content, "Technical Reports", ""
        )
    sections["technicalReports"] = white_papers

    # Chapter section
    sections["chapters"] = extract_publication_keys_from_section(
        cv_content, "Chapter", ""
    )

    return sections


# =============================================================================
# JSON Generation
# =============================================================================


def generate_profile_json(
    bib_entries: dict[str, dict],
    cv_sections: dict[str, list[str]],
    awards: list[dict],
    grants: list[dict],
    invited_talks: list[dict],
    conference_presentations: list[dict],
    service: list[dict],
    existing_json: dict | None = None,
) -> dict:
    """Generate the complete profile JSON."""

    # Start with existing profile data or defaults
    if existing_json and "profile" in existing_json:
        profile = existing_json["profile"]
    else:
        profile = {
            "name": "Sean J. Westwood",
            "title": "Associate Professor, Department of Government",
            "institution": "Dartmouth College",
            "role": "Director, Polarization Research Lab",
            "photo": "/img/sean.jpeg",
            "email": "sean.j.westwood@dartmouth.edu",
            "googleScholar": "https://scholar.google.com/citations?user=AFD0pYEAAAAJ&hl=en",
            "cvUrl": "",
            "bio": [],
            "researchInterests": [
                "Political Behavior",
                "Polarization",
                "Affective Polarization",
                "Public Opinion",
                "Partisan Prejudice",
                "Democratic Norms",
            ],
        }

    result = {"profile": profile}

    # Process books
    books = []
    for key in cv_sections.get("books", []):
        if key in bib_entries:
            entry = bib_entries[key]
            books.append(bibtex_to_book(entry))
    result["books"] = books

    # Process publications
    publications = []
    for key in cv_sections.get("publications", []):
        if key in bib_entries:
            entry = bib_entries[key]
            publications.append(bibtex_to_publication(entry))
    result["publications"] = publications

    # Process other field publications
    other_pubs = []
    for key in cv_sections.get("otherFieldPublications", []):
        if key in bib_entries:
            entry = bib_entries[key]
            other_pubs.append(bibtex_to_publication(entry))
    result["otherFieldPublications"] = other_pubs

    # Process under review
    under_review = []
    for key in cv_sections.get("underReview", []):
        if key in bib_entries:
            entry = bib_entries[key]
            pub = bibtex_to_publication(entry)
            # For under review, journal field often contains status
            journal = entry.get("journal", "")
            if journal:
                journal_clean = clean_latex(journal)
                # Check for R&R status
                if "revise and resubmit" in journal.lower() or "r&r" in journal.lower():
                    pub["status"] = "R&R"
                    # Extract journal name after "at" or ","
                    match = re.search(
                        r"(?:revise and resubmit|r&r)\s*(?:at|,)?\s*(.+)",
                        journal_clean,
                        re.IGNORECASE,
                    )
                    if match:
                        pub["journal"] = match.group(1).strip()
                    else:
                        pub["journal"] = journal_clean
                elif "review" in journal.lower():
                    pub["status"] = "Under Review"
                    # Try to extract journal name
                    match = re.search(
                        r"(?:under review|submitted)\s*(?:at|,)?\s*(.+)",
                        journal_clean,
                        re.IGNORECASE,
                    )
                    if match:
                        pub["journal"] = match.group(1).strip()
                    else:
                        pub["journal"] = journal_clean
            under_review.append(pub)
    result["underReview"] = under_review

    # Process works in progress
    works_in_progress = []
    for key in cv_sections.get("worksInProgress", []):
        if key in bib_entries:
            entry = bib_entries[key]
            pub = bibtex_to_publication(entry)
            # For works in progress, journal field often contains status
            journal = entry.get("journal", "")
            if journal and (
                "progress" in journal.lower() or "preparation" in journal.lower()
            ):
                pub["note"] = clean_latex(journal)
                if "journal" in pub:
                    del pub["journal"]
            works_in_progress.append(pub)
    result["worksInProgress"] = works_in_progress

    # Process datasets
    datasets = []
    for key in cv_sections.get("datasets", []):
        if key in bib_entries:
            entry = bib_entries[key]
            pub = bibtex_to_techreport(entry)
            datasets.append(pub)
    result["datasets"] = datasets

    # Process technical reports / white papers
    tech_reports = []
    for key in cv_sections.get("technicalReports", []):
        if key in bib_entries:
            entry = bib_entries[key]
            pub = bibtex_to_techreport(entry)
            tech_reports.append(pub)
    result["technicalReports"] = tech_reports

    # Process chapters
    chapters = []
    for key in cv_sections.get("chapters", []):
        if key in bib_entries:
            entry = bib_entries[key]
            chapters.append(bibtex_to_chapter(entry))
    result["chapters"] = chapters

    # Add awards
    result["awards"] = awards

    # Add grants
    result["grants"] = grants

    # Add invited talks
    result["invitedTalks"] = invited_talks

    # Add conference presentations
    result["conferencePresentations"] = conference_presentations

    # Add service
    result["service"] = service

    return result


# =============================================================================
# Main
# =============================================================================


def main():
    parser = argparse.ArgumentParser(
        description="Parse LaTeX CV and BibTeX to generate profile JSON"
    )
    parser.add_argument("--cv", required=True, help="Path to LaTeX CV file")
    parser.add_argument("--bib", required=True, help="Path to BibTeX file")
    parser.add_argument("--output", "-o", help="Output JSON file (default: stdout)")
    parser.add_argument(
        "--merge",
        "-m",
        help="Existing JSON file to merge with (preserves profile section)",
    )
    parser.add_argument(
        "--indent", type=int, default=2, help="JSON indentation (default: 2)"
    )

    args = parser.parse_args()

    # Validate input files exist
    cv_path = Path(args.cv)
    bib_path = Path(args.bib)

    if not cv_path.exists():
        print(f"Error: CV file not found: {cv_path}", file=sys.stderr)
        sys.exit(1)

    if not bib_path.exists():
        print(f"Error: BibTeX file not found: {bib_path}", file=sys.stderr)
        sys.exit(1)

    # Load existing JSON if merging
    existing_json = None
    if args.merge:
        merge_path = Path(args.merge)
        if merge_path.exists():
            with open(merge_path, "r", encoding="utf-8") as f:
                existing_json = json.load(f)

    # Parse BibTeX
    print(f"Parsing BibTeX: {bib_path}", file=sys.stderr)
    bib_entries = parse_bibtex(str(bib_path))
    print(f"  Found {len(bib_entries)} entries", file=sys.stderr)

    # Parse CV sections
    print(f"Parsing CV: {cv_path}", file=sys.stderr)
    cv_sections = parse_cv_sections(str(cv_path))
    for section, keys in cv_sections.items():
        if keys:
            print(f"  {section}: {len(keys)} entries", file=sys.stderr)

    # Extract non-BibTeX sections from CV
    with open(cv_path, "r", encoding="utf-8") as f:
        cv_content = f.read()

    awards = extract_awards_from_cv(cv_content)
    print(f"  awards: {len(awards)} entries", file=sys.stderr)

    grants = extract_grants_from_cv(cv_content)
    print(f"  grants: {len(grants)} entries", file=sys.stderr)

    invited_talks = extract_invited_talks_from_cv(cv_content)
    print(f"  invited talks: {len(invited_talks)} entries", file=sys.stderr)

    conference_presentations = extract_conference_presentations_from_cv(cv_content)
    print(
        f"  conference presentations: {len(conference_presentations)} entries",
        file=sys.stderr,
    )

    service = extract_service_from_cv(cv_content)
    print(f"  service: {len(service)} entries", file=sys.stderr)

    # Generate JSON
    result = generate_profile_json(
        bib_entries,
        cv_sections,
        awards,
        grants,
        invited_talks,
        conference_presentations,
        service,
        existing_json,
    )

    # Output
    json_output = json.dumps(result, indent=args.indent, ensure_ascii=False)

    if args.output:
        output_path = Path(args.output)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(json_output)
            f.write("\n")
        print(f"Written to: {output_path}", file=sys.stderr)
    else:
        print(json_output)

    # Summary
    print("\nSummary:", file=sys.stderr)
    print(f"  Books: {len(result.get('books', []))}", file=sys.stderr)
    print(f"  Publications: {len(result.get('publications', []))}", file=sys.stderr)
    print(
        f"  Other Field: {len(result.get('otherFieldPublications', []))}",
        file=sys.stderr,
    )
    print(f"  Under Review: {len(result.get('underReview', []))}", file=sys.stderr)
    print(
        f"  Works in Progress: {len(result.get('worksInProgress', []))}",
        file=sys.stderr,
    )
    print(f"  Datasets: {len(result.get('datasets', []))}", file=sys.stderr)
    print(
        f"  Technical Reports: {len(result.get('technicalReports', []))}",
        file=sys.stderr,
    )
    print(f"  Chapters: {len(result.get('chapters', []))}", file=sys.stderr)
    print(f"  Awards: {len(result.get('awards', []))}", file=sys.stderr)
    print(f"  Grants: {len(result.get('grants', []))}", file=sys.stderr)
    print(f"  Invited Talks: {len(result.get('invitedTalks', []))}", file=sys.stderr)
    print(
        f"  Conference Presentations: {len(result.get('conferencePresentations', []))}",
        file=sys.stderr,
    )
    print(f"  Service: {len(result.get('service', []))}", file=sys.stderr)


if __name__ == "__main__":
    main()
