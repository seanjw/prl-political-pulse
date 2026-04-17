import { Link } from 'react-router-dom';
import { useStatsContext } from '../context/StatsContext';
import { useReports } from '../hooks/useReports';
import { usePageTitle } from '../hooks/usePageTitle';

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);

export function Home() {
  usePageTitle('Home');
  const { stats } = useStatsContext();
  const { data: reportsData, loading: reportsLoading } = useReports();

  // Get latest reports (limit to 6 for carousel)
  const latestReports = reportsData.articles.slice(0, 6);

  return (
    <>
      {/* Hero Introduction */}
      <section className="hero-intro">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="hero-intro-content hero-intro-content-full">
            <h1 className="hero-intro-title">
              Data dashboards
            </h1>
            <p className="hero-intro-subtitle">
              Open data and research on how Americans view democracy, how their representatives communicate, and how democratic attitudes vary worldwide.
            </p>
          </div>
        </div>
      </section>

      {/* Main Dashboard Grid - 2x2 */}
      <section className="py-8 md:py-12" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <div className="card-grid-2x2">

            {/* 2026 US Elections - Orange, featured full-width */}
            <Link to="/primary" className="rich-card rich-card-orange rich-card-featured" style={{ textDecoration: 'none' }}>
              <div className="rich-card-inner">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="rich-card-title" style={{ marginBottom: 0 }}>2026 US Elections</h2>
                  <div className="rich-card-stats" style={{ marginTop: 0 }}>
                    <div className="rich-card-stat">
                      <span className="rich-card-stat-value">2,870</span>
                      <span className="rich-card-stat-label">Candidates</span>
                    </div>
                    <div className="rich-card-stat">
                      <span className="rich-card-stat-value">471</span>
                      <span className="rich-card-stat-label">Races</span>
                    </div>
                    <div className="rich-card-stat">
                      <span className="rich-card-stat-value">Daily</span>
                      <span className="rich-card-stat-label">Updates</span>
                    </div>
                  </div>
                </div>
                <p className="rich-card-description">
                  Track every 2026 primary and general election candidate for Congress—their rhetoric, campaign finance, social media activity, and how they compare.
                </p>
                <div className="rich-card-actions">
                  <span className="rich-card-btn">
                    Explore 2026 Elections Dashboard
                    <ArrowRightIcon />
                  </span>
                </div>
              </div>
              <div className="rich-card-icon">
                {/* Ballot box */}
                <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.5}>
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <line x1="3" y1="14" x2="21" y2="14" />
                  <rect x="9" y="12" width="6" height="2" rx={0.5} />
                  <rect x="8" y="3" width="8" height="10" rx="1" transform="rotate(-15 12 8)" />
                  <line x1="9.5" y1="6" x2="13.5" y2="5" strokeWidth={0.4} />
                  <line x1="9.8" y1="8" x2="13.8" y2="7" strokeWidth={0.4} />
                </svg>
              </div>
            </Link>

            {/* American Views on Democracy - Blue */}
            <Link to="/citizens" className="rich-card rich-card-blue" style={{ textDecoration: 'none' }}>
              <div className="rich-card-inner">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="rich-card-title" style={{ marginBottom: 0 }}>American Views on Democracy</h2>
                  <div className="rich-card-stats" style={{ marginTop: 0 }}>
                    <div className="rich-card-stat">
                      <span className="rich-card-stat-value">{stats.citizensNumWeeks}</span>
                      <span className="rich-card-stat-label">Waves</span>
                    </div>
                    <div className="rich-card-stat">
                      <span className="rich-card-stat-value">{stats.citizensRowcount}</span>
                      <span className="rich-card-stat-label">Responses</span>
                    </div>
                  </div>
                </div>
                <p className="rich-card-description">
                  Weekly survey data on how Democrats and Republicans view each other, support for democratic norms, and openness to political violence.
                </p>
                <div className="rich-card-actions">
                  <span className="rich-card-btn">
                    Explore American Democracy Dashboard
                    <ArrowRightIcon />
                  </span>
                </div>
              </div>
              <div className="rich-card-icon">
                {/* Bar chart */}
                <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.5}>
                  <rect x="4" y="14" width="3" height="7" rx={0.5} />
                  <rect x="8.5" y="8" width="3" height="13" rx={0.5} />
                  <rect x="13" y="11" width="3" height="10" rx={0.5} />
                  <rect x="17.5" y="5" width="3" height="16" rx={0.5} />
                  <line x1="3" y1="21.5" x2="21.5" y2="21.5" strokeWidth={0.6} />
                </svg>
              </div>
            </Link>

            {/* American Political Violence - Red */}
            <Link to="/violence" className="rich-card rich-card-red" style={{ textDecoration: 'none' }}>
              <div className="rich-card-inner">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="rich-card-title" style={{ marginBottom: 0 }}>American Political Violence</h2>
                  <div className="rich-card-stats" style={{ marginTop: 0 }}>
                    <div className="rich-card-stat">
                      <span className="rich-card-stat-value">Daily</span>
                      <span className="rich-card-stat-label">Updates</span>
                    </div>
                  </div>
                </div>
                <p className="rich-card-description">
                  A comprehensive database of political violence incidents in the United States from 1970 to present.
                </p>
                <div className="rich-card-actions">
                  <span className="rich-card-btn">
                    Explore Political Violence Dashboard
                    <ArrowRightIcon />
                  </span>
                </div>
              </div>
              <div className="rich-card-icon">
                {/* Siren */}
                <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.5}>
                  <path d="M12 2C8 2 5 6 5 11v2h14v-2c0-5-3-9-7-9z" />
                  <rect x="4" y="13" width="16" height="3" rx="1" />
                  <rect x="6" y="16" width="12" height="2" rx={0.5} />
                  <line x1="12" y1="2" x2="12" y2="0.5" strokeWidth={0.6} />
                  <line x1="5" y1="4" x2="3.5" y2="3" strokeWidth={0.6} />
                  <line x1="19" y1="4" x2="20.5" y2="3" strokeWidth={0.6} />
                  <line x1="2" y1="11" x2="0.5" y2="11" strokeWidth={0.6} />
                  <line x1="22" y1="11" x2="23.5" y2="11" strokeWidth={0.6} />
                </svg>
              </div>
            </Link>

            {/* Elected Officials - Purple */}
            <Link to="/elites" className="rich-card rich-card-purple" style={{ textDecoration: 'none' }}>
              <div className="rich-card-inner">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="rich-card-title" style={{ marginBottom: 0 }}>How American Legislators Communicate</h2>
                  <div className="rich-card-stats" style={{ marginTop: 0 }}>
                    <div className="rich-card-stat">
                      <span className="rich-card-stat-value">Daily</span>
                      <span className="rich-card-stat-label">Updates</span>
                    </div>
                    <div className="rich-card-stat">
                      <span className="rich-card-stat-value">{stats.eliteRowcount}</span>
                      <span className="rich-card-stat-label">Statements</span>
                    </div>
                  </div>
                </div>
                <p className="rich-card-description">
                  What every member of Congress and state legislator says publicly—speeches, press releases, and social media—classified by AI in real-time.
                </p>
                <div className="rich-card-actions">
                  <span className="rich-card-btn">
                    Explore Legislator Quality Dashboard
                    <ArrowRightIcon />
                  </span>
                </div>
              </div>
              <div className="rich-card-icon">
                {/* Podium */}
                <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.5}>
                  <path d="M6 10L6 8Q6 6 8 6L16 6Q18 6 18 8L18 10" />
                  <rect x="5" y="10" width="14" height="3" rx={0.5} />
                  <path d="M7 13L8 21L16 21L17 13" />
                  <line x1="8" y1="21" x2="6" y2="23" strokeWidth={0.6} />
                  <line x1="16" y1="21" x2="18" y2="23" strokeWidth={0.6} />
                  <circle cx="12" cy="4" r={1.5} />
                  <line x1="12" y1="5.5" x2="12" y2="6" strokeWidth={0.5} />
                </svg>
              </div>
            </Link>

            {/* Global Democracy - Green */}
            <Link to="/citizens/international" className="rich-card rich-card-green" style={{ textDecoration: 'none' }}>
              <div className="rich-card-inner">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="rich-card-title" style={{ marginBottom: 0 }}>Global Democracy</h2>
                  <div className="rich-card-stats" style={{ marginTop: 0 }}>
                    <div className="rich-card-stat">
                      <span className="rich-card-stat-value">{stats.globalNumWeeks}</span>
                      <span className="rich-card-stat-label">Rounds</span>
                    </div>
                    <div className="rich-card-stat">
                      <span className="rich-card-stat-value">{stats.globalRowcount}</span>
                      <span className="rich-card-stat-label">Responses</span>
                    </div>
                  </div>
                </div>
                <p className="rich-card-description">
                  How citizens in the United States, India, Israel, Brazil, Poland, and Germany view democracy and each other's political parties.
                </p>
                <div className="rich-card-actions">
                  <span className="rich-card-btn">
                    Explore Global Democracy Dashboard
                    <ArrowRightIcon />
                  </span>
                </div>
              </div>
              <div className="rich-card-icon">
                {/* Globe */}
                <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={0.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
            </Link>

          </div>
        </div>
      </section>

      {/* Latest Reports Carousel */}
      <section className="py-8" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-[1400px] mx-auto px-4 md:px-8">
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Latest Reports
          </h2>
          <div
            className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-8 md:px-8"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {reportsLoading ? (
              // Loading skeleton
              [...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 p-4 rounded-lg animate-pulse"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    width: '250px',
                    height: '180px',
                  }}
                />
              ))
            ) : (
              latestReports.map((report) => (
                <Link
                  key={report.slug}
                  to={`/report/${report.slug}`}
                  className="flex-shrink-0 rounded-lg transition-all hover:scale-[1.02] overflow-hidden"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    width: '250px',
                    height: '180px',
                    textDecoration: 'none',
                  }}
                >
                  {report.thumbnail && (
                    <img
                      src={report.thumbnail}
                      alt=""
                      className="w-full h-24 object-cover"
                    />
                  )}
                  <div className="p-2">
                    <p className="font-medium line-clamp-4" style={{ color: 'var(--text-primary)', fontSize: '10pt' }}>
                      {report.title.replace(/^(Report|Blog|News|Commentary|Research article):\s*/i, '')}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

    </>
  );
}
