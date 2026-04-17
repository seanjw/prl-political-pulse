import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useReports, useReportContent, useHtmlReportContent } from '../hooks/useReports';
import { usePageTitle } from '../hooks/usePageTitle';
import { HtmlReportRenderer } from '../components/HtmlReportRenderer';

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function Report() {
  const { slug } = useParams<{ slug: string }>();
  const { data: reportsData, loading: reportsLoading } = useReports();

  const article = reportsData.articles.find((a) => a.slug === slug);
  const isHtml = article?.contentType === 'html';

  // Always call both hooks (React rules), pass null to skip
  const { content: mdContent, loading: mdLoading, error: mdError } = useReportContent(isHtml ? null : slug || null);
  const {
    content: htmlContent,
    loading: htmlLoading,
    error: htmlError,
  } = useHtmlReportContent(isHtml ? slug || null : null);

  const contentLoading = isHtml ? htmlLoading : mdLoading;
  const error = isHtml ? htmlError : mdError;

  // Set page title with article title when available
  usePageTitle(article ? article.title : 'Report');

  if (reportsLoading || contentLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-8"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1.25rem' }}>
          Article not found
        </h1>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          The article you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-block px-4 py-2 rounded-lg"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            textDecoration: 'none',
          }}
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <article className={`${isHtml ? 'max-w-[1400px]' : 'max-w-3xl'} mx-auto px-4 py-8`}>
      {/* Back link */}
      <Link
        to="/reports"
        className="inline-flex items-center gap-2 text-sm mb-6 hover:underline"
        style={{ color: 'var(--text-muted)' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Reports
      </Link>

      {/* HTML report — render extracted content inline */}
      {isHtml && htmlContent?.html ? (
        <>
          {/* Category badge + date */}
          <div className="flex items-center gap-3 mb-4">
            <span
              className="inline-block text-xs font-medium px-2 py-1 rounded"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {article.category}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {formatDate(article.date)}
            </span>
          </div>

          {/* Featured image */}
          {article.thumbnail && (
            <img
              src={article.thumbnail}
              alt=""
              className="w-full rounded-lg mb-6 max-h-80 object-cover"
              style={{ border: '1px solid var(--border)' }}
            />
          )}

          {/* White container for Quarto content */}
          <div
            className="rounded-xl"
            style={{
              background: '#ffffff',
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            <HtmlReportRenderer html={htmlContent.html} />
          </div>
        </>
      ) : (
        <>
          {/* Category badge */}
          <span
            className="inline-block text-xs font-medium px-2 py-1 rounded mb-3"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
            }}
          >
            {article.category}
          </span>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            {article.title.replace(/^(Report|Blog|News|Commentary|Research article):\s*/i, '')}
          </h1>

          {/* Date */}
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {formatDate(article.date)}
          </p>

          {/* Featured image */}
          {article.thumbnail && (
            <img
              src={article.thumbnail}
              alt=""
              className="w-full rounded-lg mb-8 max-h-96 object-cover"
              style={{ border: '1px solid var(--border)' }}
            />
          )}

          {/* Markdown content */}
          <div
            className="prose prose-lg dark:prose-invert max-w-none"
            style={{ color: 'var(--text-primary)' }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                img: ({ ...props }) => (
                  <img
                    {...props}
                    className="rounded-lg my-6 max-w-full h-auto"
                    style={{ border: '1px solid var(--border)' }}
                  />
                ),
                a: ({ ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent)' }}
                  />
                ),
                h1: ({ ...props }) => (
                  <h1 {...props} style={{ color: 'var(--text-primary)' }} />
                ),
                h2: ({ ...props }) => (
                  <h2 {...props} style={{ color: 'var(--text-primary)' }} />
                ),
                h3: ({ ...props }) => (
                  <h3 {...props} style={{ color: 'var(--text-primary)' }} />
                ),
                p: ({ ...props }) => (
                  <p {...props} style={{ color: 'var(--text-secondary)' }} />
                ),
                li: ({ ...props }) => (
                  <li {...props} style={{ color: 'var(--text-secondary)' }} />
                ),
                blockquote: ({ ...props }) => (
                  <blockquote
                    {...props}
                    style={{
                      borderLeftColor: 'var(--accent)',
                      color: 'var(--text-muted)',
                    }}
                  />
                ),
              }}
            >
              {mdContent || ''}
            </ReactMarkdown>
          </div>

          {/* Footer */}
          <div
            className="mt-12 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            {article.url && (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                View original article on PRL website
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}

            <Link
              to="/reports"
              className="inline-flex items-center gap-2 text-sm hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Reports
            </Link>
          </div>
        </>
      )}
    </article>
  );
}
