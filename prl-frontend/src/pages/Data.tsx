import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { Tabs, TabPanel } from '../components/Tabs';

// Data files served via CloudFront
const DATA_BASE = '/data';
const TOPLINES_BASE = '/toplines';

interface ToplineWave {
  wave: number;
  file: string;
}

interface ToplineCountry {
  country: string;
  code: string;
  waves: number[];
}

interface ToplinesIndex {
  us_waves: ToplineWave[];
  international: Record<string, number[]>;
}

const COUNTRY_NAMES: Record<string, string> = {
  brazil: 'Brazil',
  germany: 'Germany',
  india: 'India',
  israel: 'Israel',
  poland: 'Poland',
};

function useToplinesIndex() {
  const [usWaves, setUsWaves] = useState<ToplineWave[]>([]);
  const [internationalToplines, setInternationalToplines] = useState<ToplineCountry[]>([]);

  useEffect(() => {
    fetch(`${TOPLINES_BASE}/index.json`)
      .then(res => res.json())
      .then((data: ToplinesIndex) => {
        setUsWaves(data.us_waves);
        setInternationalToplines(
          Object.entries(data.international).map(([code, waves]) => ({
            country: COUNTRY_NAMES[code] || code.charAt(0).toUpperCase() + code.slice(1),
            code,
            waves,
          }))
        );
      })
      .catch(() => {
        // index.json not yet deployed — leave empty
      });
  }, []);

  return { usWaves, internationalToplines };
}

const DATA_TABS = [
  { key: 'citizens', label: 'U.S. Citizens', color: '#2563eb' },
  { key: 'international', label: 'International', color: '#8b5cf6' },
  { key: 'elites', label: 'Congressional Rhetoric', color: '#059669' },
  { key: 'stateelites', label: 'State Elected Officials', color: '#d97706' },
  { key: 'violence', label: 'Political Violence', color: '#dc2626' },
];

interface Dataset {
  title: string;
  description: string;
  format: string;
  url: string;
  size: string;
  rows?: string;
  isPage?: boolean;
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function ViewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  );
}

