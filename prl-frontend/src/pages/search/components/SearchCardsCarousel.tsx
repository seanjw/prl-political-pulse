import { useRef, useEffect, useState } from 'react';
import type { SearchFilters, SortMode } from '../types';

interface PresetCard {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tags: string[];
  params: Partial<SearchFilters> & { sort_mode?: SortMode };
  opensAdvanced?: boolean;
}

const PRESET_CARDS: PresetCard[] = [
  {
    id: 'clean-energy-dems',
    title: 'Clean Energy',
    subtitle: 'Which Democrats highlight renewable energy?',
    icon: 'bi bi-lightning',
    tags: ['clean', 'renewable', 'green', 'energy'],
    params: {
      party: 'Democrat',
      search: '"clean energy" "renewable energy" "green energy"',
      sort_mode: 'speaker-freq',
      start_date: '2017-07-01',
    },
    opensAdvanced: true,
  },
  {
    id: 'abortion-rights',
    title: 'Abortion Access',
    subtitle: 'How is abortion policy being discussed after Dobbs?',
    icon: 'bi bi-gender-female',
    tags: ['abortion rights'],
    params: {
      policy: '1',
      search: 'abortion',
      sort_mode: 'date-desc',
      start_date: '2022-06-24',
    },
    opensAdvanced: true,
  },
  {
    id: 'gun-control',
    title: 'Gun Control',
    subtitle: 'How is gun control debated across the country?',
    icon: 'bi bi-bullseye',
    tags: ['gun control', 'gun laws'],
    params: {
      search: '"gun control" "gun laws"',
      sort_mode: 'date-desc',
      start_date: '2017-07-01',
    },
  },
  {
    id: 'climate-change-gop',
    title: 'Climate Change',
    subtitle: 'How do Republicans frame climate change?',
    icon: 'bi bi-cloud-rain-heavy',
    tags: ['climate change', 'global warming'],
    params: {
      party: 'Republican',
      search: '"climate change" "global warming"',
      sort_mode: 'date-desc',
      start_date: '2017-07-01',
    },
    opensAdvanced: true,
  },
  {
    id: 'minimum-wage',
    title: 'Minimum Wage',
    subtitle: 'Who is pushing for a higher minimum wage?',
    icon: 'bi bi-cash-stack',
    tags: ['minimum wage'],
    params: {
      search: 'minimum wage',
      sort_mode: 'speaker-freq',
      start_date: '2017-07-01',
    },
  },
  {
    id: 'healthcare-costs',
    title: 'Healthcare Costs',
    subtitle: "Who's talking about lowering healthcare costs?",
    icon: 'bi bi-hospital',
    tags: ['healthcare', 'costs'],
    params: {
      search: '+healthcare +costs',
      sort_mode: 'date-desc',
      start_date: '2017-07-01',
    },
  },
  {
    id: 'ukraine-aid',
    title: 'Ukraine Aid',
    subtitle: 'How is U.S. aid to Ukraine being discussed?',
    icon: 'bi bi-flag-fill',
    tags: ['Ukraine', 'aid'],
    params: {
      search: '+Ukraine +aid',
      sort_mode: 'date-desc',
      start_date: '2022-02-24',
    },
  },
];

interface SearchCardsCarouselProps {
  onCardSelect: (filters: Partial<SearchFilters>, sortMode?: SortMode) => void;
}

const AUTO_SCROLL_PX_PER_SEC = 28;

export function SearchCardsCarousel({ onCardSelect }: SearchCardsCarouselProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const singleSetWidthRef = useRef(0);
  const isWrappingRef = useRef(false);

  // Triple the cards for infinite scroll illusion
  const displayCards = [...PRESET_CARDS, ...PRESET_CARDS, ...PRESET_CARDS];

  // Get current date for end_date
  const getCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Handle card click
  const handleCardClick = (card: PresetCard) => {
    const filters: Partial<SearchFilters> = { ...card.params };
    // Set end_date to current if not specified
    if (!filters.end_date) {
      filters.end_date = getCurrentDate();
    }
    const sortMode = card.params.sort_mode;
    delete (filters as Record<string, unknown>).sort_mode;
    onCardSelect(filters, sortMode);
  };

  // Measure single set width
  const measureSingleSetWidth = () => {
    const strip = stripRef.current;
    if (!strip) return 0;
    const items = strip.querySelectorAll('.sc-item');
    const n = PRESET_CARDS.length;
    if (items.length < n) return strip.scrollWidth;
    const firstLeft = (items[0] as HTMLElement).offsetLeft;
    const nthRight = (items[n - 1] as HTMLElement).offsetLeft + (items[n - 1] as HTMLElement).offsetWidth;
    return Math.max(0, nthRight - firstLeft);
  };

  // Initialize infinite wrap
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    // Initial measurement and position
    requestAnimationFrame(() => {
      singleSetWidthRef.current = measureSingleSetWidth();
      strip.scrollLeft = singleSetWidthRef.current;
    });

    // Handle scroll wrapping
    const handleScroll = () => {
      if (isWrappingRef.current || !singleSetWidthRef.current) return;
      const x = strip.scrollLeft;
      const leftBound = singleSetWidthRef.current * 0.5;
      const rightBound = singleSetWidthRef.current * 1.5;

      if (x < leftBound) {
        isWrappingRef.current = true;
        strip.scrollLeft = x + singleSetWidthRef.current;
        requestAnimationFrame(() => { isWrappingRef.current = false; });
      } else if (x > rightBound) {
        isWrappingRef.current = true;
        strip.scrollLeft = x - singleSetWidthRef.current;
        requestAnimationFrame(() => { isWrappingRef.current = false; });
      }
    };

    // Handle resize
    const handleResize = () => {
      if (!singleSetWidthRef.current) return;
      const prev = singleSetWidthRef.current;
      singleSetWidthRef.current = measureSingleSetWidth();
      const offsetWithinPrev = strip.scrollLeft % prev;
      strip.scrollLeft = singleSetWidthRef.current + offsetWithinPrev;
    };

    strip.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      strip.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Auto scroll
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    let animationId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      animationId = requestAnimationFrame(tick);
      if (isPaused || !singleSetWidthRef.current) {
        lastTime = now;
        return;
      }
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      strip.scrollLeft += AUTO_SCROLL_PX_PER_SEC * dt;
    };

    animationId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationId);
  }, [isPaused]);

  return (
    <div className="search-cards-carousel mb-3">
      <div
        ref={stripRef}
        className="search-cards-strip"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        {displayCards.map((card, index) => (
          <div key={`${card.id}-${index}`} className="sc-item">
            <div
              className="card search-card rounded-4 shadow-sm"
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick(card)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCardClick(card);
                }
              }}
            >
              <div className="card-body d-flex flex-column">
                <div className="d-flex align-items-center gap-2 mb-1 sc-title">
                  {card.icon && <i className={card.icon}></i>}
                  <h6 className="mb-0 fw-semibold sc-title-text">{card.title}</h6>
                </div>
                {card.subtitle && (
                  <div className="text-muted small mb-2 sc-subtitle">{card.subtitle}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
