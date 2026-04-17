import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { TeachingEvaluation } from '../../../types/admin';

// Use bundled worker
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

async function extractText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pages.join('\n');
}

function extractMean(text: string, pattern: string): number | undefined {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(escaped + '[\\s\\S]{0,200}?[Mm]ean[:\\s]+([0-9]+\\.?[0-9]*)', 'i'),
    new RegExp(escaped + '[\\s:]+([0-9]+\\.[0-9]+)', 'i'),
    new RegExp(escaped + '[^\\n]{0,100}?(\\d\\.\\d{1,2})', 'i'),
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (match?.[1]) {
      const val = parseFloat(match[1]);
      if (val >= 1 && val <= 5) return val;
    }
  }
  return undefined;
}

function extractComments(text: string): string[] {
  // Dartmouth evals have a detailed section later in the PDF with the actual comments:
  //   Question: Comment on 1-3 things that the professor did well...
  //   1.00
  //   [comment text]
  //   2.00
  //   [comment text]
  // The summary section just says "View Responses" — we need the detailed section.

  // Look for the detailed question section (starts with "Question:" prefix)
  const pattern = /Question:\s*Comment on 1[\s-]*3 things that the professor did well[^:]*:/i;
  const match = text.match(pattern);
  if (!match?.index) return [];

  const start = match.index + match[0].length;

  // Find the end — next "Course:" or "Question:" header (no line-start requirement for pdfjs compat)
  const rest = text.slice(start);
  const nextSection = rest.search(/Course:|Question:/i);
  const section = nextSection > 0 ? rest.slice(0, nextSection) : rest.slice(0, 5000);

  // Extract numbered entries (1.00, 2.00, ...) sequentially, stop if numbers restart
  const comments: string[] = [];
  const entryPattern = /\b(\d+)\.00\b/g;
  let entryMatch: RegExpExecArray | null;
  let lastNum = 0;
  const positions: { num: number; start: number }[] = [];
  while ((entryMatch = entryPattern.exec(section)) !== null) {
    const num = parseInt(entryMatch[1]);
    if (num <= lastNum) break; // numbers restarted — new section
    lastNum = num;
    positions.push({ num, start: entryMatch.index + entryMatch[0].length });
  }

  for (let i = 0; i < positions.length; i++) {
    const textStart = positions[i].start;
    const textEnd = i + 1 < positions.length
      ? section.lastIndexOf(String(positions[i + 1].num), positions[i + 1].start)
      : section.length;
    const cleaned = section.slice(textStart, textEnd).replace(/\s+/g, ' ').trim();
    if (cleaned.length > 5) {
      comments.push(cleaned);
    }
  }

  return comments;
}

export async function parseTeachingEvaluation(
  file: File
): Promise<Partial<Pick<TeachingEvaluation, 'courseQualityMean' | 'teachingEffectivenessMean' | 'positiveComments'>>> {
  const text = await extractText(file);

  const courseQualityMean = extractMean(
    text,
    'I think the overall quality of the course was'
  );
  const teachingEffectivenessMean = extractMean(
    text,
    'I think the overall effectiveness of the teaching was'
  );
  const positiveComments = extractComments(text);

  return {
    courseQualityMean,
    teachingEffectivenessMean,
    positiveComments: positiveComments.length > 0 ? positiveComments : undefined,
  };
}