function DatasetCard({ dataset, color }: { dataset: Dataset; color: string }) {
  const navigate = useNavigate();

  return (
    <div
      className="p-5 rounded-xl"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
    >
      <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {dataset.title}
      </h3>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
        {dataset.description}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="px-2 py-1 rounded" style={{ background: 'var(--bg-secondary)' }}>
            {dataset.format}
          </span>
          {dataset.size && <span className="py-1">{dataset.size}</span>}
          {dataset.rows && (
            <span className="py-1" style={{ color: 'var(--text-secondary)' }}>{dataset.rows}</span>
          )}
        </div>
        {dataset.isPage ? (
          <button
            onClick={() => navigate(dataset.url)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90 cursor-pointer"
            style={{ background: color, color: '#fff', border: 'none' }}
          >
            <ViewIcon />
            View
          </button>
        ) : (
          <a
            href={dataset.url}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
            style={{ background: color, color: '#fff', textDecoration: 'none' }}
          >
            <DownloadIcon />
            Download
          </a>
        )}
      </div>
    </div>
  );
}

function SectionDescription({ text }: { text: string }) {
  return (
    <p className="mb-6" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
      {text}
    </p>
  );
}

function CitizensTab({ usWaves }: { usWaves: ToplineWave[] }) {
  const [selectedUSWave, setSelectedUSWave] = useState<number | ''>('');

  const handleUSDownload = () => {
    if (selectedUSWave) {
      const waveData = usWaves.find(w => w.wave === selectedUSWave);
      if (waveData) {
        window.open(`${TOPLINES_BASE}/${waveData.file}`, '_blank');
      }
    }
  };

  const datasets: Dataset[] = [
    {
      title: 'All Survey Data',
      description: 'Complete dataset of all U.S. survey responses with demographics, party ratings, violence support, norm violation measures, and congressional district (statecd_zip).',
      format: 'ZIP (CSV)',
      url: `${DATA_BASE}/all-data.zip`,
      size: '24 MB',
      rows: '164K rows',
    },
    {
      title: 'Survey Codebook',
      description: 'Variable definitions, question wording, and response options for the U.S. survey dataset.',
      format: 'HTML',
      url: '/data/codebook',
      size: '',
      isPage: true,
    },
  ];

  return (
    <div>
      <SectionDescription text="Weekly surveys tracking American attitudes on partisan conflict, political violence, and democratic norms." />

      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Datasets
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {datasets.map((d, i) => <DatasetCard key={i} dataset={d} color="#2563eb" />)}
      </div>

      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Survey Toplines
      </h3>
      <div
        className="p-5 rounded-xl"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Summary reports with key findings from each U.S. survey wave.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedUSWave}
            onChange={(e) => setSelectedUSWave(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              minWidth: '180px',
            }}
          >
            <option value="">Select wave...</option>
            {usWaves.slice().reverse().map((w) => (
              <option key={w.wave} value={w.wave}>
                Wave {w.wave}
              </option>
            ))}
          </select>
          <button
            onClick={handleUSDownload}
            disabled={!selectedUSWave}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: selectedUSWave ? '#2563eb' : 'var(--bg-secondary)',
              color: selectedUSWave ? '#fff' : 'var(--text-muted)',
              cursor: selectedUSWave ? 'pointer' : 'not-allowed',
            }}
          >
            <PdfIcon />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function InternationalTab({ internationalToplines }: { internationalToplines: ToplineCountry[] }) {
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedIntlWave, setSelectedIntlWave] = useState<number | ''>('');

  const selectedCountryData = internationalToplines.find(c => c.code === selectedCountry);
  const intlWaves = selectedCountryData?.waves || [];

  const handleInternationalDownload = () => {
    if (selectedCountry && selectedIntlWave) {
      window.open(`${TOPLINES_BASE}/international/${selectedCountry}-wave${selectedIntlWave}-toplines.pdf`, '_blank');
    }
  };

  const datasets: Dataset[] = [
    {
      title: 'Brazil',
      description: 'Survey responses from Brazil measuring polarization, violence support, and democratic norms.',
      format: 'CSV',
      url: `${DATA_BASE}/international/BR-all.csv`,
      size: '8.2 MB',
      rows: '8K rows',
    },
    {
      title: 'Germany',
      description: 'Survey responses from Germany measuring polarization, violence support, and democratic norms.',
      format: 'CSV',
      url: `${DATA_BASE}/international/DE-all.csv`,
      size: '11.3 MB',
      rows: '8K rows',
    },
    {
      title: 'India',
      description: 'Survey responses from India measuring polarization, violence support, and democratic norms.',
      format: 'CSV',
      url: `${DATA_BASE}/international/IN-all.csv`,
      size: '11.0 MB',
      rows: '8K rows',
    },
    {
      title: 'Israel',
      description: 'Survey responses from Israel measuring polarization, violence support, and democratic norms.',
      format: 'CSV',
      url: `${DATA_BASE}/international/IL-all.csv`,
      size: '9.7 MB',
      rows: '8K rows',
    },
    {
      title: 'Poland',
      description: 'Survey responses from Poland measuring polarization, violence support, and democratic norms.',
      format: 'CSV',
      url: `${DATA_BASE}/international/PL-all.csv`,
      size: '11.5 MB',
      rows: '8K rows',
    },
  ];

  return (
    <div>
      <SectionDescription text="Cross-national survey data tracking polarization trends across democracies." />

      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Datasets
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {datasets.map((d, i) => <DatasetCard key={i} dataset={d} color="#8b5cf6" />)}
      </div>

      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Survey Toplines
      </h3>
      <div
        className="p-5 rounded-xl"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Summary reports for international survey data by country and wave.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCountry}
            onChange={(e) => {
              setSelectedCountry(e.target.value);
              setSelectedIntlWave('');
            }}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              minWidth: '160px',
            }}
          >
            <option value="">Select country...</option>
            {internationalToplines.map((item) => (
              <option key={item.code} value={item.code}>
                {item.country}
              </option>
            ))}
          </select>
          <select
            value={selectedIntlWave}
            onChange={(e) => setSelectedIntlWave(e.target.value ? Number(e.target.value) : '')}
            disabled={!selectedCountry}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              opacity: selectedCountry ? 1 : 0.5,
              minWidth: '150px',
            }}
          >
            <option value="">Select wave...</option>
            {intlWaves.map((wave) => (
              <option key={wave} value={wave}>
                Wave {wave}
              </option>
            ))}
          </select>
          <button
            onClick={handleInternationalDownload}
            disabled={!selectedCountry || !selectedIntlWave}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: selectedCountry && selectedIntlWave ? '#8b5cf6' : 'var(--bg-secondary)',
              color: selectedCountry && selectedIntlWave ? '#fff' : 'var(--text-muted)',
              cursor: selectedCountry && selectedIntlWave ? 'pointer' : 'not-allowed',
            }}
          >
            <PdfIcon />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function ElitesTab() {
  const congressionalDatasets: Dataset[] = [
    {
      title: 'Classified Statements (Current Members)',
      description: 'Classified rhetoric for currently serving members of Congress with source, date, and category labels.',
      format: 'ZIP (CSV)',
      url: `${DATA_BASE}/elite/rhetoric-all.zip`,
      size: '298 MB',
      rows: '2.2M rows',
    },
    {
      title: 'Classified Statements (All National)',
      description: 'Classified rhetoric for all national legislators, including former members of Congress.',
      format: 'ZIP (CSV)',
      url: `${DATA_BASE}/elite/rhetoric-all-national.zip`,
      size: '461 MB',
      rows: '6.7M rows',
    },
    {
      title: 'Legislator Profiles (Current Members)',
      description: 'Aggregated profiles for currently serving legislators with rhetorical category breakdowns.',
      format: 'ZIP (CSV)',
      url: `${DATA_BASE}/elite/profiles.zip`,
      size: '261 KB',
      rows: '537 officials',
    },
    {
      title: 'Legislator Profiles (All National)',
      description: 'Aggregated profiles for all national legislators, including former members of Congress.',
      format: 'ZIP (CSV)',
      url: `${DATA_BASE}/elite/profiles-all-national.zip`,
      size: '317 KB',
      rows: '902 officials',
    },
    {
      title: 'Profiles Data Dictionary',
      description: 'Column definitions and metadata for the legislator profiles dataset.',
      format: 'CSV',
      url: `${DATA_BASE}/elite/profiles-meta.csv`,
      size: '2 KB',
    },
    {
      title: 'Communication Data Dictionary',
      description: 'Column definitions and metadata for the classified statements dataset.',
      format: 'CSV',
      url: `${DATA_BASE}/elite/communication-meta.csv`,
      size: '2 KB',
    },
  ];

  const primaryDatasets: Dataset[] = [
    {
      title: '2026 Primary Candidate Rhetoric',
      description: 'Classified tweets from 2026 primary candidates with personal attacks, policy discussion, bipartisanship, and credit claiming labels.',
      format: 'ZIP (CSV)',
      url: `${DATA_BASE}/elite/primary-rhetoric.zip`,
      size: '20.8 MB',
      rows: '262K rows',
    },
    {
      title: 'Primary Rhetoric Data Dictionary',
      description: 'Column definitions and metadata for the primary candidate rhetoric dataset.',
      format: 'CSV',
      url: `${DATA_BASE}/elite/primary-meta.csv`,
      size: '1 KB',
    },
  ];

  return (
    <div>
      <SectionDescription text="Classified statements from members of Congress and primary candidates across floor speeches, newsletters, press releases, and social media." />

      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Congressional
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {congressionalDatasets.map((d, i) => <DatasetCard key={i} dataset={d} color="#059669" />)}
      </div>

      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        2026 Primaries
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {primaryDatasets.map((d, i) => <DatasetCard key={i} dataset={d} color="#059669" />)}
      </div>
    </div>
  );
}

