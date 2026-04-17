/**
 * CV Parser - Parses LaTeX CV and BibTeX files to generate profile JSON
 * Browser-compatible TypeScript implementation
 */

import type { ProfileData, Publication, Award, ProfileBook, Chapter, Grant, InvitedTalk, ConferencePresentation, ServiceItem } from '../../../types/admin';

// =============================================================================
// LaTeX Text Cleaning
// =============================================================================

function stripLatexComments(text: string): string {
  return text.split('\n').map(line => {
    const stripped = line.trimStart();
    if (stripped.startsWith('%')) return '';
    // Remove inline comments (unescaped %)
    let result = '';
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '%' && (i === 0 || line[i - 1] !== '\\')) break;
      result += line[i];
    }
    return result;
  }).join('\n');
}

function cleanLatex(text: string): string {
  if (!text) return '';

  // Remove {\textbf{...}} patterns
  text = text.replace(/\{\\textbf\{([^}]+)\}\}/g, '$1');
  text = text.replace(/\\textbf\{([^}]+)\}/g, '$1');
  text = text.replace(/\\textbf([A-Za-z])/g, '$1');

  // Convert \uppercase{X} to uppercase X
  text = text.replace(/\\uppercase\{([^}]+)\}/g, (_, p1) => p1.toUpperCase());

  // Handle escaped special characters
  text = text.replace(/\\&/g, '&');
  text = text.replace(/\\%/g, '%');
  text = text.replace(/\\_/g, '_');
  text = text.replace(/\\#/g, '#');
  text = text.replace(/\\$/g, '$');

  // Remove escaped braces and standalone braces
  text = text.replace(/\\{/g, '').replace(/\\}/g, '');
  text = text.replace(/\{([^{}]+)\}/g, '$1');

  // Normalize dashes and clean whitespace
  text = text.replace(/--/g, '–');
  text = text.replace(/~+/g, ' ');
  text = text.replace(/\s+/g, ' ');

  return text.trim();
}

function cleanAuthorString(authors: string): string {
  if (!authors) return '';
  authors = cleanLatex(authors);
  authors = authors.replace(/\s+and\s+/gi, ', & ');
  authors = authors.replace(/,\s*,/g, ',');
  return authors.trim();
}

// =============================================================================
// BibTeX Parser
// =============================================================================

interface BibEntry {
  type: string;
  key: string;
  [field: string]: string;
}

/**
 * Extract balanced braces content starting at position i (after opening brace)
 */
function extractBracedContent(text: string, startIdx: number): { content: string; endIdx: number } | null {
  let depth = 1;
  let i = startIdx;
  while (i < text.length && depth > 0) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
    i++;
  }
  if (depth !== 0) return null;
  return { content: text.slice(startIdx, i - 1), endIdx: i };
}

