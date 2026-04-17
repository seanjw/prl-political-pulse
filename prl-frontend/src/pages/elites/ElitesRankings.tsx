import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ELITE_CATEGORIES, CATEGORY_KEYS, US_STATES, PARTY_COLORS } from '../../config/elitesCategories';
import { Tabs, TabPanel } from '../../components/Tabs';
import { usePageTitle } from '../../hooks/usePageTitle';
import { getBioguideFromImageUrl, getCongressImageUrl, handleImageError } from './legislatorImage';

const RANKINGS_URL = '/data/elite/rankings.json';

interface RankedLegislator {
  source_id: string;
  name: string;
  party: string;
  state: string;
  chamber: string;
  image_url?: string;
  scores: Record<string, number>;
}

interface RankingsData {
  national: RankedLegislator[];
  state: RankedLegislator[];
}

// Shared cache so both tabs don't re-fetch
let cachedData: RankingsData | null = null;

function useRankingsData() {
  const [data, setData] = useState<RankingsData | null>(cachedData);
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedData) return;

    let cancelled = false;

    async function fetchRankings() {
      try {
        const res = await fetch(RANKINGS_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Transform type field to chamber display name
        const transform = (entries: Record<string, unknown>[]): RankedLegislator[] =>
          entries.map((p) => {
            const type = (p.type as string) || '';
            const chamber = type === 'Representative' ? 'House' : type === 'Senator' ? 'Senate' : type;
            return {
              source_id: p.source_id as string,
              name: (p.name as string) || '',
              party: (p.party as string) || '',
              state: (p.state as string) || '',
              chamber,
              image_url: p.image_url as string | undefined,
              scores: (p.scores as Record<string, number>) || {},
            };
          });

        const parsed: RankingsData = {
          national: transform(json.national || []),
          state: transform(json.state || []),
        };

        cachedData = parsed;
        if (!cancelled) {
          setData(parsed);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load rankings');
          setLoading(false);
        }
      }
    }

    fetchRankings();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}