function StateElitesTab() {
  const rhetoricDatasets: Dataset[] = [
    {
      title: 'State Classified Rhetoric',
      description: 'Complete dataset of classified state legislator tweets with source, date, and category labels for personal attacks, policy discussion, bipartisanship, and credit claiming.',
      format: 'ZIP (CSV)',
      url: `${DATA_BASE}/elite/state-rhetoric-all.zip`,
      size: '48 MB',
      rows: '947K rows',
    },
    {
      title: 'State Legislator Profiles',
      description: 'Aggregated profiles for all state legislators with rhetoric scores and party breakdowns.',
      format: 'ZIP (CSV)',
      url: `${DATA_BASE}/elite/state-profiles.zip`,
      size: '844 KB',
      rows: '7,757 officials',
    },
  ];

  const metaDatasets: Dataset[] = [
    {
      title: 'Rhetoric Data Dictionary',
      description: 'Column definitions and metadata for the state classified rhetoric dataset.',
      format: 'CSV',
      url: `${DATA_BASE}/elite/state-meta.csv`,
      size: '2 KB',
    },
    {
      title: 'Profiles Data Dictionary',
      description: 'Column definitions and metadata for the state legislator profiles dataset.',
      format: 'CSV',
      url: `${DATA_BASE}/elite/state-profiles-meta.csv`,
      size: '2 KB',
    },
  ];

  return (
    <div>
      <SectionDescription text="Classified social media posts from state legislators across all 50 states, categorized by AI for personal attacks, policy discussion, bipartisanship, and credit claiming." />

      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Datasets
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {rhetoricDatasets.map((d, i) => <DatasetCard key={i} dataset={d} color="#d97706" />)}
      </div>

      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Data Dictionaries
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metaDatasets.map((d, i) => <DatasetCard key={i} dataset={d} color="#d97706" />)}
      </div>
    </div>
  );
}

