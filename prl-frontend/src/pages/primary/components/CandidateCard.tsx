import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PRIMARY_CATEGORIES, PRIMARY_CATEGORY_KEYS } from '../../../config/primaryCategories';
import type { PrimaryCandidate } from '../../../types/primary';

function getInitials(name: string): string {
  const parts = name.replace(/^(Rep\.|Sen\.|Dr\.|Mr\.|Mrs\.|Ms\.)\s*/i, '').trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function CardAvatar({ name, partyColor, imageUrl: storedUrl, bioguideId }: { name: string; partyColor: string; imageUrl?: string; bioguideId?: string }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = !failed
    ? storedUrl
      ? `https://americaspoliticalpulse.com${storedUrl}`
      : bioguideId
        ? `https://www.congress.gov/img/member/${bioguideId.toLowerCase()}_200.jpg`
        : null
    : null;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="rounded-full shrink-0 object-cover"
        style={{ width: 28, height: 28, border: `1.5px solid ${partyColor}` }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{
        width: 28, height: 28, background: partyColor,
        fontFamily: "'Source Serif 4', Georgia, serif",
        fontSize: 11, fontWeight: 700, color: '#fff',
      }}
    >
      {getInitials(name)}
    </div>
  );
}

interface CandidateCardProps {
  candidate: PrimaryCandidate;
}

export function CandidateCard({ candidate }: CandidateCardProps) {
  const partyColor = candidate.party === 'Democrat' ? '#2563eb' : '#dc2626';
  const isIncumbent = candidate.incumbent_challenge === 'I';
  const hasData = candidate.rhetoric_data_available;

  return (
    <Link
      to={`/primary/candidate/${candidate.candidate_id}`}
      className="block transition-all rounded-lg overflow-hidden"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${partyColor}`,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-2 min-w-0">
            <CardAvatar name={candidate.name} partyColor={partyColor} imageUrl={candidate.image_url} bioguideId={candidate.bioguide_id} />
            <h4
              className="text-sm font-bold truncate leading-tight"
              style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}
            >
              {candidate.name}
            </h4>
          </div>
          {isIncumbent && (
            <span
              className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
              style={{ background: '#f59e0b', color: '#fff' }}
            >
              Incumbent
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5" style={{ paddingLeft: 36 }}>
          <span className="text-[10px] font-semibold" style={{ color: partyColor }}>
            {candidate.party === 'Democrat' ? 'D' : 'R'}
          </span>
          {candidate.twitter_handle && (
            <>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>&middot;</span>
              <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                @{candidate.twitter_handle.length > 14 ? candidate.twitter_handle.slice(0, 14) + '\u2026' : candidate.twitter_handle}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Rhetoric bars or no-data message */}
      <div className="px-3 pb-3">
        {hasData ? (
          <div className="flex flex-col gap-[5px]">
            {PRIMARY_CATEGORY_KEYS.map((key) => {
              const cat = PRIMARY_CATEGORIES[key];
              const pct = Math.round((candidate.rhetoric[key] || 0) * 100);
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className="text-[9px] font-medium shrink-0 text-right"
                    style={{ color: cat.color, width: '78px' }}
                  >
                    {cat.label}
                  </span>
                  <div
                    className="flex-1 h-[7px] rounded-sm overflow-hidden"
                    style={{ background: 'var(--bg-primary)' }}
                  >
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${pct}%`,
                        background: cat.color,
                        opacity: 0.85,
                        minWidth: pct > 0 ? '2px' : '0',
                      }}
                    />
                  </div>
                  <span
                    className="text-[9px] font-semibold tabular-nums shrink-0"
                    style={{ color: 'var(--text-muted)', width: '22px', textAlign: 'right' }}
                  >
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="text-[10px] italic py-3 text-center rounded"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-primary)' }}
          >
            {candidate.statement_count > 0 ? 'Not enough data' : 'No social media data'}
          </div>
        )}
      </div>
    </Link>
  );
}
