import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { usePrimaryData } from '../../hooks/usePrimaryData';
import { usePrimaryFilters } from '../../hooks/usePrimaryFilters';
import { PrimaryFilterBar } from './components/PrimaryFilterBar';
import { AddressLookup } from './components/AddressLookup';
import { CompetitiveRaces } from './components/CompetitiveRaces';
import { PrimaryLeaderboards } from './components/PrimaryLeaderboards';
import { AllRaces } from './components/AllRaces';
import { PrimaryAwards } from './components/PrimaryAwards';

type Tab = 'competitive' | 'rankings' | 'awards' | 'all-races';

const TABS: { key: Tab; label: string }[] = [
  { key: 'competitive', label: 'Competitive Races' },
  { key: 'rankings', label: 'Top Rankings' },
  { key: 'awards', label: 'Awards' },
  { key: 'all-races', label: 'All Races' },
];

export function PrimaryLanding() {
  usePageTitle('2026 Primary Elections');
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Derive active tab from URL hash
  const hashTab = location.hash.replace('#', '') as Tab;
  const activeTab: Tab = TABS.some((t) => t.key === hashTab) ? hashTab : 'competitive';

  // Switch tab: preserve search params
  const setActiveTab = useCallback((tab: Tab) => {
    const search = searchParams.toString();
    navigate({
      search: search ? `?${search}` : '',
      hash: tab === 'competitive' ? '' : tab,
    }, { replace: true });
  }, [navigate, searchParams]);

  // Load landing data
  const { data, loading, error, refresh, loadAllCandidates } = usePrimaryData();

  // Load all candidates when rankings, awards, or all-races tabs are active (single request)
  const needsAllData = activeTab === 'rankings' || activeTab === 'awards' || activeTab === 'all-races';
  const [allLoaded, setAllLoaded] = useState(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!needsAllData || !data || allLoaded || loadingRef.current) return;
    loadingRef.current = true;
    loadAllCandidates().then(() => {
      loadingRef.current = false;
      setAllLoaded(true);
      refresh();
    });
  }, [needsAllData, data, allLoaded, loadAllCandidates, refresh]);

  const allStatesLoading = needsAllData && !allLoaded;

  // Filters (only used by all-races tab)
  const { filters, setFilters, resetFilters, filteredRaces } = usePrimaryFilters(
    data?.candidates || [],
    data?.races || []
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading primary data...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-32 text-sm" style={{ color: 'var(--text-muted)' }}>
        Failed to load primary data.
      </div>
    );
  }

  return (
    <div className="pb-12">
      {/* Page title + description */}
      <div className="flex items-baseline justify-between gap-4 flex-wrap mt-6 mb-4">
        <h1
          className="text-2xl font-bold leading-tight"
          style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          2026 Primary Elections
        </h1>
        <Link
          to="/primary/about"
          className="text-sm font-semibold px-3 py-1 rounded transition-colors"
          style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#ffffff'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent)'; }}
        >
          About this data &rarr;
        </Link>
      </div>
      <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>
        Tracking the rhetoric and positioning of candidates running in the 2026 U.S. House and Senate
        primary elections. Rhetoric data is collected from candidates' public X/Twitter accounts, campaign
        websites, and press releases, then classified into nine categories using natural language processing.
        Use the tabs below to explore competitive races, top-ranked candidates by rhetoric category, or browse
        all races by state.
      </p>

      <div className="mb-4">
        <AddressLookup races={data.races} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 mb-4" style={{ borderBottom: '2px solid var(--border)' }}>
        {TABS.map(({ key, label }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors relative"
              style={{
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                marginBottom: '-2px',
              }}
            >
              {label}
              {active && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: 'var(--text-primary)' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Filter bar — shown for all races only */}
      {activeTab === 'all-races' && (
        <PrimaryFilterBar
          filters={filters}
          onFilterChange={setFilters}
          onReset={resetFilters}
        />
      )}

      {/* Tab content */}
      {activeTab === 'competitive' && <CompetitiveRaces raceMap={data.raceMap} />}

      {activeTab === 'rankings' && (allStatesLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading all candidates...</span>
        </div>
      ) : <PrimaryLeaderboards candidates={data.candidates} />)}

      {activeTab === 'awards' && (allStatesLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading awards data...</span>
        </div>
      ) : <PrimaryAwards awards={data.awards} />)}

      {activeTab === 'all-races' && (allStatesLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-t-transparent" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading all races...</span>
        </div>
      ) : <AllRaces races={filteredRaces} candidateMap={data.candidateMap} />)}
    </div>
  );
}