function ViolenceTab() {
  const datasets: Dataset[] = [
    {
      title: 'Political Violence Events Database',
      description: 'All documented political violence events with location, date, target, motive, and casualty information.',
      format: 'CSV',
      url: '/data/violence/events.csv',
      size: '231 KB',
    },
    {
      title: 'Events by State Summary',
      description: 'Aggregated counts and trends of political violence events by state.',
      format: 'CSV',
      url: '/data/violence/events-by-state.csv',
      size: '1 KB',
    },
  ];

  return (
    <div>
      <SectionDescription text="Database of documented political violence incidents in the United States." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {datasets.map((d, i) => <DatasetCard key={i} dataset={d} color="#dc2626" />)}
      </div>
    </div>
  );
}

export function Data() {
  usePageTitle('Open Data');
  const { usWaves, internationalToplines } = useToplinesIndex();

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1.75rem' }}>
          Open Data
        </h1>
        <p className="text-lg mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.7', maxWidth: '800px' }}>
          Download our publicly available datasets for your own research and analysis. All data is provided under a{' '}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#2563eb', textDecoration: 'underline' }}
          >
            Creative Commons Attribution 4.0
          </a>{' '}
          license.
        </p>
      </div>

      {/* Tabbed Data Sections */}
      <Tabs tabs={DATA_TABS} urlKey="section">
        <TabPanel><CitizensTab usWaves={usWaves} /></TabPanel>
        <TabPanel><InternationalTab internationalToplines={internationalToplines} /></TabPanel>
        <TabPanel><ElitesTab /></TabPanel>
        <TabPanel><StateElitesTab /></TabPanel>
        <TabPanel><ViolenceTab /></TabPanel>
      </Tabs>

      {/* Citation Section */}
      <div
        className="p-6 rounded-xl mb-8 mt-10"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
          Citation
        </h2>
        <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
          If you use any of these datasets in your research, please cite:
        </p>
        <div
          className="p-4 rounded-lg font-mono text-sm overflow-x-auto"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
          Westwood, S. J., & Lelkes, Y. (2024). <em>America's Political Pulse</em> [Data set]. https://americaspoliticalpulse.com/data
        </div>
      </div>

      {/* API Notice */}
      <div
        className="p-6 rounded-xl"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>
          Need Programmatic Access?
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          For researchers who need programmatic access to our data, please{' '}
          <Link
            to="/about"
            style={{ color: '#2563eb', textDecoration: 'underline' }}
          >
            contact us
          </Link>{' '}
          to discuss API access options.
        </p>
      </div>
    </div>
  );
}