function parseBibtex(content: string): Record<string, BibEntry> {
  const entries: Record<string, BibEntry> = {};

  // Match @type{key, ... } - find entry starts
  const entryStartRegex = /@(\w+)\s*\{\s*([^,]+)\s*,/g;
  let match;

  while ((match = entryStartRegex.exec(content)) !== null) {
    const [fullMatch, type, key] = match;
    const entry: BibEntry = { type: type.toLowerCase(), key: key.trim() };

    // Find the end of this entry by counting braces
    const entryStart = match.index + fullMatch.length;
    let braceDepth = 1;
    let entryEnd = entryStart;
    while (entryEnd < content.length && braceDepth > 0) {
      if (content[entryEnd] === '{') braceDepth++;
      else if (content[entryEnd] === '}') braceDepth--;
      entryEnd++;
    }

    const fields = content.slice(entryStart, entryEnd - 1);

    // Parse fields with proper brace matching
    const fieldNameRegex = /(\w+)\s*=\s*/g;
    let fieldMatch;

    while ((fieldMatch = fieldNameRegex.exec(fields)) !== null) {
      const fieldName = fieldMatch[1].toLowerCase();
      const valueStart = fieldMatch.index + fieldMatch[0].length;
      let value = '';

      if (fields[valueStart] === '{') {
        // Braced value - extract with balanced braces
        const extracted = extractBracedContent(fields, valueStart + 1);
        if (extracted) {
          value = extracted.content;
          fieldNameRegex.lastIndex = extracted.endIdx;
        }
      } else if (fields[valueStart] === '"') {
        // Quoted value
        const endQuote = fields.indexOf('"', valueStart + 1);
        if (endQuote !== -1) {
          value = fields.slice(valueStart + 1, endQuote);
          fieldNameRegex.lastIndex = endQuote + 1;
        }
      } else {
        // Bare value (number or string without delimiters)
        const bareMatch = /^(\w+)/.exec(fields.slice(valueStart));
        if (bareMatch) {
          value = bareMatch[1];
          fieldNameRegex.lastIndex = valueStart + bareMatch[1].length;
        }
      }

      entry[fieldName] = cleanLatex(value);
    }

    entries[key.trim()] = entry;
  }

  return entries;
}

// =============================================================================
// CV Section Extraction
// =============================================================================

interface PublicationKeyWithNotes {
  key: string;
  withStudent?: boolean;
  mediaCoverage?: string;
  reviewedIn?: string;
}

function extractPublicationKeysWithNotes(cvContent: string, sectionName: string): PublicationKeyWithNotes[] {
  const cleaned = stripLatexComments(cvContent);
  const sectionRegex = new RegExp(`\\\\section\\*?\\{${sectionName}[^}]*\\}`, 'i');
  const match = sectionRegex.exec(cleaned);
  if (!match) return [];

  const start = match.index + match[0].length;
  const nextSection = cleaned.slice(start).search(/\\section\*?\{/);
  const end = nextSection !== -1 ? start + nextSection : cleaned.length;
  const sectionText = cleaned.slice(start, end);

  const results: PublicationKeyWithNotes[] = [];
  // Match publication and capture everything until next \item or \publication or end
  const pubRegex = /\\publication\{([^}]+)\}([\s\S]*?)(?=\\item|\\publication\{|$)/g;
  let pubMatch;
  while ((pubMatch = pubRegex.exec(sectionText)) !== null) {
    const key = pubMatch[1];
    const afterText = pubMatch[2] || '';

    const entry: PublicationKeyWithNotes = { key };

    // Check for "written with a student" note
    if (/\*?\s*written with a student/i.test(afterText)) {
      entry.withStudent = true;
    }

    // Extract "Covered in:" media coverage
    const coveredMatch = /\\textbf\{Covered in:\}\s*([^\n\\]+)/i.exec(afterText);
    if (coveredMatch) {
      entry.mediaCoverage = cleanLatex(coveredMatch[1].trim());
    }

    // Extract "Reviewed in:" for books
    const reviewedMatch = /\\textbf\{Reviewed in:\}\s*([^\n\\]+)/i.exec(afterText);
    if (reviewedMatch) {
      entry.reviewedIn = cleanLatex(reviewedMatch[1].trim());
    }

    results.push(entry);
  }
  return results;
}

function extractPublicationKeys(cvContent: string, sectionName: string): string[] {
  return extractPublicationKeysWithNotes(cvContent, sectionName).map(p => p.key);
}

function extractAwards(cvContent: string): Award[] {
  const cleaned = stripLatexComments(cvContent);
  const awards: Award[] = [];

  const match = /\\section\*?\{Awards\}/i.exec(cleaned);
  if (!match) return awards;

  const start = match.index + match[0].length;
  const nextSection = cleaned.slice(start).search(/\\section\*?\{/);
  const end = nextSection !== -1 ? start + nextSection : cleaned.length;
  const sectionText = cleaned.slice(start, end);

  const workEntryRegex = /\\WorkEntry\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{[^}]*\}/g;
  let entryMatch;
  while ((entryMatch = workEntryRegex.exec(sectionText)) !== null) {
    const [, name, institution, year] = entryMatch;
    awards.push({
      name: cleanLatex(name),
      institution: cleanLatex(institution),
      year: parseInt(year) || new Date().getFullYear(),
    });
  }
  return awards;
}

function extractGrants(cvContent: string): Grant[] {
  const cleaned = stripLatexComments(cvContent);
  const grants: Grant[] = [];

  const match = /\\section\*?\{Grants[^}]*\}/i.exec(cleaned);
  if (!match) return grants;

  const start = match.index + match[0].length;
  const nextSection = cleaned.slice(start).search(/\\section\*?\{/);
  const end = nextSection !== -1 ? start + nextSection : cleaned.length;
  const sectionText = cleaned.slice(start, end);

  const workEntryRegex = /\\WorkEntry\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}\{[^}]*\}/g;
  let entryMatch;
  while ((entryMatch = workEntryRegex.exec(sectionText)) !== null) {
    const [, title, funder, details] = entryMatch;

    let role = '';
    let amount = '';
    let year = '';

    const roleMatch = /^(PI|Co-PI)\s*-?\s*/.exec(details);
    if (roleMatch) role = roleMatch[1];

    const amountMatch = /\$([0-9,]+)/.exec(details);
    if (amountMatch) amount = `$${amountMatch[1]}`;

    const yearMatch = /(\d{4}(?:-\d{4})?)/.exec(details);
    if (yearMatch) year = yearMatch[1];

    grants.push({
      title: cleanLatex(title).replace(/``|''/g, ''),
      funder: cleanLatex(funder),
      role,
      amount,
      year,
    });
  }
  return grants;
}

