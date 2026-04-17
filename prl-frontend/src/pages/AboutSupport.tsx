import { useTheme } from '../hooks/useTheme';
import { usePageTitle } from '../hooks/usePageTitle';

interface Supporter {
  name: string;
  logo: string;
  url?: string;
}

const supporters: Supporter[] = [
  {
    name: 'Carnegie Corporation of New York',
    logo: '/img/funders/carnegie.svg',
    url: 'https://www.carnegie.org/',
  },
  {
    name: 'Hewlett Foundation',
    logo: '/img/funders/hewlett.svg',
    url: 'https://hewlett.org/',
  },
  {
    name: 'Knight Foundation',
    logo: '/img/funders/knight.webp',
    url: 'https://knightfoundation.org/',
  },
  {
    name: 'Charles Koch Foundation',
    logo: '/img/funders/koch.png',
    url: 'https://charleskochfoundation.org/',
  },
  {
    name: 'New Pluralists',
    logo: '/img/funders/newpluralists.png',
    url: 'https://newpluralists.org/',
  },
  {
    name: 'Templeton World Charity Foundation',
    logo: '/img/funders/templeton.jpg',
    url: 'https://www.templetonworldcharity.org/',
  },
  {
    name: 'Neukom Institute',
    logo: '/img/funders/neukom.png',
    url: 'https://neukom.dartmouth.edu/',
  },
  {
    name: 'Institute for Humane Studies',
    logo: '/img/funders/ihs.png',
    url: 'https://www.theihs.org/',
  },
];

export function AboutSupport() {
  usePageTitle('Foundation Support');
  const { isDarkMode } = useTheme();

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12">
      <div className="mb-12 text-center">
        <h1 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>
          Foundation Support
        </h1>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Our work is made possible through the generous support of these foundations and organizations.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {supporters.map((supporter) => (
          <a
            key={supporter.name}
            href={supporter.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl p-6 flex flex-col items-center justify-center transition-all hover:scale-[1.02]"
            style={{
              background: isDarkMode ? 'var(--bg-tertiary)' : '#ffffff',
              border: '1px solid var(--border)',
              minHeight: '180px',
            }}
          >
            <img
              src={supporter.logo}
              alt={supporter.name}
              className="max-w-full max-h-20 object-contain mb-4"
              style={{
                filter: isDarkMode ? 'brightness(0.9)' : 'none',
              }}
            />
            <p
              className="text-sm text-center font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {supporter.name}
            </p>
          </a>
        ))}
      </div>

      <div
        className="mt-12 p-6 rounded-xl text-center"
        style={{
          background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
          border: '1px solid var(--border)',
        }}
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Interested in supporting our research?{' '}
          <a
            href="mailto:seanjwestwood@gmail.com"
            className="hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            Contact us
          </a>
        </p>
      </div>
    </div>
  );
}
