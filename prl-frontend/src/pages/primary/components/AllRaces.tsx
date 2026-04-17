import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { PrimaryCandidate, PrimaryRace } from '../../../types/primary';

interface AllRacesProps {
  races: PrimaryRace[];
  candidateMap: Map<string, PrimaryCandidate>;
}

interface StateGroup {
  state: string;
  stateName: string;
  races: PrimaryRace[];
}

export function AllRaces({ races, candidateMap }: AllRacesProps) {
  const stateGroups = useMemo(() => {
    const map = new Map<string, PrimaryRace[]>();
    for (const race of races) {
      const list = map.get(race.state) || [];
      list.push(race);
      map.set(race.state, list);
    }
    const groups: StateGroup[] = [];
    for (const [state, stateRaces] of map) {
      // Senate first, then house sorted by district
      stateRaces.sort((a, b) => {
        if (a.office !== b.office) return a.office === 'S' ? -1 : 1;
        return Number(a.district) - Number(b.district);
      });
      groups.push({ state, stateName: stateRaces[0].state_name, races: stateRaces });
    }
    groups.sort((a, b) => a.stateName.localeCompare(b.stateName));
    return groups;
  }, [races]);

  if (races.length === 0) {
    return (
      <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
        No races match the current filters.
      </div>
    );
  }

  return (
    <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {stateGroups.map((group, gi) => (
        <div key={group.state} style={{ borderTop: gi > 0 ? '1px solid var(--border)' : undefined }}>
          {/* State header */}
          <div
            className="px-3 py-1.5 flex items-center gap-2 sticky top-0 z-10"
            style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
          >
            <Link
              to={`/primary/state/${group.state}`}
              className="text-sm font-bold hover:underline"
              style={{ color: 'var(--text-primary)' }}
            >
              {group.stateName}
            </Link>
            <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {group.races.length} {group.races.length === 1 ? 'race' : 'races'}
            </span>
          </div>

          {/* Races in this state */}
          {group.races.map((race) => {
            const isSenate = race.office === 'S';
            const accentColor = isSenate ? '#7c3aed' : '#0891b2';
            const allCandidateIds = [...race.candidates.democrat, ...race.candidates.republican];
            const candidates = allCandidateIds
              .map((id) => candidateMap.get(id))
              .filter((c): c is PrimaryCandidate => !!c);

            return (
              <div key={race.race_id} style={{ borderBottom: '1px solid var(--border)' }}>
                {/* Race row */}
                <Link
                  to={`/primary/race/${race.race_id}`}
                  className="flex items-center gap-2 px-3 py-[5px] transition-colors"
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span
                    className="text-xs font-bold uppercase tracking-wide w-12 shrink-0"
                    style={{ color: accentColor }}
                  >
                    {isSenate ? 'SEN' : `${race.state}-${race.district}`}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {race.display_name}
                  </span>
                  <span className="text-xs tabular-nums ml-auto shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {race.candidates.democrat.length > 0 && (
                      <span style={{ color: '#2563eb' }}>{race.candidates.democrat.length}D</span>
                    )}
                    {race.candidates.democrat.length > 0 && race.candidates.republican.length > 0 && ' / '}
                    {race.candidates.republican.length > 0 && (
                      <span style={{ color: '#dc2626' }}>{race.candidates.republican.length}R</span>
                    )}
                  </span>
                </Link>

                {/* Candidates */}
                {candidates.length > 0 && (
                  <div className="px-3 pb-1.5 flex flex-wrap gap-x-3 gap-y-0.5 ml-14">
                    {candidates.map((c) => {
                      const partyColor = c.party === 'Democrat' ? '#2563eb' : '#dc2626';
                      const statusLabel = c.incumbent_challenge === 'I' ? 'inc' : c.incumbent_challenge === 'O' ? 'open' : '';
                      return (
                        <Link
                          key={c.candidate_id}
                          to={`/primary/candidate/${c.candidate_id}`}
                          className="flex items-center gap-1 text-xs hover:underline"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <span className="w-1 h-1 rounded-full shrink-0" style={{ background: partyColor }} />
                          <span>{c.name}</span>
                          {statusLabel && (
                            <span className="text-[11px] uppercase" style={{ color: 'var(--text-muted)' }}>
                              {statusLabel}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
