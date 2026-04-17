import { useState } from 'react';
import { Link } from 'react-router-dom';
import { COMPETITIVE_RACES, CHAMBER_BALANCE, type RatingGroup, type CompetitiveRaceEntry, type ChamberBalance } from '../../../config/competitiveRaces';
import type { PrimaryRace } from '../../../types/primary';

interface CompetitiveRacesProps {
  raceMap: Map<string, PrimaryRace>;
}

const RATING_STYLES: Record<string, { accent: string; bgStrip: string; dotBg: string }> = {
  'Lean D': { accent: '#2563eb', bgStrip: 'rgba(37, 99, 235, 0.06)', dotBg: 'rgba(37, 99, 235, 0.12)' },
  'Toss Up': { accent: '#7c3aed', bgStrip: 'rgba(124, 58, 237, 0.05)', dotBg: 'rgba(124, 58, 237, 0.12)' },
  'Lean R': { accent: '#dc2626', bgStrip: 'rgba(220, 38, 38, 0.06)', dotBg: 'rgba(220, 38, 38, 0.12)' },
};

type Chamber = 'house' | 'senate';

export function CompetitiveRaces({ raceMap }: CompetitiveRacesProps) {
  const [chamber, setChamber] = useState<Chamber>('house');
  const groups = COMPETITIVE_RACES[chamber];
  const houseTotal = COMPETITIVE_RACES.house.reduce((s, g) => s + g.races.length, 0);
  const senateTotal = COMPETITIVE_RACES.senate.reduce((s, g) => s + g.races.length, 0);

  return (
    <div>
      {/* Chamber toggle — left aligned */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="inline-flex rounded p-0.5"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          {(['house', 'senate'] as Chamber[]).map((c) => {
            const active = chamber === c;
            const count = c === 'house' ? houseTotal : senateTotal;
            return (
              <button
                key={c}
                onClick={() => setChamber(c)}
                className="px-2.5 py-1 text-sm font-semibold rounded-[3px] transition-all flex items-center gap-1"
                style={{
                  background: active ? 'var(--bg-primary)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {c === 'house' ? 'House' : 'Senate'}
                <span className="text-xs tabular-nums opacity-50">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Balance bar */}
      <CompetitivenessBar balance={CHAMBER_BALANCE[chamber]} />

      {/* Rating columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {groups.map((group) => (
          <RatingColumn key={group.rating} group={group} raceMap={raceMap} />
        ))}
      </div>
    </div>
  );
}

function RatingColumn({ group, raceMap }: { group: RatingGroup; raceMap: Map<string, PrimaryRace> }) {
  const s = RATING_STYLES[group.rating];

  return (
    <div
      className="rounded overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
    >
      {/* Header */}
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ borderBottom: `2px solid ${s.accent}` }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold" style={{ color: s.accent }}>{group.rating}</span>
          <span
            className="text-[11px] font-bold tabular-nums px-1 rounded-full"
            style={{ background: s.dotBg, color: s.accent }}
          >
            {group.races.length}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold tabular-nums">
          {group.demSeats > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#2563eb' }} />
              <span style={{ color: '#2563eb' }}>{group.demSeats}</span>
            </span>
          )}
          {group.demSeats > 0 && group.repSeats > 0 && (
            <span style={{ color: 'var(--border-light)', margin: '0 1px' }}>/</span>
          )}
          {group.repSeats > 0 && (
            <span className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#dc2626' }} />
              <span style={{ color: '#dc2626' }}>{group.repSeats}</span>
            </span>
          )}
        </div>
      </div>

      {/* Races */}
      {group.races.map((race, i) => (
        <RaceEntry key={race.raceId} race={race} raceMap={raceMap} odd={i % 2 === 1} bgStrip={s.bgStrip} />
      ))}
    </div>
  );
}

function RaceEntry({
  race,
  raceMap,
  odd,
  bgStrip,
}: {
  race: CompetitiveRaceEntry;
  raceMap: Map<string, PrimaryRace>;
  odd: boolean;
  bgStrip: string;
}) {
  const exists = raceMap.has(race.raceId);
  const partyColor = race.party === 'D' ? '#2563eb' : '#dc2626';
  const isOpen = race.label.startsWith('OPEN');

  const content = (
    <div
      className="flex items-center gap-2 px-3 py-[5px]"
      style={{ background: odd ? bgStrip : 'transparent' }}
    >
      <div className="w-1 h-1 rounded-full shrink-0" style={{ background: partyColor }} />
      <span
        className="text-[13px] font-bold tabular-nums shrink-0"
        style={{ color: 'var(--text-primary)', minWidth: '2.5rem' }}
      >
        {race.raceId.replace('-S', '')}
      </span>
      <span
        className="text-[13px] flex-1 truncate"
        style={{
          color: isOpen ? 'var(--text-muted)' : 'var(--text-secondary)',
          fontStyle: isOpen ? 'italic' : 'normal',
        }}
      >
        {race.label}
      </span>
    </div>
  );

  if (exists) {
    return (
      <Link
        to={`/primary/race/${race.raceId}`}
        className="block"
        onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
        onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {content}
      </Link>
    );
  }

  return content;
}

function CompetitivenessBar({ balance }: { balance: ChamberBalance }) {
  // Compute D/R totals from segments
  const demSeats = balance.segments
    .filter((s) => s.label.includes('D'))
    .reduce((sum, s) => sum + s.count, 0);
  const repSeats = balance.segments
    .filter((s) => s.label.includes('R'))
    .reduce((sum, s) => sum + s.count, 0);
  const tossUp = balance.segments
    .filter((s) => s.label === 'Toss Up')
    .reduce((sum, s) => sum + s.count, 0);
  const competitive = balance.total - balance.segments[0].count - balance.segments[balance.segments.length - 1].count;

  // Position the indicator: D seats as % of total
  const indicatorPct = (demSeats / balance.total) * 100;

  return (
    <div
      className="rounded-xl px-5 py-4 mb-4"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <div className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}>
        Race Competitiveness
      </div>

      {/* Stats row */}
      <div className="flex justify-between mb-3">
        <div className="text-center">
          <div className="text-xl font-bold tabular-nums" style={{ color: '#2563eb' }}>{demSeats}</div>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Dem seats</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-secondary)' }}>{competitive}</div>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Competitive</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-secondary)' }}>{tossUp}</div>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Toss-up</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold tabular-nums" style={{ color: '#dc2626' }}>{repSeats}</div>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Rep seats</div>
        </div>
      </div>

      {/* Gradient bar with indicator */}
      <div className="relative" style={{ padding: '0 8px' }}>
        <div
          className="rounded-full overflow-hidden"
          style={{
            height: 14,
            background: 'linear-gradient(to right, #2563eb 0%, #93a8d4 30%, #b0b0b0 50%, #d4939a 70%, #dc2626 100%)',
          }}
        />
        {/* Indicator dot */}
        <div
          className="absolute top-1/2"
          style={{
            left: `calc(${indicatorPct}% )`,
            transform: 'translate(-50%, -50%)',
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#fff',
            border: '3px solid var(--text-primary)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }}
        />
      </div>

      {/* End labels */}
      <div className="flex justify-between mt-1.5" style={{ padding: '0 8px' }}>
        <span className="text-[11px] font-medium" style={{ color: '#2563eb' }}>Democrat</span>
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{balance.majority} to win</span>
        <span className="text-[11px] font-medium" style={{ color: '#dc2626' }}>Republican</span>
      </div>
    </div>
  );
}
