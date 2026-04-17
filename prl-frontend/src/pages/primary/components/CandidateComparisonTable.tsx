import { useNavigate } from 'react-router-dom';
import { PRIMARY_CATEGORIES, PRIMARY_CATEGORY_KEYS } from '../../../config/primaryCategories';
import type { PrimaryCandidate } from '../../../types/primary';

interface CandidateComparisonTableProps {
  candidates: PrimaryCandidate[];
}

function hasRhetoricData(c: PrimaryCandidate): boolean {
  return PRIMARY_CATEGORY_KEYS.some((key) => (c.rhetoric[key] || 0) > 0);
}

export function CandidateComparisonTable({ candidates }: CandidateComparisonTableProps) {
  const navigate = useNavigate();

  // Sort: candidates with data first (alphabetical), then without data (alphabetical)
  const sorted = [...candidates].sort((a, b) => {
    const aHas = hasRhetoricData(a) ? 0 : 1;
    const bHas = hasRhetoricData(b) ? 0 : 1;
    if (aHas !== bHas) return aHas - bHas;
    return a.name.localeCompare(b.name);
  });

  const maxByCategory: Record<string, number> = {};
  for (const key of PRIMARY_CATEGORY_KEYS) {
    maxByCategory[key] = Math.max(...sorted.map((c) => c.rhetoric[key] || 0));
  }

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="md:hidden divide-y" style={{ borderColor: 'var(--border)' }}>
        {sorted.map((candidate) => {
          const partyColor = candidate.party === 'Democrat' ? '#2563eb' : '#dc2626';
          return (
            <div
              key={candidate.candidate_id}
              className="px-4 py-3 cursor-pointer group relative"
              title="See details"
              onClick={() => navigate(`/primary/candidate/${candidate.candidate_id}`)}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: partyColor }} />
                <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{candidate.name}</span>
                {candidate.incumbent_challenge === 'I' && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Inc.</span>
                )}
                <span className="text-[11px] font-medium ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent)' }}>
                  See details &rarr;
                </span>
              </div>
              {hasRhetoricData(candidate) ? (
                <div className="space-y-1.5">
                  {PRIMARY_CATEGORY_KEYS.map((key) => {
                    const cat = PRIMARY_CATEGORIES[key];
                    const value = candidate.rhetoric[key] || 0;
                    const pct = Math.round(value * 100);
                    const isMax = value === maxByCategory[key] && sorted.length > 1;
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{cat.label}</span>
                          <span
                            className="text-[11px] tabular-nums"
                            style={{ color: isMax ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: isMax ? 700 : 400 }}
                          >
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cat.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs italic py-1 text-center" style={{ color: 'var(--text-muted)' }}>No data</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '160px' }} />
            {PRIMARY_CATEGORY_KEYS.map((key) => (
              <col key={key} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                className="text-left px-3 py-1.5 font-semibold text-xs sticky left-0 z-10 uppercase tracking-[0.05em]"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
              >
                Candidate
              </th>
              {PRIMARY_CATEGORY_KEYS.map((key) => {
                const cat = PRIMARY_CATEGORIES[key];
                return (
                  <th
                    key={key}
                    className="text-left px-2 py-1.5 whitespace-nowrap"
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '12px',
                      fontWeight: 600,
                      letterSpacing: '0.03em',
                      borderBottom: '1px solid var(--border)',
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    {cat.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((candidate) => {
              const partyColor = candidate.party === 'Democrat' ? '#2563eb' : '#dc2626';
              return (
                <tr
                  key={candidate.candidate_id}
                  className="cursor-pointer group"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  title="See details"
                  onClick={() => navigate(`/primary/candidate/${candidate.candidate_id}`)}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-3 py-2 sticky left-0 z-10" style={{ background: 'inherit' }}>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: partyColor }} />
                      <span className="font-medium text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{candidate.name}</span>
                      {candidate.incumbent_challenge === 'I' && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Inc.</span>
                      )}
                      <span className="text-[11px] font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent)' }}>
                        See details &rarr;
                      </span>
                    </div>
                  </td>
                  {hasRhetoricData(candidate) ? (
                    PRIMARY_CATEGORY_KEYS.map((key) => {
                      const cat = PRIMARY_CATEGORIES[key];
                      const value = candidate.rhetoric[key] || 0;
                      const pct = Math.round(value * 100);
                      const isMax = value === maxByCategory[key] && sorted.length > 1;
                      return (
                        <td
                          key={key}
                          className="px-2 py-2"
                        >
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-[14px] rounded-sm overflow-hidden" style={{ background: 'var(--border)' }}>
                              <div
                                className="h-full rounded-sm"
                                style={{
                                  width: `${pct}%`,
                                  background: cat.color,
                                }}
                              />
                            </div>
                            <span
                              className="text-xs tabular-nums shrink-0 w-8 text-right"
                              style={{
                                color: isMax ? 'var(--text-primary)' : 'var(--text-muted)',
                                fontWeight: isMax ? 700 : 400,
                              }}
                            >
                              {pct}%
                            </span>
                          </div>
                        </td>
                      );
                    })
                  ) : (
                    <td colSpan={PRIMARY_CATEGORY_KEYS.length} className="px-2 py-2 text-xs italic text-center" style={{ color: 'var(--text-muted)' }}>
                      No data
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
