import { Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PRIMARY_CATEGORIES, PRIMARY_CATEGORY_KEYS } from '../../config/primaryCategories';

export function PrimaryAbout() {
  usePageTitle('About — 2026 Primaries');

  return (
    <div className="py-6 max-w-3xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
        <Link to="/primary" className="hover:underline" style={{ color: 'var(--accent)' }}>Primaries</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>About</span>
      </nav>

      <h1
        className="text-3xl md:text-4xl font-extrabold leading-tight mb-2"
        style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}
      >
        About This Tracker
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        Methodology, data sources, and rhetoric categories for the 2026 Primary Election Tracker.
      </p>

      <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        <Section title="Overview">
          <p>
            The 2026 Primary Election Tracker monitors candidates running for the U.S. House and
            Senate in the 2026 primary elections. We track candidate rhetoric across social media,
            campaign websites, and press releases, analyzing how candidates position themselves
            within their party primaries.
          </p>
        </Section>

        <Section title="Data Sources">
          <p className="mb-3">
            Candidate information is sourced from the Federal Election Commission (FEC) filing
            records. We include candidates who have filed with the FEC and have either raised
            funds or are incumbent officeholders.
          </p>
          <p>
            Rhetoric data is collected from candidates&apos; public X/Twitter accounts, campaign
            websites, and official press releases. Each statement is classified into one or more
            of nine rhetoric categories using our natural language processing pipeline.
          </p>
        </Section>

        <Section title="Rhetoric Categories">
          <div className="mt-3 space-y-0">
            {PRIMARY_CATEGORY_KEYS.map((key) => {
              const cat = PRIMARY_CATEGORIES[key];
              return (
                <div
                  key={key}
                  className="flex items-start gap-3 py-2.5"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <div
                    className="w-[3px] h-4 rounded-full shrink-0 mt-0.5"
                    style={{ background: cat.color }}
                  />
                  <div>
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {cat.label}
                    </span>
                    <span className="mx-2" style={{ color: 'var(--text-muted)' }}>&mdash;</span>
                    <span>{cat.description}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Methodology">
          <p className="mb-3">
            Rhetoric scores represent the proportion of each candidate&apos;s public statements
            that fall into each category. Scores are normalized so that they sum to approximately
            100% across all nine categories.
          </p>
          <p>
            Candidates without active social media accounts have limited rhetoric data available.
            Their scores are based on fewer data points and should be interpreted with caution.
          </p>
        </Section>

        <Section title="About the Polarization Research Lab">
          <p>
            The Polarization Research Lab at Dartmouth College conducts research on political
            polarization, democratic attitudes, and political communication. This tracker is
            part of our broader effort to provide transparent, data-driven insights into
            American politics.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="text-lg font-bold mb-3"
        style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