function extractInvitedTalks(cvContent: string): InvitedTalk[] {
  const cleaned = stripLatexComments(cvContent);
  const talks: InvitedTalk[] = [];

  const match = /\\section\*?\{Invited Talks\}/i.exec(cleaned);
  if (!match) return talks;

  const start = match.index + match[0].length;
  const nextSection = cleaned.slice(start).search(/\\section\*?\{/);
  const end = nextSection !== -1 ? start + nextSection : cleaned.length;
  const sectionText = cleaned.slice(start, end);

  const itemRegex = /\\item\s+(.+?)(?=\\item|\\end\{itemize\}|$)/gs;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(sectionText)) !== null) {
    const item = itemMatch[1].trim();
    if (!item) continue;

    const yearMatch = /\b(\d{4})\s*$/.exec(item);
    if (yearMatch) {
      talks.push({
        institution: cleanLatex(item.slice(0, yearMatch.index)).replace(/[,-]+$/, '').trim(),
        year: parseInt(yearMatch[1]),
      });
    }
  }
  return talks;
}

function extractConferencePresentations(cvContent: string): ConferencePresentation[] {
  const cleaned = stripLatexComments(cvContent);
  const presentations: ConferencePresentation[] = [];

  const match = /\\section\*?\{Conference Presentations\}/i.exec(cleaned);
  if (!match) return presentations;

  const start = match.index + match[0].length;
  const nextSection = cleaned.slice(start).search(/\\section\*?\{/);
  const end = nextSection !== -1 ? start + nextSection : cleaned.length;
  const sectionText = cleaned.slice(start, end);

  const itemRegex = /\\item\s+(.+?)(?=\\item|\\end\{itemize\}|$)/gs;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(sectionText)) !== null) {
    const item = itemMatch[1].trim();
    if (!item || !item.includes(':')) continue;

    const [confPart, yearsPart] = item.split(':', 2);
    const conference = cleanLatex(confPart).trim();

    // Parse years with optional counts
    const yearRegex = /(\d{4})(?:\s*\((\d+)\))?/g;
    let yearMatch;
    while ((yearMatch = yearRegex.exec(yearsPart)) !== null) {
      const count = yearMatch[2] ? parseInt(yearMatch[2]) : 1;
      for (let i = 0; i < count; i++) {
        presentations.push({ conference, year: parseInt(yearMatch[1]) });
      }
    }
  }
  return presentations;
}

function extractService(cvContent: string): ServiceItem[] {
  const cleaned = stripLatexComments(cvContent);
  const service: ServiceItem[] = [];

  const match = /\\section\*?\{Service\}/i.exec(cleaned);
  if (!match) return service;

  const start = match.index + match[0].length;
  const nextSection = cleaned.slice(start).search(/\\section\*?\{/);
  const end = nextSection !== -1 ? start + nextSection : cleaned.length;
  const sectionText = cleaned.slice(start, end);

  const itemRegex = /\\item\s+(.+?)(?=\\item|\\end\{itemize\}|$)/gs;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(sectionText)) !== null) {
    let item = cleanLatex(itemMatch[1].trim());
    if (!item) continue;

    let year = '';
    const yearMatch = /\((\d{4})-?\)?/.exec(item);
    if (yearMatch) {
      year = yearMatch[1] + '-';
      item = item.slice(0, yearMatch.index).trim();
    }

    if (item) service.push({ role: item, year });
  }
  return service;
}

// =============================================================================
// BibTeX to Publication Conversion
// =============================================================================

function bibtexToPublication(entry: BibEntry): Publication {
  const pub: Publication = {
    authors: cleanAuthorString(entry.author || ''),
    title: cleanLatex(entry.title || ''),
    year: entry.year || '',
    citationKey: entry.key, // Store the BibTeX citation key for matching
  };

  if (entry.journal) pub.journal = cleanLatex(entry.journal);
  if (entry.volume) pub.volume = entry.volume;
  if (entry.pages) pub.pages = entry.pages.replace(/--/g, '–');
  if (entry.url || entry.doi) pub.url = entry.url || (entry.doi ? `https://doi.org/${entry.doi}` : undefined);

  return pub;
}

