import { Link } from 'react-router-dom';

interface PrimaryHeroProps {
  candidateCount: number;
  raceCount: number;
  stateCount: number;
  demCount: number;
  repCount: number;
}

export function PrimaryHero({ candidateCount, raceCount, stateCount, demCount, repCount }: PrimaryHeroProps) {
  return (
    <div
      className="relative overflow-hidden -mx-4 md:-mx-6 px-6 md:px-10 pt-10 pb-8 mb-8"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
      }}
    >
      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 max-w-[1600px] mx-auto">
        {/* Kicker */}
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 max-w-[40px]" style={{ background: '#f59e0b' }} />
          <span
            className="text-xs font-semibold tracking-[0.2em] uppercase"
            style={{ color: '#f59e0b', fontFamily: "'Source Sans 3', sans-serif" }}
          >
            Polarization Research Lab
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.05] mb-3 max-w-3xl"
          style={{ color: '#ffffff', fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          2026 Primary
          <br />
          Elections
        </h1>

        <p
          className="text-base md:text-lg mb-8 max-w-xl leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.6)', fontFamily: "'Source Sans 3', sans-serif" }}
        >
          Tracking the rhetoric and positioning of {candidateCount.toLocaleString()} candidates
          across {raceCount} races in the U.S. House and Senate primaries.
        </p>

        {/* Stats row — big editorial numbers */}
        <div className="flex flex-wrap gap-x-10 gap-y-4 items-baseline">
          <StatFigure value={candidateCount.toLocaleString()} label="Candidates" />
          <StatFigure value={raceCount.toLocaleString()} label="Races" />
          <StatFigure value={stateCount.toString()} label="States" />
          <div className="h-8 w-px hidden sm:block" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <StatFigure value={demCount.toLocaleString()} label="Democrats" color="#60a5fa" />
          <StatFigure value={repCount.toLocaleString()} label="Republicans" color="#f87171" />
        </div>

        {/* About link */}
        <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link
            to="/primary/about"
            className="text-xs tracking-wide hover:underline"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            About this data &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatFigure({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div>
      <div
        className="text-3xl md:text-4xl font-bold tabular-nums leading-none"
        style={{ color: color || '#ffffff', fontFamily: "'Source Serif 4', Georgia, serif" }}
      >
        {value}
      </div>
      <div
        className="text-[11px] font-medium tracking-wider uppercase mt-1"
        style={{ color: 'rgba(255,255,255,0.4)' }}
      >
        {label}
      </div>
    </div>
  );
}
