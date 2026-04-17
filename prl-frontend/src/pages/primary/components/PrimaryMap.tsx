import { useState, useMemo } from 'react';
import { USChoroplethClickable } from '../../../components/Charts/USChoroplethClickable';
import { US_STATES } from '../../../config/elitesCategories';
import { StatePopup } from './StatePopup';
import type { PrimaryRace } from '../../../types/primary';

const STATE_ABBREV_TO_NAME: Record<string, string> = {};
const STATE_NAME_TO_ABBREV: Record<string, string> = {};
US_STATES.forEach((s) => {
  STATE_ABBREV_TO_NAME[s.code] = s.name;
  STATE_NAME_TO_ABBREV[s.name] = s.code;
});

interface PrimaryMapProps {
  races: PrimaryRace[];
}

export function PrimaryMap({ races }: PrimaryMapProps) {
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const mapData = useMemo(() => {
    const countByState: Record<string, number> = {};
    for (const race of races) {
      const stateName = STATE_ABBREV_TO_NAME[race.state];
      if (stateName) {
        countByState[stateName] = (countByState[stateName] || 0) + race.candidate_count;
      }
    }
    return Object.entries(countByState).map(([name, value]) => ({ name, value }));
  }, [races]);

  const stateRaces = useMemo(() => {
    if (!selectedState) return [];
    const code = STATE_NAME_TO_ABBREV[selectedState];
    if (!code) return [];
    return races.filter((r) => r.state === code);
  }, [selectedState, races]);

  const stateCode = selectedState ? STATE_NAME_TO_ABBREV[selectedState] : null;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <h2
          className="text-lg font-bold"
          style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          Race Map
        </h2>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Click a state to explore
        </span>
      </div>
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--border)' }}
      >
        <USChoroplethClickable
          data={mapData}
          tooltipTitle="Candidates"
          colorScale={['#fef3c7', '#fde68a', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e']}
          onStateClick={(stateName) => setSelectedState(stateName)}
          navigateToProfiles={false}
        />
      </div>
      {selectedState && stateCode && (
        <StatePopup
          stateName={selectedState}
          stateCode={stateCode}
          races={stateRaces}
          onClose={() => setSelectedState(null)}
        />
      )}
    </div>
  );
}