function bibtexToBook(entry: BibEntry): ProfileBook {
  return {
    title: cleanLatex(entry.title || ''),
    authors: cleanAuthorString(entry.author || ''),
    year: parseInt(entry.year) || new Date().getFullYear(),
    publisher: cleanLatex(entry.publisher || ''),
    url: entry.url,
    citationKey: entry.key, // Store the BibTeX citation key for matching
  };
}

function bibtexToChapter(entry: BibEntry): Chapter {
  return {
    title: cleanLatex(entry.title || ''),
    authors: cleanAuthorString(entry.author || ''),
    year: parseInt(entry.year) || new Date().getFullYear(),
    book: cleanLatex(entry.booktitle || ''),
    editors: cleanLatex(entry.editor || ''),
    publisher: cleanLatex(entry.publisher || ''),
    url: entry.url,
    citationKey: entry.key, // Store the BibTeX citation key for matching
  };
}

// =============================================================================
// URL Preservation Helper (matches by BibTeX citation key)
// =============================================================================

/**
 * Creates a lookup map of existing URLs by citation key
 * Falls back to normalized title if citation key is not available
 */
function buildUrlLookup(publications: Publication[] | undefined): Map<string, string> {
  const lookup = new Map<string, string>();
  if (!publications) return lookup;

  for (const pub of publications) {
    if (pub.url) {
      // Primary: match by citation key
      if (pub.citationKey) {
        lookup.set(`key:${pub.citationKey}`, pub.url);
      }
      // Fallback: match by normalized title
      const normalizedTitle = pub.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
      lookup.set(`title:${normalizedTitle}`, pub.url);
    }
  }
  return lookup;
}

/**
 * Preserves URL from existing data if the new publication doesn't have one
 * Matches by citation key first, then falls back to title
 */
function preserveUrl(pub: Publication, urlLookup: Map<string, string>): Publication {
  if (pub.url) return pub; // Already has a URL from BibTeX

  // Try matching by citation key first
  if (pub.citationKey) {
    const urlByKey = urlLookup.get(`key:${pub.citationKey}`);
    if (urlByKey) {
      return { ...pub, url: urlByKey };
    }
  }

  // Fall back to title matching
  const normalizedTitle = pub.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const urlByTitle = urlLookup.get(`title:${normalizedTitle}`);
  if (urlByTitle) {
    return { ...pub, url: urlByTitle };
  }

  return pub;
}

/**
 * Same for books - matches by citation key first, then title
 */
function preserveBookUrl(book: ProfileBook, existing: ProfileBook[] | undefined): ProfileBook {
  if (book.url || !existing) return book;

  // Try matching by citation key first
  if (book.citationKey) {
    const match = existing.find(b => b.citationKey === book.citationKey);
    if (match?.url) {
      return { ...book, url: match.url };
    }
  }

  // Fall back to title matching
  const normalizedTitle = book.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const match = existing.find(b =>
    b.title.toLowerCase().replace(/[^\w\s]/g, '').trim() === normalizedTitle
  );

  if (match?.url) {
    return { ...book, url: match.url };
  }
  return book;
}

/**
 * Same for chapters - matches by citation key first, then title
 */
function preserveChapterUrl(chapter: Chapter, existing: Chapter[] | undefined): Chapter {
  if (chapter.url || !existing) return chapter;

  // Try matching by citation key first
  if (chapter.citationKey) {
    const match = existing.find(c => c.citationKey === chapter.citationKey);
    if (match?.url) {
      return { ...chapter, url: match.url };
    }
  }

  // Fall back to title matching
  const normalizedTitle = chapter.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const match = existing.find(c =>
    c.title.toLowerCase().replace(/[^\w\s]/g, '').trim() === normalizedTitle
  );

  if (match?.url) {
    return { ...chapter, url: match.url };
  }
  return chapter;
}

// =============================================================================
// Main Parser Function
// =============================================================================

export interface ParseResult {
  data: Partial<ProfileData>;
  summary: {
    books: number;
    publications: number;
    otherFieldPublications: number;
    underReview: number;
    worksInProgress: number;
    datasets: number;
    technicalReports: number;
    chapters: number;
    awards: number;
    grants: number;
    invitedTalks: number;
    conferencePresentations: number;
    service: number;
  };
  warnings: string[];
}

