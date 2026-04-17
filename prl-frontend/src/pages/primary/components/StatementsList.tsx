import { PRIMARY_CATEGORIES } from '../../../config/primaryCategories';
import type { PrimaryStatement } from '../../../types/primary';

interface StatementsListProps {
  statements: PrimaryStatement[];
  twitterHandle?: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  twitter: 'On X',
  campaign_website: 'Campaign',
  press_release: 'Press Release',
  statements: 'Statement',
  newsletters: 'Newsletter',
  floor: 'Floor',
};

export function StatementsList({ statements, twitterHandle }: StatementsListProps) {
  if (statements.length === 0) {
    return (
      <div className="py-8 text-center text-sm italic" style={{ color: 'var(--text-muted)' }}>
        No statements available.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {statements.map((stmt) => {
        const tweetUrl = stmt.source === 'twitter' && twitterHandle && stmt.tweet_id
          ? `https://x.com/${twitterHandle}/status/${stmt.tweet_id}`
          : null;

        return (
          <div
            key={stmt.id}
            className="p-3 rounded-lg"
            style={{ background: 'var(--bg-secondary)' }}
          >
            {/* Meta: source badge + date + category pills */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              >
                {SOURCE_LABELS[stmt.source] || stmt.source}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {new Date(stmt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {stmt.categories.map((cat) => {
                const catInfo = PRIMARY_CATEGORIES[cat];
                if (!catInfo) return null;
                return (
                  <span
                    key={cat}
                    className="px-2 py-0.5 rounded text-xs font-medium text-white"
                    style={{ background: catInfo.color }}
                  >
                    {catInfo.label}
                  </span>
                );
              })}
            </div>

            {/* Statement text */}
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)', marginBottom: 0 }}>
              {stmt.text && stmt.text.length > 300 ? `${stmt.text.slice(0, 300)}...` : stmt.text}
            </p>

            {/* View original link */}
            {tweetUrl && (
              <a
                href={tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--accent)' }}
              >
                View original
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                </svg>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
