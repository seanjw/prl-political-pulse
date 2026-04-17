import { Link } from 'react-router-dom';
import type { PrimaryRace } from '../../../types/primary';
import { PRIMARY_DATES, formatPrimaryDate, getCountdownText, isPrimaryPast } from '../../../config/primaryDates';

interface RaceCardProps {
  race: PrimaryRace;
  description?: string;
}

export function RaceCard({ race, description }: RaceCardProps) {
  const isSenate = race.office === 'S';
  const demCount = race.candidates.democrat.length;
  const repCount = race.candidates.republican.length;
  const total = demCount + repCount;
  const demPct = total > 0 ? (demCount / total) * 100 : 50;

  return (
    <Link
      to={`/primary/race/${race.race_id}`}
      className="block p-4 transition-all group"
      style={{ border: '1px solid var(--border)', borderLeft: `3px solid ${isSenate ? '#7c3aed' : '#0891b2'}` }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'var(--bg-secondary)';
        e.currentTarget.style.borderColor = 'var(--border-light)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div className="flex items-baseline justify-between mb-1">
        <h4
          className="text-sm font-bold leading-tight"
          style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          {race.display_name}
        </h4>
        <span className="text-[10px] font-bold tracking-wider uppercase ml-2 shrink-0"
          style={{ color: isSenate ? '#7c3aed' : '#0891b2' }}
        >
          {isSenate ? 'SEN' : 'HOUSE'}
        </span>
      </div>

      {description && (
        <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      )}

      {/* Party split bar */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] font-bold tabular-nums" style={{ color: '#2563eb' }}>{demCount}D</span>
        <div className="flex-1 h-1 rounded-full overflow-hidden flex" style={{ background: 'var(--border)' }}>
          <div className="h-full" style={{ width: `${demPct}%`, background: '#2563eb' }} />
          <div className="h-full" style={{ width: `${100 - demPct}%`, background: '#dc2626' }} />
        </div>
        <span className="text-[10px] font-bold tabular-nums" style={{ color: '#dc2626' }}>{repCount}R</span>
      </div>

      {/* Primary date */}
      {race.state && PRIMARY_DATES[race.state] && (
        <div className="flex items-center gap-1 mt-1.5" style={{ color: isPrimaryPast(PRIMARY_DATES[race.state].date) ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
          <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          <span className="text-[10px]">
            {formatPrimaryDate(PRIMARY_DATES[race.state].date)}
            {!isPrimaryPast(PRIMARY_DATES[race.state].date) && (
              <span style={{ color: 'var(--text-muted)' }}>{' '}({getCountdownText(PRIMARY_DATES[race.state].date)})</span>
            )}
          </span>
        </div>
      )}
    </Link>
  );
}
