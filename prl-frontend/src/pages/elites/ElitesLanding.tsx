import { Link } from 'react-router-dom';
import { useElitesData } from '../../hooks/useElitesData';

const stateNames: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', PR: 'Puerto Rico', VI: 'Virgin Islands', GU: 'Guam', AS: 'American Samoa'
};
import { ELITE_CATEGORIES, CATEGORY_TABS } from '../../config/elitesCategories';
import { Tabs, TabPanel } from '../../components/Tabs';
import { USChoroplethClickable } from '../../components/Charts/USChoroplethClickable';
import { usePageTitle } from '../../hooks/usePageTitle';

export function ElitesLanding() {
  usePageTitle('Elected Officials');
  const { data, loading, error } = useElitesData();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 py-12">
        <p>Error loading data: {error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div
        className="mb-8 p-6 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <div>
          <h1 className="font-bold mb-2" style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>
            How American Legislators Communicate
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            A comprehensive dataset of what America's federal and state legislators say, categorized in realtime by AI.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <Link
            to="/search"
            className="px-5 py-2.5 rounded-lg font-medium transition-colors text-center flex items-center justify-center gap-2"
            style={{
              background: '#2563eb',
              color: '#fff',
              textDecoration: 'none'
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search what legislators say
          </Link>
          <Link
            to="/elites/profiles"
            className="px-5 py-2.5 rounded-lg font-medium transition-colors text-center"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              textDecoration: 'none'
            }}
          >
            Explore individual legislators
          </Link>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs tabs={CATEGORY_TABS} urlKey="category">
        {CATEGORY_TABS.map((tab) => {
          const category = ELITE_CATEGORIES[tab.key];
          const geoData = data.geo?.[tab.key] || [];
          const leaderboard = data.leaderboards?.[tab.key] || { dems: [], reps: [] };

          return (
            <TabPanel key={tab.key}>
              {/* Category Description */}
              <div
                className="mb-6 p-4 rounded-lg"
                style={{
                  background: 'var(--bg-tertiary)',
                  borderLeft: `4px solid ${category.color}`
                }}
              >
                <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {category.label}
                </h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {category.description}
                </p>
              </div>

              {/* Main Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* US Map */}
                <div
                  className="p-4 rounded-xl"
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <h4 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                    {category.label} by State
                  </h4>
                  <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
                    Click a state to view its legislators
                  </p>
                  {geoData.length > 0 ? (
                    <USChoroplethClickable
                      data={geoData}
                      tooltipTitle={category.label}
                      navigateToProfiles={true}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64">
                      <p style={{ color: 'var(--text-muted)' }}>No geographic data available</p>
                    </div>
                  )}
                </div>

                {/* Combined Leaderboard */}
                <div
                  className="p-4 rounded-xl"
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      Rankings by Party
                    </h4>
                    <Link
                      to="/elites/rankings"
                      className="text-sm font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                      style={{ color: '#2563eb', textDecoration: 'none' }}
                    >
                      See all rankings
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-bold mb-2" style={{ color: '#1e40af' }}>Democrats</p>
                      <div className="space-y-2">
                        {leaderboard.dems.slice(0, 5).map((entry, index) => (
                          <Link
                            key={entry.source_id || `dem-${index}`}
                            to={`/elites/profile/${entry.source_id || ''}`}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-opacity-80 transition-colors"
                            style={{ background: '#1e40af', textDecoration: 'none' }}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                                style={{
                                  background: 'rgba(255,255,255,0.3)',
                                  color: '#fff'
                                }}
                              >
                                {index + 1}
                              </span>
                              <p className="font-medium text-sm" style={{ color: '#fff' }}>
                                {entry.name}<br />
                                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                  {stateNames[entry.state] || entry.state}
                                </span>
                              </p>
                            </div>
                            <span className="font-bold text-sm" style={{ color: '#fff' }}>
                              {entry.value.toFixed(1)}%
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-bold mb-2" style={{ color: '#b91c1c' }}>Republicans</p>
                      <div className="space-y-2">
                        {leaderboard.reps.slice(0, 5).map((entry, index) => (
                          <Link
                            key={entry.source_id || `rep-${index}`}
                            to={`/elites/profile/${entry.source_id || ''}`}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-opacity-80 transition-colors"
                            style={{ background: '#b91c1c', textDecoration: 'none' }}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                                style={{
                                  background: 'rgba(255,255,255,0.3)',
                                  color: '#fff'
                                }}
                              >
                                {index + 1}
                              </span>
                              <p className="font-medium text-sm" style={{ color: '#fff' }}>
                                {entry.name}<br />
                                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                  {stateNames[entry.state] || entry.state}
                                </span>
                              </p>
                            </div>
                            <span className="font-bold text-sm" style={{ color: '#fff' }}>
                              {entry.value.toFixed(1)}%
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </TabPanel>
          );
        })}
      </Tabs>

      {/* About Link */}
      <div className="mt-8 text-center">
        <Link
          to="/elites/about"
          style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}
        >
          About Methodology
        </Link>
      </div>
    </div>
  );
}
