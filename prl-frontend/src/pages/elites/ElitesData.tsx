import { Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';

const DATA_DOWNLOADS = [
  {
    title: 'Aggregated Legislator Profiles',
    description: 'Profiles for currently serving legislators with rhetorical category breakdowns.',
    format: 'ZIP (CSV)',
    url: '/data/elite/profiles.zip',
    size: '~5 MB',
  },
  {
    title: 'Aggregated Legislator Profiles (All National)',
    description: 'Profiles for all national legislators, including former members of Congress.',
    format: 'ZIP (CSV)',
    url: '/data/elite/profiles-all-national.zip',
    size: '317 KB',
  },
  {
    title: 'Classified Statements',
    description: 'Classified statements for currently serving legislators with source, date, and category labels.',
    format: 'ZIP (CSV)',
    url: '/data/elite/rhetoric-all.zip',
    size: '~100 MB',
  },
  {
    title: 'Classified Statements (All National)',
    description: 'Classified statements for all national legislators, including former members of Congress.',
    format: 'ZIP (CSV)',
    url: '/data/elite/rhetoric-all-national.zip',
    size: '461 MB',
  },
];

export function ElitesData() {
  usePageTitle('Elites Data Downloads');
  return (
    <div>
      <div className="mb-8">
        <Link
          to="/elites"
          className="inline-flex items-center gap-2 mb-4 text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>
          Download Data
        </h1>
        <p className="text-lg" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          Download our congressional rhetoric datasets for your own research and analysis.
          All data is provided under a Creative Commons Attribution license.
        </p>
      </div>

      {/* Download Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {DATA_DOWNLOADS.map((download, index) => (
          <div
            key={index}
            className="p-6 rounded-xl"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
          >
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {download.title}
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {download.description}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>{download.format}</span>
                <span>{download.size}</span>
              </div>
              <a
                href={download.url}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{ background: '#2563eb', color: '#fff', textDecoration: 'none' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Data Dictionary */}
      <div
        className="p-6 rounded-xl mb-8"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
          Data Dictionary
        </h2>
        <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
          Key fields included in the classified statements datasets:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th className="text-left py-2 px-3" style={{ color: 'var(--text-primary)' }}>Field</th>
                <th className="text-left py-2 px-3" style={{ color: 'var(--text-primary)' }}>Type</th>
                <th className="text-left py-2 px-3" style={{ color: 'var(--text-primary)' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-primary)' }}>source_id</td>
                <td className="py-2 px-3" style={{ color: 'var(--text-muted)' }}>string</td>
                <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>Unique identifier for the legislator</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-primary)' }}>date</td>
                <td className="py-2 px-3" style={{ color: 'var(--text-muted)' }}>date</td>
                <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>Date of the statement</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-primary)' }}>source_type</td>
                <td className="py-2 px-3" style={{ color: 'var(--text-muted)' }}>string</td>
                <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>Source of statement (floor, newsletter, press, twitter)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-primary)' }}>text</td>
                <td className="py-2 px-3" style={{ color: 'var(--text-muted)' }}>string</td>
                <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>The statement text</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-primary)' }}>category</td>
                <td className="py-2 px-3" style={{ color: 'var(--text-muted)' }}>string</td>
                <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>Classified rhetorical category</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono" style={{ color: 'var(--text-primary)' }}>confidence</td>
                <td className="py-2 px-3" style={{ color: 'var(--text-muted)' }}>float</td>
                <td className="py-2 px-3" style={{ color: 'var(--text-secondary)' }}>Model confidence score (0-1)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Citation */}
      <div
        className="p-6 rounded-xl"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
          Citation
        </h2>
        <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
          If you use this data in your research, please cite:
        </p>
        <div
          className="p-4 rounded-lg font-mono text-sm"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
          America's Political Pulse. (2024). Congressional Rhetoric Dataset.
          Available at: https://americaspoliticalpulse.com/elites/data
        </div>
      </div>
    </div>
  );
}
