import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useElitesProfiles, type LegislatorProfile } from '../../hooks/useElitesProfiles';
import { US_STATES, PARTY_COLORS } from '../../config/elitesCategories';
import { Tabs, TabPanel } from '../../components/Tabs';
import { usePageTitle } from '../../hooks/usePageTitle';
import { CHAMBER_LABELS } from '../search/config';
import { getBioguideFromImageUrl, getCongressImageUrl, handleImageError } from './legislatorImage';

type ViewMode = 'grid' | 'table';

// Legislator Card for grid view
function LegislatorCard({ profile }: { profile: LegislatorProfile }) {
  const partyColor = PARTY_COLORS[profile.party as keyof typeof PARTY_COLORS] || PARTY_COLORS.Independent;

  const bioguideId = getBioguideFromImageUrl(profile.image_url);
  const imageUrl = bioguideId ? getCongressImageUrl(bioguideId) : null;

  return (
    <Link
      to={`/elites/profile/${profile.source_id}`}
      className="block px-3 pt-2 pb-2 rounded-lg transition-all hover:shadow-lg"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        textDecoration: 'none',
      }}
    >
      <div className="flex items-start gap-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={profile.name}
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            style={{ border: `2px solid ${partyColor}` }}
            onError={handleImageError}
          />
        ) : null}
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0 ${imageUrl ? 'hidden' : ''}`}
          style={{ background: partyColor }}
        >
          {profile.name.split(' ').pop()?.charAt(0) || profile.name.charAt(0)}
        </div>
        <div>
          <p
            className="font-semibold text-lg leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {profile.name}
          </p>
          <p className="text-sm mt-1 leading-tight no-bottom-space" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: partyColor, fontWeight: 600 }}>{profile.party}</span>
            <br />
            {profile.state}
            <br />
            {CHAMBER_LABELS[profile.chamber] || profile.chamber}
          </p>
        </div>
      </div>
    </Link>
  );
}

// Table row for table view
function LegislatorRow({ profile }: { profile: LegislatorProfile }) {
  const partyColor = PARTY_COLORS[profile.party as keyof typeof PARTY_COLORS] || PARTY_COLORS.Independent;

  const bioguideId = getBioguideFromImageUrl(profile.image_url);
  const imageUrl = bioguideId ? getCongressImageUrl(bioguideId) : null;

  return (
    <tr
      className="hover:bg-opacity-50 transition-colors cursor-pointer"
      style={{ borderBottom: '1px solid var(--border)' }}
      onClick={() => window.location.href = `/elites/profile/${profile.source_id}`}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={profile.name}
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${imageUrl ? 'hidden' : ''}`}
            style={{ background: partyColor }}
          >
            {profile.name.split(' ').pop()?.charAt(0) || profile.name.charAt(0)}
          </div>
          <span style={{ color: 'var(--text-primary)' }}>{profile.name}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span style={{ color: partyColor, fontWeight: 600 }}>{profile.party}</span>
      </td>
      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{profile.state}</td>
      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>{CHAMBER_LABELS[profile.chamber] || profile.chamber}</td>
    </tr>
  );
}

