import { Link } from 'react-router-dom';
import type { PrimaryRace } from '../../../types/primary';

interface StatePopupProps {
  stateName: string;
  stateCode: string;
  races: PrimaryRace[];
  onClose: () => void;
}

export function StatePopup({ stateName, stateCode, races, onClose }: StatePopupProps) {
  const senateRaces = races.filter((r) => r.office === 'S');
  const houseRaces = races.filter((r) => r.office === 'H');
  const totalCandidates = races.reduce((sum, r) => sum + r.candidate_count, 0);

  return (
    <div
      className="absolute z-20 top-12 right-3 w-72 shadow-2xl overflow-hidden"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderTop: '3px solid #f59e0b',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between">
        <div>
          <h4
            className="text-base font-bold leading-tight"
            style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            {stateName}
          </h4>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {totalCandidates} candidates &middot; {races.length} {races.length === 1 ? 'race' : 'races'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 hover:opacity-60 transition-opacity -mt-0.5"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Races list */}
      <div className="max-h-56 overflow-y-auto" style={{ borderTop: '1px solid var(--border)' }}>
        {senateRaces.map((race) => (
          <RaceRow key={race.race_id} race={race} label="SEN" />
        ))}
        {houseRaces.slice(0, 8).map((race) => (
          <RaceRow key={race.race_id} race={race} />
        ))}
        {houseRaces.length > 8 && (
          <div className="px-4 py-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            +{houseRaces.length - 8} more districts
          </div>
        )}
      </div>

      {/* Footer */}
      <Link
        to={`/primary/state/${stateCode}`}
        className="block px-4 py-2.5 text-xs font-semibold text-center transition-colors"
        style={{
          color: '#f59e0b',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-tertiary)',
        }}
      >
        View all {stateName} races &rarr;
      </Link>
    </div>
  );
}

function RaceRow({ race, label }: { race: PrimaryRace; label?: string }) {
  const tag = label || (race.district === '00' ? 'AL' : race.district);
  return (
    <Link
      to={`/primary/race/${race.race_id}`}
      className="flex items-center gap-3 px-4 py-2 transition-colors"
      style={{ borderBottom: '1px solid var(--border)' }}
      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span
        className="text-[10px] font-bold w-7 text-center py-0.5 rounded"
        style={{
          background: label === 'SEN' ? '#7c3aed15' : 'var(--bg-tertiary)',
          color: label === 'SEN' ? '#7c3aed' : 'var(--text-muted)',
        }}
      >
        {tag}
      </span>
      <span className="flex-1 text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
        {race.display_name}
      </span>
      <span className="flex items-center gap-1.5 text-[10px] tabular-nums">
        <span style={{ color: '#2563eb' }}>{race.candidates.democrat.length}</span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: '#dc2626' }}>{race.candidates.republican.length}</span>
      </span>
    </Link>
  );
}
