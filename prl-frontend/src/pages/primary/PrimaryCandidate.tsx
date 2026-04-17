import { useParams, Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { usePrimaryCandidate } from '../../hooks/usePrimaryCandidate';
import { COMPETITIVE_RACES } from '../../config/competitiveRaces';
import { PRIMARY_DATES, formatPrimaryDate, getCountdownText, isPrimaryPast } from '../../config/primaryDates';
import { RhetoricBreakdownChart } from './components/RhetoricBreakdownChart';
import { StatementsList } from './components/StatementsList';
import { getAwardConfig } from '../../config/primaryAwards';

function getCookRating(raceId: string | undefined): string | null {
  if (!raceId) return null;
  for (const chamber of [COMPETITIVE_RACES.house, COMPETITIVE_RACES.senate]) {
    for (const group of chamber) {
      if (group.races.some((r) => r.raceId === raceId)) {
        return group.rating.replace(' D', ' Democrat').replace(' R', ' Republican');
      }
    }
  }
  return null;
}

// Position on 0–100 scale: 0 = most Democrat, 100 = most Republican
function getCookRatingPosition(rating: string): number {
  if (rating.includes('Lean Democrat')) return 30;
  if (rating.includes('Toss')) return 50;
  if (rating.includes('Lean Republican')) return 70;
  return 50;
}

function formatNumber(n: number | undefined): string {
  if (n == null) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDollars(n: number | undefined): string {
  if (n == null || n === 0) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PrimaryCandidate() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const { candidate, race, statements, loading, error } = usePrimaryCandidate(candidateId);

  usePageTitle(candidate?.name || '2026 Primary Candidate');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="text-center py-32 text-sm" style={{ color: 'var(--text-muted)' }}>
        Candidate not found. <Link to="/primary" style={{ color: 'var(--accent)' }}>Back to primaries</Link>
      </div>
    );
  }

  const partyColor = candidate.party === 'Democrat' ? '#2563eb' : '#dc2626';
  const statusLabel =
    candidate.incumbent_challenge === 'I' ? 'Incumbent' :
    candidate.incumbent_challenge === 'C' ? 'Challenger' : 'Open Seat';
  const districtLabel = candidate.office === 'S'
    ? `${candidate.state} Senate`
    : `${candidate.state}-${candidate.district || 'AL'}`;
  const cookRating = getCookRating(race?.race_id);
  const hasEngagement = candidate.follower_count != null || candidate.avg_likes != null;

  return (
    <div className="py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-base mb-5 flex-wrap" style={{ color: 'var(--text-muted)' }}>
        <Link to="/primary" className="hover:underline" style={{ color: 'var(--accent)' }}>Primaries</Link>
        <span>/</span>
        {race && (
          <>
            <Link to={`/primary/race/${race.race_id}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
              {race.display_name}
            </Link>
            <span>/</span>
          </>
        )}
        <span style={{ color: 'var(--text-primary)' }}>{candidate.name}</span>
      </nav>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left — candidate info (sticky) */}
        <div className="lg:col-span-2">
          <div className="sticky top-4 space-y-4">
            {/* Name + pills + social links */}
            <div>
              <div className="flex items-start gap-4 mb-3">
                <CandidateAvatar name={candidate.name} partyColor={partyColor} imageUrl={candidate.image_url} bioguideId={candidate.bioguide_id} size={96} />
                <div>
                  <h1
                    className="text-2xl font-bold leading-tight mb-1.5"
                    style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}
                  >
                    {candidate.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: partyColor }}>
                  {candidate.party}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  {candidate.state}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  {candidate.office_full || (candidate.office === 'S' ? 'Senate' : 'House')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  {statusLabel}
                </span>
                  </div>
                </div>
              </div>
              {cookRating && (
                <div
                  className="mt-2 mb-3 rounded-lg px-4 py-3"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                  <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-primary)', fontFamily: "'Source Serif 4', Georgia, serif" }}>
                    Race Competitiveness
                  </div>
                  <div className="text-lg font-bold mb-0.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {cookRating}
                  </div>
                  <div className="relative mt-2" style={{ padding: '0 6px' }}>
                    <div
                      className="rounded-full"
                      style={{
                        height: 10,
                        background: 'linear-gradient(to right, #2563eb 0%, #93a8d4 30%, #b0b0b0 50%, #d4939a 70%, #dc2626 100%)',
                      }}
                    />
                    <div
                      className="absolute top-1/2"
                      style={{
                        left: `calc(${getCookRatingPosition(cookRating)}%)`,
                        transform: 'translate(-50%, -50%)',
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: '#fff',
                        border: '3px solid var(--text-primary)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1" style={{ padding: '0 6px' }}>
                    <span className="text-[10px] font-medium" style={{ color: '#2563eb' }}>Democrat</span>
                    <span className="text-[10px] font-medium" style={{ color: '#dc2626' }}>Republican</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                {candidate.twitter_handle && (
                  <a
                    href={/^\d+$/.test(candidate.twitter_handle)
                      ? `https://twitter.com/intent/user?user_id=${candidate.twitter_handle}`
                      : `https://x.com/${candidate.twitter_handle}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-80"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                    {/^\d+$/.test(candidate.twitter_handle) ? 'X Profile' : `@${candidate.twitter_handle}`}
                  </a>
                )}
                {candidate.campaign_website && (
                  <a href={candidate.campaign_website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-80"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
                    Website
                  </a>
                )}
                {candidate.government_website && (
                  <a href={candidate.government_website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-80"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" /></svg>
                    Official
                  </a>
                )}
                {candidate.facebook && (
                  <a href={`https://facebook.com/${candidate.facebook}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-80"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                    Facebook
                  </a>
                )}
              </div>
            </div>
            {/* Awards */}
            {candidate.awards && candidate.awards.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold tracking-[0.1em] uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Awards
                </div>
                <div className="space-y-2">
                  {candidate.awards.map((award) => {
                    const config = getAwardConfig(award.category, award.type);
                    const isPositive = config?.isPositive ?? true;
                    const color = isPositive ? '#059669' : '#dc2626';
                    const isSpecial = award.type === 'zero_attacks';
                    const ribbonColor = isSpecial ? '#c9a84c' : color;
                    return (
                      <AwardCard
                        key={`${award.category}-${award.type}`}
                        name={award.award_name}
                        description={config?.description || ''}
                        color={ribbonColor}
                        nameColor={isSpecial ? '#9a7b2d' : color}
                      />
                    );
                  })}
                </div>
              </div>
            )}
            {/* Candidate Details */}
            <div>
              <div className="text-[11px] font-semibold tracking-[0.1em] uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Details
              </div>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <DetailRow label="Race" value={districtLabel} />
                {candidate.state && PRIMARY_DATES[candidate.state] && (
                  <DetailRow
                    label="Primary date"
                    value={
                      formatPrimaryDate(PRIMARY_DATES[candidate.state].date) +
                      (!isPrimaryPast(PRIMARY_DATES[candidate.state].date)
                        ? ` (${getCountdownText(PRIMARY_DATES[candidate.state].date)})`
                        : '')
                    }
                    even
                  />
                )}
                {candidate.birthday && <DetailRow label="Birthday" value={formatDate(candidate.birthday)} />}
                {candidate.serving_since && <DetailRow label="Serving since" value={formatDate(candidate.serving_since.split(' ')[0])} even />}
                {candidate.first_file_date && (
                  <DetailRow label="FEC filed" value={formatDate(candidate.first_file_date)} />
                )}
                {candidate.has_raised_funds && (
                  <DetailRow label="Fundraising" value="Has raised funds" even />
                )}
              </div>
            </div>

            {/* Campaign Finance */}
            {candidate.finance && candidate.finance.total_receipts > 0 && (
              <div>
                <div className="text-[11px] font-semibold tracking-[0.1em] uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Campaign Finance
                </div>
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <DetailRow label="Total raised" value={formatDollars(candidate.finance.total_receipts)} />
                  <DetailRow label="Total spent" value={formatDollars(candidate.finance.total_disbursements)} even />
                  <DetailRow label="Cash on hand" value={formatDollars(candidate.finance.cash_on_hand)} />
                  {candidate.finance.individual_contributions > 0 && (
                    <DetailRow label="Individual contributions" value={formatDollars(candidate.finance.individual_contributions)} even />
                  )}
                  {candidate.finance.pac_contributions > 0 && (
                    <DetailRow label="PAC contributions" value={formatDollars(candidate.finance.pac_contributions)} />
                  )}
                  {candidate.finance.party_contributions > 0 && (
                    <DetailRow label="Party contributions" value={formatDollars(candidate.finance.party_contributions)} even />
                  )}
                  {candidate.finance.candidate_contributions > 0 && (
                    <DetailRow label="Self-funded" value={formatDollars(candidate.finance.candidate_contributions)} />
                  )}
                  {candidate.finance.candidate_loans > 0 && (
                    <DetailRow label="Candidate loans" value={formatDollars(candidate.finance.candidate_loans)} even />
                  )}
                  {candidate.finance.debts_owed > 0 && (
                    <DetailRow label="Debts owed" value={formatDollars(candidate.finance.debts_owed)} />
                  )}
                  {candidate.finance.coverage_end_date && (
                    <DetailRow label="FEC data through" value={candidate.finance.coverage_end_date} even />
                  )}
                </div>
              </div>
            )}

            {/* X / Social Engagement */}
            {(hasEngagement || candidate.statement_count > 0) && (
              <div>
                <div className="text-[11px] font-semibold tracking-[0.1em] uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  X / Social Media
                </div>
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  {candidate.statement_count > 0 && (
                    <DetailRow label="Posts tracked" value={candidate.statement_count.toLocaleString()} />
                  )}
                  {candidate.first_tweet_date && candidate.last_tweet_date && (
                    <DetailRow label="Active on X" value={`${formatDate(candidate.first_tweet_date)} \u2013 ${formatDate(candidate.last_tweet_date)}`} />
                  )}
                  {candidate.follower_count != null && (
                    <DetailRow label="Followers" value={formatNumber(candidate.follower_count)} />
                  )}
                  {candidate.avg_likes != null && (
                    <DetailRow label="Avg likes per post" value={formatNumber(candidate.avg_likes)} even />
                  )}
                  {candidate.avg_impressions != null && (
                    <DetailRow label="Avg views per post" value={formatNumber(candidate.avg_impressions)} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right — communication style + statements */}
        <div className="lg:col-span-3 space-y-5">
          {/* Communication Style */}
          <div
            className="p-6 rounded-xl"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
          >
            <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Communication Style
            </h3>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              How does this candidate's communication prioritize division or policy?
            </p>
            {candidate.rhetoric_data_available ? (
              <RhetoricBreakdownChart rhetoric={candidate.rhetoric} />
            ) : (
              <div
                className="flex items-center justify-center py-10 text-sm italic rounded-lg"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}
              >
                {candidate.statement_count > 0 ? 'Not enough data' : 'No social media data'}
              </div>
            )}
          </div>

          {/* Recent Statements */}
          <div
            className="p-6 rounded-xl"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
          >
            <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Recent Statements
            </h3>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              Latest public communications from {candidate.name}.
            </p>
            <StatementsList statements={statements} twitterHandle={candidate.twitter_handle} />
          </div>
        </div>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.replace(/^(Rep\.|Sen\.|Dr\.|Mr\.|Mrs\.|Ms\.)\s*/i, '').trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function CandidateAvatar({ name, partyColor, imageUrl: storedUrl, bioguideId, size = 48 }: { name: string; partyColor: string; imageUrl?: string; bioguideId?: string; size?: number }) {
  const imageUrl = storedUrl
    ? `https://americaspoliticalpulse.com${storedUrl}`
    : bioguideId
      ? `https://www.congress.gov/img/member/${bioguideId.toLowerCase()}_200.jpg`
      : null;

  const fontSize = Math.round(size * 0.38);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="rounded-full shrink-0 object-cover"
        style={{ width: size, height: size, border: `2px solid ${partyColor}` }}
        onError={(e) => {
          const target = e.currentTarget;
          const parent = target.parentElement;
          if (parent) {
            const fallback = document.createElement('div');
            fallback.className = 'flex items-center justify-center rounded-full shrink-0';
            Object.assign(fallback.style, {
              width: `${size}px`, height: `${size}px`, background: partyColor,
              fontFamily: "'Source Serif 4', Georgia, serif",
              fontSize: `${fontSize}px`, fontWeight: '700', color: '#fff',
            });
            fallback.textContent = getInitials(name);
            parent.replaceChild(fallback, target);
          }
        }}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        background: partyColor,
        fontFamily: "'Source Serif 4', Georgia, serif",
        fontSize,
        fontWeight: 700,
        color: '#fff',
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function RibbonSvg({ color, size = 36 }: { color: string; size?: number }) {
  const dark = color + 'cc';
  const light = color;
  const highlight = color + '88';
  return (
    <svg width={size} height={size * 1.39} viewBox="0 0 64 90" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M18 52L18 86L25 78L32 86L32 52Z" fill={dark} opacity="0.85" />
      <path d="M32 52L32 86L39 78L46 86L46 52Z" fill={light} opacity="0.85" />
      <ellipse cx="32" cy="30" rx="24" ry="24" fill="none" stroke={light} strokeWidth="2.5" opacity="0.9" />
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const cx = 32 + 24 * Math.cos(rad);
        const cy = 30 + 24 * Math.sin(rad);
        return <circle key={angle} cx={cx} cy={cy} r="3" fill={light} opacity="0.9" />;
      })}
      <circle cx="32" cy="30" r="17" fill={dark} stroke={highlight} strokeWidth="1" opacity="0.9" />
      <circle cx="32" cy="30" r="12" fill={light} />
      <polygon points="32,21 34.5,27 41,27.5 36,32 37.5,38.5 32,35 26.5,38.5 28,32 23,27.5 29.5,27" fill="#fff" opacity="0.85" />
    </svg>
  );
}

function AwardCard({ name, description, color, nameColor }: { name: string; description: string; color: string; nameColor: string }) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg overflow-hidden"
      style={{ padding: '10px 12px', background: '#ffffff', border: '1px solid var(--border)', borderTop: `2px solid ${color}` }}
    >
      <RibbonSvg color={color} size={30} />
      <div style={{ minWidth: 0 }}>
        <div
          className="text-sm font-bold leading-tight"
          style={{ color: nameColor, fontFamily: "'Source Serif 4', Georgia, serif" }}
        >
          {name}
        </div>
        <div className="text-xs leading-snug mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {description}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string; even?: boolean }) {
  return (
    <div
      className="flex justify-between items-center px-3 py-[7px]"
      style={{ background: '#ffffff', borderBottom: '1px solid var(--border)' }}
    >
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