// Filter sidebar component
function FilterSidebar({
  filters,
  onFilterChange,
  sourceType,
}: {
  sourceType: 'national' | 'state';
  filters: {
    name: string;
    state: string;
    party: string[];
    chamber: string[];
  };
  onFilterChange: (key: string, value: string | string[]) => void;
}) {
  return (
    <div
      className="p-4 rounded-xl sticky top-4"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <h5 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
        Filters
      </h5>

      {/* Name Search */}
      <div className="mb-3">
        <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Search by Name
        </label>
        <input
          type="text"
          value={filters.name}
          onChange={(e) => onFilterChange('name', e.target.value)}
          placeholder="Enter name..."
          className="w-full px-2.5 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* State Select */}
      <div className="mb-3">
        <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
          State
        </label>
        <select
          value={filters.state}
          onChange={(e) => onFilterChange('state', e.target.value)}
          className="w-full px-2.5 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All States</option>
          {US_STATES.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </select>
      </div>

      {/* Divider */}
      <div className="border-t my-3" style={{ borderColor: 'var(--border)' }} />

      {/* Party Checkboxes */}
      <div className="mb-3">
        <label className="block text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
          Party
        </label>
        <div className="flex flex-col">
          {['Democrat', 'Republican', 'Independent'].map((party) => (
            <label
              key={party}
              className="flex items-center cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.party.includes(party)}
                onChange={(e) => {
                  const newParties = e.target.checked
                    ? [...filters.party, party]
                    : filters.party.filter((p) => p !== party);
                  onFilterChange('party', newParties);
                }}
                className="w-4 h-4 rounded"
                style={{ marginRight: '8px' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {party}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Chamber Checkboxes */}
      <div className="mb-3">
        <label className="block text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
          Chamber
        </label>
        <div className="flex flex-col">
          {(sourceType === 'state' ? ['Lower', 'Upper', 'Legislature'] : ['House', 'Senate']).map((chamber) => (
            <label
              key={chamber}
              className="flex items-center cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.chamber.includes(chamber)}
                onChange={(e) => {
                  const newChambers = e.target.checked
                    ? [...filters.chamber, chamber]
                    : filters.chamber.filter((c) => c !== chamber);
                  onFilterChange('chamber', newChambers);
                }}
                className="w-4 h-4 rounded"
                style={{ marginRight: '8px' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {chamber}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      <button
        onClick={() => {
          onFilterChange('name', '');
          onFilterChange('state', '');
          onFilterChange('party', []);
          onFilterChange('chamber', []);
        }}
        className="w-full py-1.5 px-3 rounded-lg text-xs font-medium transition-all hover:bg-red-50 hover:text-red-600 hover:border-red-200"
        style={{
          background: 'var(--bg-tertiary)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
        }}
      >
        Clear Filters
      </button>
    </div>
  );
}

// Main profiles content
function ProfilesContent({ sourceType }: { sourceType: 'national' | 'state' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState({
    name: searchParams.get('name') || '',
    state: searchParams.get('state') || '',
    party: [] as string[],
    chamber: [] as string[],
  });

  const { profiles, loading, error, hasMore, loadMore } = useElitesProfiles({
    ...filters,
    sourceType,
  });

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasMore && !loading) {
      loadMore();
    }
  }, [hasMore, loading, loadMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px',
      threshold: 0,
    });

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  // Update URL when state filter changes from map click
  useEffect(() => {
    const stateFromUrl = searchParams.get('state');
    if (stateFromUrl && stateFromUrl !== filters.state) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilters((prev) => ({ ...prev, state: stateFromUrl }));
    }
  }, [searchParams, filters.state]);

  const handleFilterChange = (key: string, value: string | string[]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));

    // Update URL for state filter
    if (key === 'state') {
      if (value) {
        searchParams.set('state', value as string);
      } else {
        searchParams.delete('state');
      }
      setSearchParams(searchParams);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar */}
      <div className="lg:w-64 flex-shrink-0">
        <FilterSidebar filters={filters} onFilterChange={handleFilterChange} sourceType={sourceType} />
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* View Toggle and Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p style={{ color: 'var(--text-secondary)' }}>
            {loading ? 'Loading...' : `${profiles.length} legislators${hasMore ? '+' : ''}`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className="p-2 rounded-lg transition-colors"
              style={{
                background: viewMode === 'grid' ? '#2563eb' : 'var(--bg-tertiary)',
                color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)',
              }}
              title="Grid view"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className="p-2 rounded-lg transition-colors"
              style={{
                background: viewMode === 'table' ? '#2563eb' : 'var(--bg-tertiary)',
                color: viewMode === 'table' ? '#fff' : 'var(--text-secondary)',
              }}
              title="Table view"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="4" width="18" height="3" rx="1" />
                <rect x="3" y="10" width="18" height="3" rx="1" />
                <rect x="3" y="16" width="18" height="3" rx="1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="text-center py-8 text-red-600">
            <p>Error: {error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && profiles.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && profiles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {profiles.map((profile) => (
              <LegislatorCard key={profile.source_id} profile={profile} />
            ))}
          </div>
        )}

        {/* Table View */}
        {viewMode === 'table' && profiles.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th className="py-3 px-4 text-left text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Name
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Party
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    State
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Chamber
                  </th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <LegislatorRow key={profile.source_id} profile={profile} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!loading && profiles.length === 0 && (
          <div className="text-center py-12">
            <p style={{ color: 'var(--text-muted)' }}>
              No legislators found matching your filters.
            </p>
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-4" />
        {loading && profiles.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
    </div>
  );
}

const SCOPE_TABS = [
  { key: 'national', label: 'National (Congress)', color: '#2563eb' },
  { key: 'state', label: 'State Legislators', color: '#059669' },
];

export function ElitesProfiles() {
  usePageTitle('Legislator Profiles');
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold" style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>
          Legislator Profiles
        </h1>
      </div>

      <Tabs tabs={SCOPE_TABS} urlKey="scope">
        <TabPanel>
          <ProfilesContent sourceType="national" />
        </TabPanel>
        <TabPanel>
          <ProfilesContent sourceType="state" />
        </TabPanel>
      </Tabs>
    </div>
  );
}
