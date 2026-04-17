import { useState, useRef, useEffect } from 'react';
import type { SortMode } from '../types';
import { SORT_DISPLAY_TEXT } from '../config';

interface ResultsInfoPanelProps {
  totalCount: number;
  uniqueLegislators: number;
  sortMode: SortMode;
  onSortChange: (sort: SortMode) => void;
  onShare: () => void;
  onExport: () => void;
  selectedCount: number;
}

export function ResultsInfoPanel({
  totalCount,
  uniqueLegislators,
  sortMode,
  onSortChange,
  onShare,
  onExport,
  selectedCount,
}: ResultsInfoPanelProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sortOptions: { value: SortMode; label: string; icon: string }[] = [
    { value: 'date-desc', label: 'Date (Newest First)', icon: 'bi-sort-numeric-down' },
    { value: 'date-asc', label: 'Date (Oldest First)', icon: 'bi-sort-numeric-up' },
    { value: 'alpha-asc', label: 'Name (A–Z)', icon: 'bi-sort-alpha-down' },
    { value: 'alpha-desc', label: 'Name (Z–A)', icon: 'bi-sort-alpha-up' },
    { value: 'speaker-freq', label: 'Legislator Frequency', icon: 'bi-person-up' },
  ];

  const currentSort = sortOptions.find(s => s.value === sortMode);

  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toLocaleString();
  };

  return (
    <div className="card small-card search-info-panel rounded-4 shadow-sm p-1 mb-3">
      <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-2 p-3">
        {/* Results count */}
        <div className="text-muted">
          <strong>{formatCount(totalCount)}</strong> results from{' '}
          <strong>{formatCount(uniqueLegislators)}</strong>{' '}
          {uniqueLegislators === 1 ? 'legislator' : 'legislators'}
        </div>

        {/* Sort / Share / Export controls */}
        <div className="d-flex gap-2 align-items-center flex-wrap">
          {/* Sort dropdown */}
          <div ref={dropdownRef} className="position-relative">
            <button
              className={`btn btn-outline-secondary sort-button soft-hover dropdown-toggle btn-sm ${dropdownOpen ? 'show' : ''}`}
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <i className={`bi ${currentSort?.icon || 'bi-sort-numeric-down'}`} aria-hidden="true"></i>{' '}
              <span>{SORT_DISPLAY_TEXT[sortMode]}</span>
            </button>
            {dropdownOpen && (
              <ul className="dropdown-menu show mt-1" style={{ position: 'absolute', top: '100%', left: 0 }}>
                {sortOptions.slice(0, 2).map(option => (
                  <li key={option.value}>
                    <button
                      className="dropdown-item d-flex align-items-center gap-2"
                      type="button"
                      onClick={() => {
                        onSortChange(option.value);
                        setDropdownOpen(false);
                      }}
                    >
                      <i className={`bi ${option.icon}`} aria-hidden="true"></i> {option.label}
                    </button>
                  </li>
                ))}
                <li><hr className="dropdown-divider" /></li>
                {sortOptions.slice(2, 4).map(option => (
                  <li key={option.value}>
                    <button
                      className="dropdown-item d-flex align-items-center gap-2"
                      type="button"
                      onClick={() => {
                        onSortChange(option.value);
                        setDropdownOpen(false);
                      }}
                    >
                      <i className={`bi ${option.icon}`} aria-hidden="true"></i> {option.label}
                    </button>
                  </li>
                ))}
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button
                    className="dropdown-item d-flex align-items-center gap-2"
                    type="button"
                    onClick={() => {
                      onSortChange('speaker-freq');
                      setDropdownOpen(false);
                    }}
                  >
                    <i className="bi bi-person-up" aria-hidden="true"></i> Legislator Frequency
                  </button>
                </li>
              </ul>
            )}
          </div>

          {/* Share button */}
          <button
            className="btn btn-outline-primary soft-hover btn-sm"
            onClick={onShare}
          >
            <i className="bi bi-link-45deg" aria-hidden="true"></i> Share
          </button>

          {/* Export button */}
          <button
            className="btn btn-outline-danger soft-hover btn-sm"
            onClick={onExport}
          >
            <i className="bi bi-download" aria-hidden="true"></i>{' '}
            Export{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
