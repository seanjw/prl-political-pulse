import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { usePrimaryRace } from '../../hooks/usePrimaryRace';
import { COMPETITIVE_RACES } from '../../config/competitiveRaces';
import { PRIMARY_DATES, formatPrimaryDate, daysUntil, getCountdownText, isPrimaryPast } from '../../config/primaryDates';
import { CandidateComparisonTable } from './components/CandidateComparisonTable';

type ViewMode = 'table';

function getCookRatingPosition(rating: string): number {
  if (rating.includes('Lean D')) return 30;
  if (rating.includes('Toss')) return 50;
  if (rating.includes('Lean R')) return 70;
  return 50;
}

export function PrimaryRace() {
  const { raceId } = useParams<{ raceId: string }>();
  const { race, candidates, democrats, republicans, loading, error } = usePrimaryRace(raceId);
  const [viewMode] = useState<ViewMode>('table');

  usePageTitle(race?.display_name || '2026 Primary Race');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error || !race) {
    return (
      <div className="text-center py-32 text-sm" style={{ color: 'var(--text-muted)' }}>
        Race not found. <Link to="/primary" style={{ color: 'var(--accent)' }}>Back to primaries</Link>
      </div>
    );
  }

  const isSenate = race.office === 'S';
  const demPct = candidates.length > 0 ? (democrats.length / candidates.length) * 100 : 50;

  // Look up Cook rating
  let cookRating: string | null = null;
  for (const chamber of [COMPETITIVE_RACES.house, COMPETITIVE_RACES.senate]) {
    for (const group of chamber) {
      if (group.races.some((r) => r.raceId === raceId)) {
        cookRating = group.rating;
      }
    }
  }

  return (
    <div className="py-4 sm:py-6 px-1 sm:px-0">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base mb-4 sm:mb-5 flex-wrap" style={{ color: 'var(--text-muted)' }}>
        <Link to="/primary" className="hover:underline" style={{ color: 'var(--accent)' }}>Primaries</Link>
        <span>/</span>
        <Link to={`/primary/state/${race.state}`} className="hover:underline" style={{ color: 'var(--accent)' }}>{race.state_name}</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>{race.display_name}</span>
      </nav>

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
          <h1
            className="text-xl sm:text-2xl font-bold leading-tight"
            style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            {race.display_name}
          </h1>
          <span className="text-xs font-semibold tracking-[0.1em] uppercase" style={{ color: 'var(--text-muted)' }}>
            {isSenate ? 'Senate' : 'House'}
          </span>
        </div>

        {/* Info cards row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {/* Primary Date card */}
          {race.state && PRIMARY_DATES[race.state] && (() => {
              const info = PRIMARY_DATES[race.state];
              const past = isPrimaryPast(info.date);
              const days = daysUntil(info.date);
              return (
                <div
                  className="rounded-lg px-4 py-3 flex-1 min-w-0 sm:min-w-[220px]"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                  <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}>
                    Primary Election
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-lg font-bold tabular-nums" style={{ color: past ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                      {formatPrimaryDate(info.date)}
                    </div>
                  </div>
                  {!past && (
                    <div
                      className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{
                        background: days <= 30 ? '#fef3c7' : '#ede9fe',
                        color: days <= 30 ? '#92400e' : '#6b21a8',
                      }}
                    >
                      {getCountdownText(info.date)}
                    </div>
                  )}
                  {past && (
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Completed</div>
                  )}
                  {info.runoffDate && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                      <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Runoff</div>
                      <div className="text-sm font-semibold tabular-nums" style={{ color: isPrimaryPast(info.runoffDate) ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        {formatPrimaryDate(info.runoffDate)}
                      </div>
                    </div>
                  )}
                  {info.notes && (
                    <div className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{info.notes}</div>
                  )}
                </div>
              );
            })()}

            {/* Competitiveness gradient */}
            {cookRating && (() => {
              const label = cookRating.replace(' D', ' Democrat').replace(' R', ' Republican');
              return (
                <div
                  className="rounded-lg px-4 py-3 flex-1 min-w-0 sm:min-w-[220px]"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                  <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}>
                    Race Competitiveness
                  </div>
                  <div className="text-lg font-bold mb-0.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {label}
                  </div>
                  <div className="relative mt-2" style={{ padding: '0 6px' }}>
                    <div
                      className="rounded-full"
                      style={{
                        height: 10,
                        background: 'linear-gradient(to right, #2563eb 0%, #93a8d4 30%, #b0b0b0 50%, #d4939a 70%, #dc2626 100%)',
                      }}
                    />
                    <div
                      className="absolute top-1/2"
                      style={{
                        left: `calc(${getCookRatingPosition(cookRating)}%)`,
                        transform: 'translate(-50%, -50%)',
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: '#fff',
                        border: '3px solid var(--text-primary)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1" style={{ padding: '0 6px' }}>
                    <span className="text-[10px] font-medium" style={{ color: '#2563eb' }}>Democrat</span>
                    <span className="text-[10px] font-medium" style={{ color: '#dc2626' }}>Republican</span>
                  </div>
                </div>
              );
            })()}

          {/* Candidates card */}
          <div
            className="rounded-lg px-4 py-3 flex-1 min-w-0 sm:min-w-[220px]"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}>
              Candidates
            </div>
            <div className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {candidates.length}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: '#2563eb' }}>{democrats.length}D</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden flex" style={{ background: 'var(--border)' }}>
                <div className="h-full" style={{ width: `${demPct}%`, background: '#2563eb' }} />
                <div className="h-full" style={{ width: `${100 - demPct}%`, background: '#dc2626' }} />
              </div>
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: '#dc2626' }}>{republicans.length}R</span>
            </div>
            {(() => {
              const incumbent = candidates.find((c) => c.incumbent_challenge === 'I');
              if (!incumbent) return null;
              const color = incumbent.party === 'Democrat' ? '#2563eb' : '#dc2626';
              return (
                <div className="flex items-center gap-2 mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Incumbent:</span>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <Link
                    to={`/primary/candidate/${incumbent.candidate_id}`}
                    className="text-[11px] font-semibold hover:underline"
                    style={{ color }}
                  >
                    {incumbent.name}
                  </Link>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>({incumbent.party})</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* View Content */}
      {viewMode === 'table' && (
        <div className="space-y-4">
          {democrats.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 px-4 py-2" style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#2563eb' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Democratic Primary
                </span>
              </div>
              <CandidateComparisonTable candidates={democrats} />
            </div>
          )}
          {republicans.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 px-4 py-2" style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#dc2626' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Republican Primary
                </span>
              </div>
              <CandidateComparisonTable candidates={republicans} />
            </div>
          )}
        </div>
      )}

    </div>
  );
}
