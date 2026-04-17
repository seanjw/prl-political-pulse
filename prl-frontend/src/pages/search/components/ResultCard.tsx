import { useState, useCallback } from 'react';
import type { SearchResult, SearchFilters } from '../types';
import {
  getPartyBadgeClass,
  normalizePartyName,
  CHAMBER_LABELS,
  SOURCE_LABELS,
  LEVEL_LABELS,
  formatDateToReadable,
  highlightSearchTerms,
  CODE_TO_STATE,
} from '../config';

interface ResultCardProps {
  result: SearchResult;
  highlightTerms: string[];
  filters: SearchFilters;
  isSelected: boolean;
  onSelect: () => void;
  onFilterChange: (field: keyof SearchFilters, value: string) => void;
}

export function ResultCard({
  result,
  highlightTerms,
  filters,
  isSelected,
  onSelect,
  onFilterChange,
}: ResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Get canonical party name
  const partyCanonical = normalizePartyName(result.party);

  // Get display labels
  const chamberLabel = CHAMBER_LABELS[result.type] || result.type;
  const sourceLabel = SOURCE_LABELS[result.source] || result.source;
  const levelLabel = LEVEL_LABELS[result.level] || result.level;
  const stateName = CODE_TO_STATE[result.state] || result.state;

  // Check if filters are active
  const isNameActive = filters.name === result.name;
  const isLevelActive = filters.level === result.level;
  const isPartyActive = normalizePartyName(filters.party) === partyCanonical;
  const isChamberActive = filters.type === result.type;
  const isStateActive = filters.state === result.state || filters.state === stateName;
  const isDistrictActive = filters.district === result.district;
  const isSourceActive = filters.source === result.source;
  const isDateActive = filters.start_date === result.date && filters.end_date === result.date;

  // Rhetoric filter checks
  const isAttackPersonalActive = filters.attack_personal === '1';
  const isAttackPolicyActive = filters.attack_policy === '1';
  const isPolicyActive = filters.policy === '1';
  const isCreditclaimingActive = filters.outcome_creditclaiming === '1';
  const isBipartisanshipActive = filters.outcome_bipartisanship === '1';
  const isExtremeActive = filters.extreme_label === 'yes';

  // Format date
  const formattedDate = formatDateToReadable(result.date);

  // Highlight text
  const highlightedText = highlightSearchTerms(result.text, highlightTerms);

  // Check if should show various elements
  const shouldShowParty = !!result.party;
  const shouldShowChamber = !!result.type;
  const shouldShowState = !!result.state;
  const shouldShowDistrict = !!result.district && result.district !== '0';

  // Rhetoric info
  const shouldShowAttackPersonal = result.attack_personal === 1;
  const shouldShowAttackPolicy = result.attack_policy === 1;
  const shouldShowPolicy = result.policy === 1;
  const shouldShowCreditclaiming = result.outcome_creditclaiming === 1;
  const shouldShowBipartisanship = result.outcome_bipartisanship === 1;
  const shouldShowExtreme = result.extreme_label === 'yes';
  const shouldShowRhetoricInfo = shouldShowAttackPersonal || shouldShowAttackPolicy || shouldShowPolicy ||
    shouldShowCreditclaiming || shouldShowBipartisanship || shouldShowExtreme;

  // Contact info
  const shouldShowCampaignWebsite = !!result.campaign_website;
  const shouldShowEmail = !!result.email;
  const shouldShowGovernmentWebsite = !!result.government_website;
  const shouldShowTruthSocial = !!result.truth_social;
  const shouldShowTwitterHandle = !!result.twitter_handle;
  const shouldShowYouTube = !!result.youtube;
  const shouldShowContactTable = shouldShowCampaignWebsite || shouldShowEmail ||
    shouldShowGovernmentWebsite || shouldShowTruthSocial || shouldShowTwitterHandle || shouldShowYouTube;

  // Handle copy
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result.text]);

  // Handle filter click - toggle: if already selected, clear it; otherwise set it
  const handleFilterClick = useCallback((field: keyof SearchFilters, value: string) => {
    const currentValue = filters[field];
    const newValue = currentValue === value ? '' : value;
    onFilterChange(field, newValue);
  }, [filters, onFilterChange]);

  // Handle date filter
  const handleDateFilter = useCallback(() => {
    onFilterChange('start_date', result.date);
    onFilterChange('end_date', result.date);
  }, [onFilterChange, result.date]);

  return (
    <div className={`card small-card position-relative rounded-4 shadow-sm mb-3 p-3 ${isSelected ? 'selected' : ''}`}>
      <div className="card-body p-1">
        {/* Section: Who they are */}
        <div className="text-muted small text-uppercase mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
          Who they are
        </div>

        {/* Legislator Info Header */}
        <div className="d-flex justify-content-between align-items-start flex-wrap mb-2">
          <h5 className="card-head fw-semibold mb-0 d-flex align-items-center flex-wrap">
            {/* Name */}
            <span
              className="search-filter-trigger d-inline-flex align-items-center gap-1 text-dark text-decoration-none me-1"
              role="button"
              onClick={() => handleFilterClick('name', result.name)}
            >
              <i className={`bi ${isNameActive ? 'bi-person-check' : 'bi-person'}`}></i>
              {result.name}
            </span>

            {/* Level */}
            <span
              className="badge fix-icon bg-dark text-white search-filter-trigger ms-1"
              role="button"
              onClick={() => handleFilterClick('level', result.level)}
            >
              {levelLabel}
              {isLevelActive && <i className="bi bi-check-lg"></i>}
            </span>

            {/* Party */}
            {shouldShowParty && (
              <span
                className={`badge fix-icon search-filter-trigger ms-1 ${getPartyBadgeClass(result.party)}`}
                role="button"
                onClick={() => handleFilterClick('party', partyCanonical)}
              >
                {result.party}
                {isPartyActive && <i className="bi bi-check-lg"></i>}
              </span>
            )}

            {/* Chamber */}
            {shouldShowChamber && (
              <span
                className="badge fix-icon bg-secondary text-white search-filter-trigger ms-1"
                role="button"
                onClick={() => handleFilterClick('type', result.type)}
              >
                {chamberLabel}
                {isChamberActive && <i className="bi bi-check-lg"></i>}
              </span>
            )}

            {/* State & District */}
            {shouldShowState && (
              <div className="btn-group ms-1" role="group">
                <span
                  className="badge fix-icon bg-light text-dark border search-filter-trigger"
                  role="button"
                  onClick={() => handleFilterClick('state', stateName)}
                >
                  {stateName}
                  {isStateActive && <i className="bi bi-check-lg"></i>}
                </span>
                {shouldShowDistrict && (
                  <span
                    className="badge fix-icon bg-light text-dark border search-filter-trigger"
                    role="button"
                    onClick={() => handleFilterClick('district', result.district)}
                  >
                    District {result.district}
                    {isDistrictActive && <i className="bi bi-check-lg"></i>}
                  </span>
                )}
              </div>
            )}
          </h5>
        </div>

        {/* Source & Date */}
        <div className="d-flex gap-1 flex-wrap align-items-center mb-2">
          <span
            className="text-muted small search-filter-trigger d-flex align-items-center gap-1"
            role="button"
            onClick={() => handleFilterClick('source', result.source)}
          >
            {sourceLabel}
            {isSourceActive && <i className="bi bi-patch-check-fill small inline-check-icon"></i>}
          </span>
          <span className="text-muted small">|</span>
          <span
            className="text-muted small search-filter-trigger d-flex align-items-center gap-1"
            role="button"
            onClick={handleDateFilter}
          >
            {formattedDate}
            {isDateActive && <i className="bi bi-patch-check-fill small inline-check-icon"></i>}
          </span>
        </div>

        {/* Section: What they're saying */}
        <div className="text-muted small text-uppercase mt-3 mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
          What they're saying
        </div>

        {/* Statement Text */}
        <p
          className="card-text mb-0"
          dangerouslySetInnerHTML={{ __html: highlightedText }}
        />

        {/* Collapsible Metadata Section */}
        {expanded && (
          <div className="mt-3 overflow-hidden">
            {shouldShowRhetoricInfo && (
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                <span className="fw-semibold text-dark">Text Contains:</span>

                {shouldShowAttackPersonal && (
                  <span
                    className="badge fix-icon bg-danger text-white search-filter-trigger"
                    role="button"
                    onClick={() => handleFilterClick('attack_personal', '1')}
                  >
                    <i className="bi bi-person-x"></i> Personal Attacks
                    {isAttackPersonalActive && <i className="bi bi-check-lg"></i>}
                  </span>
                )}

                {shouldShowAttackPolicy && (
                  <span
                    className="badge fix-icon bg-warning text-dark search-filter-trigger"
                    role="button"
                    onClick={() => handleFilterClick('attack_policy', '1')}
                  >
                    <i className="bi bi-exclamation-diamond"></i> Policy Criticism
                    {isAttackPolicyActive && <i className="bi bi-check-lg"></i>}
                  </span>
                )}

                {shouldShowPolicy && (
                  <span
                    className="badge fix-icon bg-secondary text-white search-filter-trigger"
                    role="button"
                    onClick={() => handleFilterClick('policy', '1')}
                  >
                    <i className="bi bi-lightbulb"></i> Policy Discussion
                    {isPolicyActive && <i className="bi bi-check-lg"></i>}
                  </span>
                )}

                {shouldShowCreditclaiming && (
                  <span
                    className="badge fix-icon bg-primary text-white search-filter-trigger"
                    role="button"
                    onClick={() => handleFilterClick('outcome_creditclaiming', '1')}
                  >
                    <i className="bi bi-award"></i> Accomplishments
                    {isCreditclaimingActive && <i className="bi bi-check-lg"></i>}
                  </span>
                )}

                {shouldShowBipartisanship && (
                  <span
                    className="badge fix-icon bg-success text-white search-filter-trigger"
                    role="button"
                    onClick={() => handleFilterClick('outcome_bipartisanship', '1')}
                  >
                    <i className="bi bi-people"></i> Bipartisanship
                    {isBipartisanshipActive && <i className="bi bi-check-lg"></i>}
                  </span>
                )}

                {shouldShowExtreme && (
                  <span
                    className="badge fix-icon bg-dark text-white search-filter-trigger"
                    role="button"
                    onClick={() => handleFilterClick('extreme_label', 'yes')}
                  >
                    <i className="bi bi-fire"></i> Extreme Language
                    {isExtremeActive && <i className="bi bi-check-lg"></i>}
                  </span>
                )}
              </div>
            )}

            {/* Contact Info Table */}
            {shouldShowContactTable && (
              <div className="rounded-table table-responsive mb-2">
                <table className="table table-sm mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="rhetoric-label-cell">Legislator Info</th>
                      <th className="rhetoric-value-cell">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shouldShowCampaignWebsite && (
                      <tr>
                        <td className="rhetoric-label-cell"><i className="bi bi-megaphone me-2"></i> Campaign Website</td>
                        <td className="rhetoric-value-cell">
                          <a href={result.campaign_website} target="_blank" rel="noopener noreferrer">
                            {result.campaign_website}
                          </a>
                          <i className="bi bi-box-arrow-up-right ms-1"></i>
                        </td>
                      </tr>
                    )}
                    {shouldShowEmail && (
                      <tr>
                        <td className="rhetoric-label-cell"><i className="bi bi-envelope me-2"></i> Email</td>
                        <td className="rhetoric-value-cell">
                          <a href={`mailto:${result.email}`}>{result.email}</a>
                          <i className="bi bi-box-arrow-up-right ms-1"></i>
                        </td>
                      </tr>
                    )}
                    {shouldShowGovernmentWebsite && (
                      <tr>
                        <td className="rhetoric-label-cell"><i className="bi bi-person-video2 me-2"></i> Government Website</td>
                        <td className="rhetoric-value-cell">
                          <a href={result.government_website} target="_blank" rel="noopener noreferrer">
                            {result.government_website}
                          </a>
                          <i className="bi bi-box-arrow-up-right ms-1"></i>
                        </td>
                      </tr>
                    )}
                    {shouldShowTruthSocial && (
                      <tr>
                        <td className="rhetoric-label-cell"><i className="bi bi-chat-dots me-2"></i> Truth Social</td>
                        <td className="rhetoric-value-cell">
                          <a href={result.truth_social} target="_blank" rel="noopener noreferrer">
                            {result.truth_social}
                          </a>
                          <i className="bi bi-box-arrow-up-right ms-1"></i>
                        </td>
                      </tr>
                    )}
                    {shouldShowTwitterHandle && (
                      <tr>
                        <td className="rhetoric-label-cell"><i className="bi bi-twitter-x me-2"></i> X/Twitter</td>
                        <td className="rhetoric-value-cell">
                          <a href={`https://x.com/${result.twitter_handle}`} target="_blank" rel="noopener noreferrer">
                            {result.twitter_handle}
                          </a>
                          <i className="bi bi-box-arrow-up-right ms-1"></i>
                        </td>
                      </tr>
                    )}
                    {shouldShowYouTube && (
                      <tr>
                        <td className="rhetoric-label-cell"><i className="bi bi-youtube me-2"></i> YouTube</td>
                        <td className="rhetoric-value-cell">
                          <a href={result.youtube} target="_blank" rel="noopener noreferrer">
                            {result.youtube}
                          </a>
                          <i className="bi bi-box-arrow-up-right ms-1"></i>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons & Index */}
        <div className="d-flex justify-content-between align-items-center mt-2 text-muted small">
          <div className="d-flex gap-1 flex-wrap align-items-center">
            <span
              className="action-link more-info-toggle d-flex align-items-center gap-1"
              role="button"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Hide More Info' : 'Show More Info'}
            </span>
            {result.tweet_id && result.twitter_handle && (
              <>
                <span>|</span>
                <a
                  className="action-link d-flex align-items-center gap-1"
                  href={`https://x.com/${result.twitter_handle.trim()}/status/${result.tweet_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View On X
                </a>
              </>
            )}
            <span>|</span>
            <span
              className="action-link d-flex align-items-center gap-1 select-button"
              role="button"
              onClick={onSelect}
            >
              {isSelected ? 'Deselect' : 'Select'}
            </span>
            <span>|</span>
            <span
              className="action-link d-flex align-items-center gap-1"
              role="button"
              onClick={handleCopy}
            >
              <span className="copy-label">{copied ? 'Copied' : 'Copy Text'}</span>
            </span>
          </div>
          <div>#{result.result_index}</div>
        </div>
      </div>
    </div>
  );
}
