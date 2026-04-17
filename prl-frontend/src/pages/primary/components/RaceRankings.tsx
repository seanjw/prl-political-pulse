import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MIN_STATEMENTS_TO_RANK, PRIMARY_CATEGORIES, PRIMARY_CATEGORY_KEYS } from '../../../config/primaryCategories';
import type { PrimaryCandidate } from '../../../types/primary';

interface RaceRankingsProps {
  candidates: PrimaryCandidate[];
}

export function RaceRankings({ candidates }: RaceRankingsProps) {
  const leaders = useMemo(() => {
    return PRIMARY_CATEGORY_KEYS.map((key) => {
      const cat = PRIMARY_CATEGORIES[key];
      const withData = candidates.filter(
        (c) => c.rhetoric_data_available && c.statement_count >= MIN_STATEMENTS_TO_RANK
      );
      const sorted = [...withData].sort((a, b) => (b.rhetoric[key] || 0) - (a.rhetoric[key] || 0));
      const top = sorted[0];
      return { key, cat, top, value: top ? Math.round((top.rhetoric[key] || 0) * 100) : 0 };
    });
  }, [candidates]);

  if (candidates.length < 2) return null;

  return (
    <div>
      <div className="text-xs font-semibold tracking-[0.1em] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
        Category Leaders
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-0" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        {leaders.map(({ key, cat, top, value }) => {
          if (!top) return null;
          const partyColor = top.party === 'Democrat' ? '#2563eb' : '#dc2626';
          return (
            <Link
              key={key}
              to={`/primary/candidate/${top.candidate_id}`}
              className="py-1.5 px-1.5 text-center transition-colors"
              style={{ borderRight: '1px solid var(--border)' }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div className="text-[11px] font-medium truncate mb-0.5" style={{ color: 'var(--text-muted)' }}>
                {cat.label}
              </div>
              <div className="text-sm font-bold tabular-nums leading-none" style={{ color: 'var(--text-primary)' }}>
                {value}%
              </div>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span className="w-1 h-1 rounded-full" style={{ background: partyColor }} />
                <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {top.name.split(' ').pop()}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
