import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useReports } from '../hooks/useReports';
import type { Report } from '../hooks/useReports';
import { usePageTitle } from '../hooks/usePageTitle';

function ReportCard({ report }: { report: Report }) {
  const { isDarkMode } = useTheme();

  return (
    <Link
      to={`/report/${report.slug}`}
      className="block rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
      style={{
        background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
        border: '1px solid var(--border)',
      }}
    >
      {report.thumbnail && (
        <div className="aspect-video overflow-hidden">
          <img
            src={report.thumbnail}
            alt={report.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex gap-1.5 mb-2">
          <span
            className="inline-block px-2 py-0.5 rounded text-xs font-medium"
            style={{
              background: 'var(--accent)',
              color: '#ffffff',
            }}
          >
            {report.category}
          </span>
          {report.contentType === 'html' && (
            <span
              className="inline-block px-2 py-0.5 rounded text-xs font-medium"
              style={{ background: '#8b5cf6', color: '#ffffff' }}
            >
              Interactive
            </span>
          )}
        </div>
        <h3
          className="font-bold text-base mb-2 line-clamp-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {report.title}
        </h3>
        <p
          className="text-sm line-clamp-3 mb-3"
          style={{ color: 'var(--text-secondary)' }}
        >
          {report.description}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {new Date(report.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>
    </Link>
  );
}

export function Reports() {
  usePageTitle('Reports');
  const { data, loading, error } = useReports();

  // Show all articles
  const reports = data.articles;

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl overflow-hidden">
                <div className="aspect-video bg-gray-300"></div>
                <div className="p-4">
                  <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
                  <div className="h-5 bg-gray-300 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12">
        <div className="text-center py-12">
          <p style={{ color: 'var(--text-secondary)' }}>
            Failed to load reports. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12">
      <div className="mb-8">
        <h1
          className="font-bold mb-2"
          style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}
        >
          Reports
        </h1>
        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
          Research reports and findings from the Polarization Research Lab.
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
          {reports.length} reports available
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => (
          <ReportCard key={report.slug} report={report} />
        ))}
      </div>
    </div>
  );
}
