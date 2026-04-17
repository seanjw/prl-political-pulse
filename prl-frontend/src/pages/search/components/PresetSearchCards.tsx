import { useRef } from 'react';
import { PRESET_SEARCH_CARDS, type PresetSearchCard } from '../config';
import type { SearchFilters, SortMode } from '../types';

interface PresetSearchCardsProps {
  onSelectPreset: (filters: Partial<SearchFilters>, sortMode?: SortMode) => void;
}

export function PresetSearchCards({ onSelectPreset }: PresetSearchCardsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleCardClick = (card: PresetSearchCard) => {
    const today = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const filters: Partial<SearchFilters> = {
      search: card.params.search,
      start_date: card.params.start_date || '2017-07-01',
      end_date: card.params.end_date === 'current' || !card.params.end_date ? formatDate(today) : card.params.end_date,
    };

    if (card.params.party) {
      filters.party = card.params.party;
    }
    if (card.params.policy) {
      filters.policy = card.params.policy;
    }

    const sortMode = (card.params.sort_mode as SortMode) || 'date-desc';
    onSelectPreset(filters, sortMode);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="preset-cards-wrapper position-relative mb-3">
      {/* Left scroll button */}
      <button
        className="preset-scroll-btn preset-scroll-left"
        onClick={() => scroll('left')}
        aria-label="Scroll left"
      >
        <i className="bi bi-chevron-left"></i>
      </button>

      {/* Scrolling container */}
      <div
        ref={scrollContainerRef}
        className="preset-cards-container d-flex gap-3 overflow-auto pb-2"
      >
        {PRESET_SEARCH_CARDS.map((card) => (
          <div
            key={card.id}
            className="preset-card card border rounded-3 flex-shrink-0"
            onClick={() => handleCardClick(card)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick(card);
              }
            }}
          >
            <div className="card-body p-3">
              <div className="d-flex align-items-center mb-1">
                <i className={`${card.icon} me-2`} aria-hidden="true"></i>
                <h6 className="card-title mb-0 fw-semibold">{card.title}</h6>
              </div>
              <p className="card-text text-muted small mb-0">{card.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Right scroll button */}
      <button
        className="preset-scroll-btn preset-scroll-right"
        onClick={() => scroll('right')}
        aria-label="Scroll right"
      >
        <i className="bi bi-chevron-right"></i>
      </button>
    </div>
  );
}