function RankingsTable({
  legislators,
  category,
  partyFilter,
  chamberFilter,
  stateFilter,
}: {
  legislators: RankedLegislator[];
  category: string;
  partyFilter: string;
  chamberFilter: string;
  stateFilter: string;
}) {
  const cat = ELITE_CATEGORIES[category];

  const sorted = useMemo(() => {
    let filtered = legislators;
    if (partyFilter) filtered = filtered.filter((l) => l.party === partyFilter);
    if (chamberFilter) filtered = filtered.filter((l) => l.chamber === chamberFilter);
    if (stateFilter) filtered = filtered.filter((l) => l.state === stateFilter);
    return [...filtered].sort((a, b) => (b.scores[category] || 0) - (a.scores[category] || 0));
  }, [legislators, category, partyFilter, chamberFilter, stateFilter]);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
        No legislators match the current filters.
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
    >
      <table className="w-full">
        <thead>
          <tr style={{ background: 'var(--bg-secondary)' }}>
            <th className="py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wide w-12" style={{ color: 'var(--text-muted)' }}>
              #
            </th>
            <th className="py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Legislator
            </th>
            <th className="py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wide hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>
              Party
            </th>
            <th className="py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wide hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>
              State
            </th>
            <th className="py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wide hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>
              Chamber
            </th>
            <th className="py-2.5 px-4 text-right text-xs font-bold uppercase tracking-wide" style={{ color: cat.color }}>
              {cat.label}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((leg, idx) => {
            const pct = Math.round(leg.scores[category] || 0);
            const party = leg.party || 'Independent';
            const partyColor = PARTY_COLORS[party as keyof typeof PARTY_COLORS] || PARTY_COLORS.Independent;
            const bioguideId = getBioguideFromImageUrl(leg.image_url);
            const imgSrc = bioguideId ? getCongressImageUrl(bioguideId) : null;

            return (
              <tr
                key={leg.source_id}
                className="transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td className="py-2.5 px-4">
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: idx < 3 ? cat.color : 'var(--text-muted)' }}
                  >
                    {idx + 1}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <Link
                    to={`/elites/profile/${leg.source_id}`}
                    className="flex items-center gap-2.5"
                    style={{ textDecoration: 'none' }}
                  >
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        style={{ border: `2px solid ${partyColor}` }}
                        onError={handleImageError}
                      />
                    ) : null}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${imgSrc ? 'hidden' : ''}`}
                      style={{ background: partyColor }}
                    >
                      {(leg.name || '?').split(' ').pop()?.charAt(0) || '?'}
                    </div>
                    <div>
                      <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {leg.name || 'Unknown'}
                      </span>
                      <span className="md:hidden text-xs block" style={{ color: 'var(--text-muted)' }}>
                        <span style={{ color: partyColor }}>{party.charAt(0)}</span> &middot; {leg.state}
                      </span>
                    </div>
                  </Link>
                </td>
                <td className="py-2.5 px-4 hidden md:table-cell">
                  <span className="text-sm font-semibold" style={{ color: partyColor }}>
                    {party}
                  </span>
                </td>
                <td className="py-2.5 px-4 hidden md:table-cell text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {leg.state}
                </td>
                <td className="py-2.5 px-4 hidden lg:table-cell text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {leg.chamber}
                </td>
                <td className="py-2.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-[4px] rounded-full overflow-hidden hidden sm:block" style={{ background: 'var(--border)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(pct, 100)}%`, background: cat.color }}
                      />
                    </div>
                    <span className="text-sm font-mono tabular-nums font-semibold" style={{ color: cat.color }}>
                      {pct}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RankingsContent({ level }: { level: 'national' | 'state' }) {
  const { data, loading, error } = useRankingsData();
  const legislators = data?.[level] || [];
  const [activeCategory, setActiveCategory] = useState(CATEGORY_KEYS[0]);
  const [partyFilter, setPartyFilter] = useState('');
  const [chamberFilter, setChamberFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  const chambers = level === 'national' ? ['House', 'Senate'] : ['Lower', 'Upper', 'Legislature'];

  // Get unique states from loaded data
  const states = useMemo(() => {
    const unique = [...new Set(legislators.map((l) => l.state))].sort();
    return unique;
  }, [legislators]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading {legislators.length > 0 ? `${legislators.length} legislators...` : 'rankings...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-600">
        <p>Error loading rankings: {error}</p>
      </div>
    );
  }

  const cat = ELITE_CATEGORIES[activeCategory];

  return (
    <div>
      {/* Category selector */}
      <div
        className="flex flex-wrap gap-0 mb-1"
        style={{ borderBottom: '2px solid var(--border)' }}
      >
        {CATEGORY_KEYS.map((key) => {
          const c = ELITE_CATEGORIES[key];
          const isActive = key === activeCategory;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className="px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors relative"
              style={{
                color: isActive ? c.color : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                marginBottom: '-2px',
              }}
            >
              {c.label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: c.color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Category description */}
      <div
        className="px-3.5 py-2 text-sm italic mb-4"
        style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
      >
        {cat.description}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={partyFilter}
          onChange={(e) => setPartyFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="">All Parties</option>
          <option value="Democrat">Democrat</option>
          <option value="Republican">Republican</option>
          <option value="Independent">Independent</option>
        </select>
        <select
          value={chamberFilter}
          onChange={(e) => setChamberFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="">All Chambers</option>
          {chambers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="">All States</option>
          {states.map((s) => {
            const stateObj = US_STATES.find((st) => st.name === s);
            return <option key={s} value={s}>{stateObj ? `${stateObj.name} (${stateObj.code})` : s}</option>;
          })}
        </select>
        {(partyFilter || chamberFilter || stateFilter) && (
          <button
            onClick={() => { setPartyFilter(''); setChamberFilter(''); setStateFilter(''); }}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors hover:bg-red-50 hover:text-red-600"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            Clear
          </button>
        )}
        <span className="text-sm py-1.5" style={{ color: 'var(--text-muted)' }}>
          {legislators.length} legislators
        </span>
      </div>

      {/* Rankings table */}
      <RankingsTable
        legislators={legislators}
        category={activeCategory}
        partyFilter={partyFilter}
        chamberFilter={chamberFilter}
        stateFilter={stateFilter}
      />
    </div>
  );
}

const SCOPE_TABS = [
  { key: 'national', label: 'National (Congress)', color: '#2563eb' },
  { key: 'state', label: 'State Legislators', color: '#059669' },
];

export function ElitesRankings() {
  usePageTitle('Rhetoric Rankings');

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-bold mb-2" style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>
          Rhetoric Rankings
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          All legislators ranked by the percentage of their public communications classified in each rhetoric category.
        </p>
      </div>

      <Tabs tabs={SCOPE_TABS} urlKey="scope">
        <TabPanel>
          <RankingsContent level="national" />
        </TabPanel>
        <TabPanel>
          <RankingsContent level="state" />
        </TabPanel>
      </Tabs>
    </div>
  );
}
