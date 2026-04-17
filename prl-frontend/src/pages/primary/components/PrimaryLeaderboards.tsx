import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MIN_STATEMENTS_TO_RANK, PRIMARY_CATEGORIES, PRIMARY_CATEGORY_KEYS } from '../../../config/primaryCategories';
import type { PrimaryCandidate } from '../../../types/primary';

interface PrimaryLeaderboardsProps {
  candidates: PrimaryCandidate[];
}

export function PrimaryLeaderboards({ candidates }: PrimaryLeaderboardsProps) {
  const [activeTab, setActiveTab] = useState(0);
  const activeKey = PRIMARY_CATEGORY_KEYS[activeTab];
  const activeCategory = PRIMARY_CATEGORIES[activeKey];

  const leaderboards = useMemo(() => {
    const result: Record<string, { dems: PrimaryCandidate[]; reps: PrimaryCandidate[] }> = {};
    for (const key of PRIMARY_CATEGORY_KEYS) {
      const sorted = [...candidates]
        .filter((c) => c.rhetoric_data_available && c.statement_count >= MIN_STATEMENTS_TO_RANK)
        .sort((a, b) => (b.rhetoric[key] || 0) - (a.rhetoric[key] || 0));
      result[key] = {
        dems: sorted.filter((c) => c.party === 'Democrat').slice(0, 5),
        reps: sorted.filter((c) => c.party === 'Republican').slice(0, 5),
      };
    }
    return result;
  }, [candidates]);

  const board = leaderboards[activeKey];

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h2
            className="text-xl font-bold leading-tight"
            style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            Rhetoric Rankings
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Top candidates by rhetoric category ({MIN_STATEMENTS_TO_RANK}+ statements required)
          </p>
        </div>
      </div>

      {/* Category tabs */}
      <div
        className="flex flex-wrap gap-0"
        style={{ borderBottom: '2px solid var(--border)' }}
      >
        {PRIMARY_CATEGORY_KEYS.map((key, idx) => {
          const cat = PRIMARY_CATEGORIES[key];
          const isActive = idx === activeTab;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(idx)}
              className="px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors relative"
              style={{
                color: isActive ? cat.color : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                marginBottom: '-2px',
              }}
            >
              {cat.label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: cat.color }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Description */}
      <div
        className="px-3.5 py-2 text-sm italic"
        style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
      >
        {activeCategory.description}
      </div>

      {/* Two-column leaderboard */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 rounded-b-lg overflow-hidden"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderTop: 'none' }}
      >
        <div style={{ borderRight: '1px solid var(--border)' }}>
          <div
            className="px-3.5 py-1.5 text-xs font-bold tracking-[0.15em] uppercase"
            style={{ color: '#2563eb', borderBottom: '1px solid var(--border)' }}
          >
            Democrats
          </div>
          {board?.dems.map((c, i) => (
            <RankRow key={c.candidate_id} candidate={c} rank={i + 1} categoryKey={activeKey} />
          ))}
          {(!board || board.dems.length === 0) && (
            <div className="px-3.5 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No candidates match filters</div>
          )}
        </div>
        <div>
          <div
            className="px-3.5 py-1.5 text-xs font-bold tracking-[0.15em] uppercase"
            style={{ color: '#dc2626', borderBottom: '1px solid var(--border)' }}
          >
            Republicans
          </div>
          {board?.reps.map((c, i) => (
            <RankRow key={c.candidate_id} candidate={c} rank={i + 1} categoryKey={activeKey} />
          ))}
          {(!board || board.reps.length === 0) && (
            <div className="px-3.5 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No candidates match filters</div>
          )}
        </div>
      </div>
    </section>
  );
}

function RankRow({
  candidate,
  rank,
  categoryKey,
}: {
  candidate: PrimaryCandidate;
  rank: number;
  categoryKey: string;
}) {
  const value = candidate.rhetoric[categoryKey] || 0;
  const pct = Math.round(value * 100);
  const cat = PRIMARY_CATEGORIES[categoryKey];

  return (
    <Link
      to={`/primary/candidate/${candidate.candidate_id}`}
      className="flex items-center gap-3 px-3.5 py-2.5 transition-colors"
      style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}
      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span
        className="text-sm font-bold tabular-nums w-4 text-right"
        style={{ color: rank === 1 ? cat.color : 'var(--text-muted)' }}
      >
        {rank}
      </span>

      <div className="flex-1 min-w-0">
        <div className="text-base font-medium truncate">{candidate.name}</div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {candidate.state}{candidate.office === 'H' ? `-${candidate.district || 'AL'}` : ' Senate'}
        </div>
      </div>

      {/* Bar */}
      <div className="w-20 flex items-center gap-1.5">
        <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(pct * 3, 100)}%`, background: cat.color }}
          />
        </div>
        <span className="text-xs font-mono tabular-nums w-7 text-right" style={{ color: cat.color, fontWeight: 600 }}>
          {pct}%
        </span>
      </div>
    </Link>
  );
}