export function parseCV(cvContent: string, bibContent: string, existingData?: ProfileData): ParseResult {
  const warnings: string[] = [];
  const bibEntries = parseBibtex(bibContent);

  // Extract publication keys with notes from CV sections
  const bookKeysWithNotes = extractPublicationKeysWithNotes(cvContent, 'Books');
  const pubKeysWithNotes = extractPublicationKeysWithNotes(cvContent, 'Publications');
  const underReviewKeysWithNotes = extractPublicationKeysWithNotes(cvContent, 'Under Review');
  const wipKeysWithNotes = extractPublicationKeysWithNotes(cvContent, 'Work in Progress');
  const datasetKeys = extractPublicationKeys(cvContent, 'Datasets');
  const techReportKeys = extractPublicationKeys(cvContent, 'White Paper Reports') ||
                         extractPublicationKeys(cvContent, 'Technical Reports');
  const chapterKeys = extractPublicationKeys(cvContent, 'Chapter');

  // Check for "Other Fields" subsection in publications
  const cleaned = stripLatexComments(cvContent);
  const otherFieldsMatch = /\\subsection\*?\{[^}]*Other\s+Field[^}]*\}/i.exec(cleaned);
  let mainPubKeysWithNotes = pubKeysWithNotes;
  let otherFieldKeysWithNotes: PublicationKeyWithNotes[] = [];

  if (otherFieldsMatch) {
    const pubMatch = /\\section\*?\{Publications[^}]*\}/i.exec(cleaned);
    if (pubMatch) {
      const pubStart = pubMatch.index + pubMatch[0].length;
      const nextSection = cleaned.slice(pubStart).search(/\\section\*?\{/);
      const pubEnd = nextSection !== -1 ? pubStart + nextSection : cleaned.length;
      const pubText = cleaned.slice(pubStart, pubEnd);

      const subsectionIdx = pubText.search(/\\subsection\*?\{[^}]*Other\s+Field[^}]*\}/i);
      if (subsectionIdx !== -1) {
        const mainText = pubText.slice(0, subsectionIdx);
        const otherText = pubText.slice(subsectionIdx);

        // Re-extract with notes for the split sections
        const mainKeys = [...mainText.matchAll(/\\publication\{([^}]+)\}/g)].map(m => m[1]);
        const otherKeys = [...otherText.matchAll(/\\publication\{([^}]+)\}/g)].map(m => m[1]);

        // Filter the already extracted notes by these keys
        mainPubKeysWithNotes = mainPubKeysWithNotes.filter(p => mainKeys.includes(p.key));
        otherFieldKeysWithNotes = pubKeysWithNotes.filter(p => otherKeys.includes(p.key));
      }
    }
  }

  // Build URL lookups from existing data to preserve manually-added URLs
  const pubUrlLookup = buildUrlLookup(existingData?.publications);
  const otherFieldUrlLookup = buildUrlLookup(existingData?.otherFieldPublications);
  const underReviewUrlLookup = buildUrlLookup(existingData?.underReview);
  const wipUrlLookup = buildUrlLookup(existingData?.worksInProgress);
  const datasetUrlLookup = buildUrlLookup(existingData?.datasets);
  const techReportUrlLookup = buildUrlLookup(existingData?.technicalReports);

  // Build status lookup to preserve R&R status from existing data
  const statusLookup = new Map<string, 'R&R' | 'Under Review'>();
  existingData?.underReview?.forEach(pub => {
    if (pub.status && pub.citationKey) {
      statusLookup.set(pub.citationKey, pub.status);
    }
  });

  // Convert BibTeX entries to books, preserving existing URLs and adding notes
  const books = bookKeysWithNotes
    .filter(({ key }) => bibEntries[key])
    .map(({ key, reviewedIn }) => {
      const book = preserveBookUrl(bibtexToBook(bibEntries[key]), existingData?.books);
      if (reviewedIn) book.reviewedIn = reviewedIn;
      return book;
    });

  // Convert BibTeX entries to publications, preserving existing URLs and adding notes
  const publications = mainPubKeysWithNotes
    .filter(({ key }) => bibEntries[key])
    .map(({ key, withStudent, mediaCoverage }) => {
      const pub = preserveUrl(bibtexToPublication(bibEntries[key]), pubUrlLookup);
      if (withStudent) pub.withStudent = true;
      if (mediaCoverage) pub.mediaCoverage = mediaCoverage;
      return pub;
    });

  const otherFieldPublications = otherFieldKeysWithNotes
    .filter(({ key }) => bibEntries[key])
    .map(({ key, withStudent, mediaCoverage }) => {
      const pub = preserveUrl(bibtexToPublication(bibEntries[key]), otherFieldUrlLookup);
      if (withStudent) pub.withStudent = true;
      if (mediaCoverage) pub.mediaCoverage = mediaCoverage;
      return pub;
    });

  const underReview = underReviewKeysWithNotes
    .filter(({ key }) => bibEntries[key])
    .map(({ key, withStudent, mediaCoverage }) => {
      let pub = bibtexToPublication(bibEntries[key]);
      const journal = bibEntries[key].journal || '';

      // Detect R&R status from BibTeX journal field
      if (/revise and resubmit|r&r/i.test(journal)) {
        pub.status = 'R&R';
        const journalMatch = /(?:revise and resubmit|r&r)\s*(?:at|,)?\s*(.+)/i.exec(journal);
        if (journalMatch) pub.journal = journalMatch[1].trim();
      } else if (/review/i.test(journal)) {
        pub.status = 'Under Review';
      }

      // Preserve R&R status from existing data if not detected from BibTeX
      if (!pub.status && pub.citationKey && statusLookup.has(pub.citationKey)) {
        pub.status = statusLookup.get(pub.citationKey);
      }

      // Preserve URL from existing data
      pub = preserveUrl(pub, underReviewUrlLookup);

      // Add notes from LaTeX
      if (withStudent) pub.withStudent = true;
      if (mediaCoverage) pub.mediaCoverage = mediaCoverage;

      return pub;
    });

  const worksInProgress = wipKeysWithNotes
    .filter(({ key }) => bibEntries[key])
    .map(({ key, withStudent, mediaCoverage }) => {
      const pub = preserveUrl(bibtexToPublication(bibEntries[key]), wipUrlLookup);
      if (withStudent) pub.withStudent = true;
      if (mediaCoverage) pub.mediaCoverage = mediaCoverage;
      return pub;
    });

  const datasets = datasetKeys
    .filter(key => bibEntries[key])
    .map(key => preserveUrl(bibtexToPublication(bibEntries[key]), datasetUrlLookup));

  const technicalReports = techReportKeys
    .filter(key => bibEntries[key])
    .map(key => preserveUrl(bibtexToPublication(bibEntries[key]), techReportUrlLookup));

  const chapters = chapterKeys
    .filter(key => bibEntries[key])
    .map(key => preserveChapterUrl(bibtexToChapter(bibEntries[key]), existingData?.chapters));

  // Extract non-BibTeX sections
  const awards = extractAwards(cvContent);
  const grants = extractGrants(cvContent);
  const invitedTalks = extractInvitedTalks(cvContent);
  const conferencePresentations = extractConferencePresentations(cvContent);
  const service = extractService(cvContent);

  // Check for missing BibTeX entries
  const allKeys = [
    ...bookKeysWithNotes.map(p => p.key),
    ...pubKeysWithNotes.map(p => p.key),
    ...underReviewKeysWithNotes.map(p => p.key),
    ...wipKeysWithNotes.map(p => p.key),
    ...datasetKeys,
    ...techReportKeys,
    ...chapterKeys
  ];
  const missingKeys = allKeys.filter(key => !bibEntries[key]);
  if (missingKeys.length > 0) {
    warnings.push(`Missing BibTeX entries: ${missingKeys.join(', ')}`);
  }

  // Build result, preserving existing profile data
  const result: Partial<ProfileData> = {
    profile: existingData?.profile,
    books,
    publications,
    otherFieldPublications,
    underReview,
    worksInProgress,
    datasets,
    technicalReports,
    chapters,
    awards,
    grants,
    invitedTalks,
    conferencePresentations,
    service,
  };

  return {
    data: result,
    summary: {
      books: books.length,
      publications: publications.length,
      otherFieldPublications: otherFieldPublications.length,
      underReview: underReview.length,
      worksInProgress: worksInProgress.length,
      datasets: datasets.length,
      technicalReports: technicalReports.length,
      chapters: chapters.length,
      awards: awards.length,
      grants: grants.length,
      invitedTalks: invitedTalks.length,
      conferencePresentations: conferencePresentations.length,
      service: service.length,
    },
    warnings,
  };
}
