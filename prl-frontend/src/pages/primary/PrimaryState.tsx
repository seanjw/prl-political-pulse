import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { usePrimaryData } from '../../hooks/usePrimaryData';
import { US_STATES } from '../../config/elitesCategories';
import { PRIMARY_DATES, formatPrimaryDate, getCountdownText, isPrimaryPast } from '../../config/primaryDates';
import { RaceCard } from './components/RaceCard';
import type { PrimaryRace } from '../../types/primary';

export function PrimaryState() {
  const { stateCode } = useParams<{ stateCode: string }>();
  const states = stateCode ? [stateCode] : undefined;
  const { data, loading, error } = usePrimaryData(states);

  const stateInfo = US_STATES.find((s) => s.code === stateCode);
  const stateName = stateInfo?.name || stateCode || '';
  usePageTitle(`${stateName} — 2026 Primaries`);

  const { senateRaces, houseRaces, candidateCount } = useMemo(() => {
    if (!data || !stateCode) return { senateRaces: [] as PrimaryRace[], houseRaces: [] as PrimaryRace[], candidateCount: 0 };
    const stateRaces = data.races.filter((r) => r.state === stateCode);
    const senate = stateRaces.filter((r) => r.office === 'S');
    const house = stateRaces.filter((r) => r.office === 'H').sort((a, b) => a.district.localeCompare(b.district));
    const count = stateRaces.reduce((sum, r) => sum + r.candidate_count, 0);
    return { senateRaces: senate, houseRaces: house, candidateCount: count };
  }, [data, stateCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-center py-32 text-sm" style={{ color: 'var(--text-muted)' }}>Failed to load data.</div>;
  }

  const totalRaces = senateRaces.length + houseRaces.length;

  return (
    <div className="pb-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs mt-4 mb-4" style={{ color: 'var(--text-muted)' }}>
        <Link to="/primary" className="hover:underline" style={{ color: 'var(--accent)' }}>Primaries</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>{stateName}</span>
      </nav>

      {/* Header — matches landing page layout */}
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
        <h1
          className="text-2xl font-bold leading-tight"
          style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          {stateName}
        </h1>
        <Link
          to="/primary"
          className="text-sm font-semibold px-3 py-1 rounded transition-colors"
          style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#ffffff'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent)'; }}
        >
          &larr; All primaries
        </Link>
      </div>
      <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>
        {totalRaces} {totalRaces === 1 ? 'race' : 'races'} &middot; {candidateCount} candidates
        {stateCode && PRIMARY_DATES[stateCode] && (
          <>
            {' · Primary: '}
            <span style={{ color: isPrimaryPast(PRIMARY_DATES[stateCode].date) ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: 600 }}>
              {formatPrimaryDate(PRIMARY_DATES[stateCode].date)}
            </span>
            {!isPrimaryPast(PRIMARY_DATES[stateCode].date) && (
              <span>{' '}({getCountdownText(PRIMARY_DATES[stateCode].date)})</span>
            )}
            {PRIMARY_DATES[stateCode].runoffDate && (
              <span>
                {' · Runoff: '}
                <span style={{ fontWeight: 600, color: isPrimaryPast(PRIMARY_DATES[stateCode].runoffDate!) ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                  {formatPrimaryDate(PRIMARY_DATES[stateCode].runoffDate!)}
                </span>
              </span>
            )}
          </>
        )}
      </p>

      {totalRaces === 0 && (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>
          No primary races found for {stateName}.
        </div>
      )}

      {/* Chamber sections — styled to match landing page tabs/headings */}
      <div style={{ borderBottom: '2px solid var(--border)' }} className="mb-4">
        <div className="flex gap-0">
          {senateRaces.length > 0 && (
            <div className="px-3 py-2 text-sm font-semibold" style={{ color: 'var(--text-primary)', borderBottom: '2px solid var(--text-primary)', marginBottom: '-2px' }}>
              Senate
              <span className="text-xs tabular-nums ml-1 opacity-50">{senateRaces.length}</span>
            </div>
          )}
          {houseRaces.length > 0 && (
            <div className="px-3 py-2 text-sm font-semibold" style={{ color: 'var(--text-primary)', borderBottom: '2px solid var(--text-primary)', marginBottom: '-2px' }}>
              House
              <span className="text-xs tabular-nums ml-1 opacity-50">{houseRaces.length}</span>
            </div>
          )}
        </div>
      </div>

      {senateRaces.length > 0 && (
        <section className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {senateRaces.map((race) => <RaceCard key={race.race_id} race={race} />)}
          </div>
        </section>
      )}

      {houseRaces.length > 0 && (
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {houseRaces.map((race) => <RaceCard key={race.race_id} race={race} />)}
          </div>
        </section>
      )}
    </div>
  );
}
