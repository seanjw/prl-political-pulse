import { Link } from 'react-router-dom';
import { PARTY_COLORS } from '../../config/elitesCategories';

export interface LeaderboardEntry {
  name: string;
  party: string;
  state: string;
  value: number;
  source_id: string;
}

interface LeaderboardCardProps {
  title: string;
  entries: LeaderboardEntry[];
  partyFilter?: 'Democrat' | 'Republican' | 'all';
  showRank?: boolean;
  categoryColor?: string;
}

export function LeaderboardCard({
  title,
  entries,
  partyFilter,
  showRank = true,
  categoryColor = '#2563eb'
}: LeaderboardCardProps) {
  const filteredEntries = partyFilter && partyFilter !== 'all'
    ? entries.filter(e => e.party === partyFilter)
    : entries;

  const displayEntries = filteredEntries.slice(0, 5);

  return (
    <div
      className="p-4"
      style={{
        background: 'var(--bg-tertiary)',
        borderRadius: '12px',
        borderTop: `3px solid ${categoryColor}`
      }}
    >
      <h4 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h4>
      <div className="space-y-2">
        {displayEntries.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No data available
          </p>
        ) : (
          displayEntries.map((entry, index) => (
            <Link
              key={entry.source_id || `entry-${index}`}
              to={`/elites/profile/${entry.source_id || ''}`}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-opacity-80 transition-colors"
              style={{
                background: 'var(--bg-secondary)',
                textDecoration: 'none'
              }}
            >
              <div className="flex items-center gap-2">
                {showRank && (
                  <span
                    className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                    style={{
                      background: index === 0 ? categoryColor : 'var(--bg-tertiary)',
                      color: index === 0 ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    {index + 1}
                  </span>
                )}
                <div>
                  <p
                    className="font-medium text-sm"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {entry.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span
                      style={{
                        color: PARTY_COLORS[entry.party as keyof typeof PARTY_COLORS] || PARTY_COLORS.Independent
                      }}
                    >
                      {entry.party === 'Democrat' ? 'D' : entry.party === 'Republican' ? 'R' : 'I'}
                    </span>
                    {' - '}{entry.state}
                  </p>
                </div>
              </div>
              <span
                className="font-bold text-sm"
                style={{ color: categoryColor }}
              >
                {typeof entry.value === 'number' ? entry.value.toFixed(1) : '0.0'}%
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
