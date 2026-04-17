import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { PrimaryRace, FeaturedRace } from '../../../types/primary';

interface PrimaryFeaturedRacesProps {
  raceMap: Map<string, PrimaryRace>;
}

export function PrimaryFeaturedRaces({ raceMap }: PrimaryFeaturedRacesProps) {
  const [featured, setFeatured] = useState<FeaturedRace[]>([]);

  useEffect(() => {
    fetch('/data/primary/featured.json')
      .then((r) => r.json())
      .then(setFeatured)
      .catch(() => {});
  }, []);

  if (featured.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2
          className="text-lg font-bold"
          style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          Races to Watch
        </h2>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>

      <div className="space-y-2">
        {featured.map((f) => {
          const race = raceMap.get(f.race_id);
          if (!race) return null;
          return <FeaturedRaceRow key={f.race_id} race={race} featured={f} />;
        })}
      </div>
    </div>
  );
}

function FeaturedRaceRow({ race, featured }: { race: PrimaryRace; featured: FeaturedRace }) {
  const isSenate = race.office === 'S';

  return (
    <Link
      to={`/primary/race/${race.race_id}`}
      className="block px-4 py-3 transition-colors rounded-md"
      style={{ border: '1px solid var(--border)' }}
      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div className="flex items-center gap-3">
        {/* State badge */}
        <div
          className="w-9 h-9 rounded flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            background: isSenate
              ? 'linear-gradient(135deg, #7c3aed20, #7c3aed08)'
              : 'linear-gradient(135deg, #0891b220, #0891b208)',
            color: isSenate ? '#7c3aed' : '#0891b2',
          }}
        >
          {race.state}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
            {featured.title}
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {featured.description}
          </div>
        </div>

        {/* Party split bar */}
        <div className="flex items-center gap-1 shrink-0">
          <PartyDots count={race.candidates.democrat.length} color="#2563eb" />
          <PartyDots count={race.candidates.republican.length} color="#dc2626" />
        </div>
      </div>
    </Link>
  );
}

function PartyDots({ count, color }: { count: number; color: string }) {
  const display = Math.min(count, 5);
  return (
    <div className="flex items-center gap-[2px]">
      {Array.from({ length: display }).map((_, i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: color, opacity: 0.7 + (i * 0.06) }}
        />
      ))}
      {count > 5 && (
        <span className="text-[9px] ml-0.5 tabular-nums" style={{ color }}>
          +{count - 5}
        </span>
      )}
    </div>
  );
}
