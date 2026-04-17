import { useState, useEffect } from 'react';

export interface Report {
  slug: string;
  title: string;
  description: string;
  url: string;
  date: string;
  thumbnail: string | null;
  category: string;
  markdownFile: string;
  contentType?: 'markdown' | 'html';
  htmlFile?: string;
}

export interface ReportsData {
  lastUpdated: string;
  articles: Report[];
}

const defaultData: ReportsData = {
  lastUpdated: '',
  articles: [],
};

/**
 * Hook to fetch the reports index
 */
export function useReports() {
  const [data, setData] = useState<ReportsData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReports() {
      try {
        const response = await fetch('/news/index.json');
        if (!response.ok) {
          throw new Error('Failed to fetch reports');
        }
        const json: ReportsData = await response.json();
        setData(json);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load reports:', err);
        setError(err instanceof Error ? err.message : 'Failed to load reports');
        setLoading(false);
      }
    }

    fetchReports();
  }, []);

  return { data, loading, error };
}

/**
 * Hook to fetch individual report content (markdown)
 */
export function useReportContent(slug: string | null) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setContent(null);
      return;
    }

    setLoading(true);
    setError(null);

    async function fetchContent() {
      try {
        const response = await fetch(`/news/articles/${slug}.md`);
        if (!response.ok) {
          throw new Error('Article not found');
        }
        const text = await response.text();

        // Remove frontmatter if present
        const contentWithoutFrontmatter = text.replace(/^---[\s\S]*?---\n*/, '');
        setContent(contentWithoutFrontmatter);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load article:', err);
        setError(err instanceof Error ? err.message : 'Failed to load article');
        setLoading(false);
      }
    }

    fetchContent();
  }, [slug]);

  return { content, loading, error };
}

/**
 * Hook to fetch individual HTML report content
 */
export function useHtmlReportContent(slug: string | null) {
  const [content, setContent] = useState<{ styles: string; body: string; html: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setContent(null);
      return;
    }

    setLoading(true);
    setError(null);

    async function fetchContent() {
      try {
        const response = await fetch(`/news/html/${slug}.html`);
        if (!response.ok) {
          throw new Error('HTML report not found');
        }
        const text = await response.text();

        // Parse the HTML to extract styles and body (legacy)
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        const styleTags = doc.querySelectorAll('style');
        const styles = Array.from(styleTags)
          .map((s) => s.textContent || '')
          .join('\n');

        const body = doc.body?.innerHTML || text;

        setContent({ styles, body, html: text });
        setLoading(false);
      } catch (err) {
        console.error('Failed to load HTML report:', err);
        setError(err instanceof Error ? err.message : 'Failed to load HTML report');
        setLoading(false);
      }
    }

    fetchContent();
  }, [slug]);

  return { content, loading, error };
}
