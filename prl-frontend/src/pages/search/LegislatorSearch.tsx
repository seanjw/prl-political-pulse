import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import './search.css';
import { SearchForm } from './components/SearchForm';
import { ResultCard } from './components/ResultCard';
import { ResultsInfoPanel } from './components/ResultsInfoPanel';
import { ChartsPanel } from './components/ChartsPanel';
import { ShareModal } from './components/ShareModal';
import { ExportModal } from './components/ExportModal';
import { ClearConfirmModal } from './components/ClearConfirmModal';
import { SearchCardsCarousel } from './components/SearchCardsCarousel';
import { fetchSearchResults, fetchHistogram, fetchTotals } from './api';
import { getDefaultDateRange } from './config';
import { usePageTitle } from '../../hooks/usePageTitle';
import type { SearchFilters, SearchResult, SortMode, HistogramDataPoint, PartyTotals } from './types';

const defaultFilters: SearchFilters = {
  name: '',
  gender: '',
  level: '',
  type: '',
  state: '',
  district: '',
  party: '',
  active: '',
  source: '',
  start_date: getDefaultDateRange().start,
  end_date: getDefaultDateRange().end,
  search: '',
  extreme_label: '',
  attack_policy: '',
  attack_personal: '',
  policy: '',
  outcome_bipartisanship: '',
  outcome_creditclaiming: '',
};

// Helper to parse filters from URL params
function parseFiltersFromParams(params: URLSearchParams): SearchFilters {
  const defaults = getDefaultDateRange();
  return {
    name: params.get('name') || '',
    gender: params.get('gender') || '',
    level: params.get('level') || '',
    type: params.get('type') || '',
    state: params.get('state') || '',
    district: params.get('district') || '',
    party: params.get('party') || '',
    active: params.get('active') || '',
    source: params.get('source') || '',
    start_date: params.get('start_date') || defaults.start,
    end_date: params.get('end_date') || defaults.end,
    search: params.get('search') || '',
    extreme_label: params.get('extreme_label') || '',
    attack_policy: params.get('attack_policy') || '',
    attack_personal: params.get('attack_personal') || '',
    policy: params.get('policy') || '',
    outcome_bipartisanship: params.get('outcome_bipartisanship') || '',
    outcome_creditclaiming: params.get('outcome_creditclaiming') || '',
  };
}

// Helper to serialize filters to URL params
function filtersToParams(filters: SearchFilters, sortMode: SortMode): URLSearchParams {
  const params = new URLSearchParams();
  const defaults = getDefaultDateRange();

  // Only include non-default values
  Object.entries(filters).forEach(([key, value]) => {
    if (key === 'start_date' && value === defaults.start) return;
    if (key === 'end_date' && value === defaults.end) return;
    if (value) params.set(key, value);
  });

  if (sortMode !== 'date-desc') {
    params.set('sort', sortMode);
  }

  return params;
}

export function LegislatorSearch() {
  usePageTitle('Search Legislator Statements');
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params
  const initialFilters = parseFiltersFromParams(searchParams);
  const initialSort = (searchParams.get('sort') as SortMode) || 'date-desc';
  const hasInitialSearch = searchParams.toString().length > 0;

  // Form state
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [sortMode, setSortMode] = useState<SortMode>(initialSort);

  // Results state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [highlightTerms, setHighlightTerms] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [totalResultCount, setTotalResultCount] = useState(0);
  const [uniqueLegislatorCount, setUniqueLegislatorCount] = useState(0);

  // Chart data
  const [histogramData, setHistogramData] = useState<HistogramDataPoint[]>([]);
  const [partyTotals, setPartyTotals] = useState<PartyTotals | null>(null);
  const [searchedTerm, setSearchedTerm] = useState<string>('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  // Abort controller ref
  const abortControllerRef = useRef<AbortController | null>(null);

  // Perform search
  const performSearch = useCallback(async (page = 1, append = false, filterOverrides?: Partial<SearchFilters>) => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Merge filter overrides if provided
    const searchFilters = filterOverrides ? { ...filters, ...filterOverrides } : filters;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setResults([]);
      setHistogramData([]);
      setPartyTotals(null);
    }

    try {
      // Fetch results
      const resultsPromise = fetchSearchResults(
        searchFilters,
        page,
        sortMode,
        abortControllerRef.current.signal
      );

      // Fetch histogram and totals only on first page
      const histogramPromise = page === 1 && !append
        ? fetchHistogram(searchFilters, abortControllerRef.current.signal)
        : Promise.resolve(null);

      const totalsPromise = page === 1 && !append
        ? fetchTotals(searchFilters, abortControllerRef.current.signal)
        : Promise.resolve(null);

      const [resultsData, histogramResponse, totalsResponse] = await Promise.all([
        resultsPromise,
        histogramPromise,
        totalsPromise,
      ]);

      // Update results
      if (append) {
        setResults(prev => [...prev, ...resultsData.results]);
      } else {
        setResults(resultsData.results);
        setHighlightTerms(resultsData.highlight_terms);
        setTotalResultCount(resultsData.total_result_count);
        setUniqueLegislatorCount(resultsData.unique_legislator_count);
        setSearchedTerm(searchFilters.search);
      }

      setHasMoreResults(resultsData.has_more_results);
      setCurrentPage(page);
      setHasSearched(true);

      // Update chart data
      if (histogramResponse) {
        setHistogramData(histogramResponse.histogram_data);
      }
      if (totalsResponse) {
        setPartyTotals(totalsResponse.totals);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Search failed:', error);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [filters, sortMode]);

  // Handle form submit - update URL and perform search
  const handleSearch = useCallback(() => {
    setSelectedIds(new Set());
    const newParams = filtersToParams(filters, sortMode);
    setSearchParams(newParams, { replace: false });
    performSearch(1, false);
  }, [filters, sortMode, setSearchParams, performSearch]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMoreResults) {
      performSearch(currentPage + 1, true);
    }
  }, [currentPage, hasMoreResults, isLoadingMore, performSearch]);

  // Handle sort change - update URL and re-search
  const handleSortChange = useCallback((newSort: SortMode) => {
    setSortMode(newSort);
    if (hasSearched) {
      setSelectedIds(new Set());
      const newParams = filtersToParams(filters, newSort);
      setSearchParams(newParams, { replace: false });
      performSearch(1, false);
    }
  }, [hasSearched, filters, setSearchParams, performSearch]);

  // Handle filter change from result card - update filter AND trigger search
  const handleFilterChange = useCallback((field: keyof SearchFilters, value: string) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    setSelectedIds(new Set());
    const newParams = filtersToParams(newFilters, sortMode);
    setSearchParams(newParams, { replace: false });
    performSearch(1, false, newFilters);
  }, [filters, sortMode, setSearchParams, performSearch]);

  // Handle clear filters - reset state and clear URL
  const handleClearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSortMode('date-desc');
    setSearchParams(new URLSearchParams(), { replace: true });
    setShowClearModal(false);
  }, [setSearchParams]);

  // Handle preset card selection - update URL and search
  const handlePresetCardSelect = useCallback((cardFilters: Partial<SearchFilters>, cardSortMode?: SortMode) => {
    const newFilters = { ...defaultFilters, ...cardFilters };
    const newSort = cardSortMode || 'date-desc';
    setFilters(newFilters);
    setSortMode(newSort);
    setSelectedIds(new Set());
    // Update URL with new params
    const newParams = filtersToParams(newFilters, newSort);
    setSearchParams(newParams, { replace: false });
    // Perform search with the new filters
    performSearch(1, false, newFilters);
  }, [setSearchParams, performSearch]);

  // Handle card selection
  const handleCardSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Infinite scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (isLoadingMore || !hasMoreResults) return;

      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      if (scrollTop + windowHeight >= documentHeight * 0.65) {
        handleLoadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleLoadMore, hasMoreResults, isLoadingMore]);

  // Re-search when sort mode changes after initial search
  useEffect(() => {
    if (hasSearched) {
      performSearch(1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const newFilters = parseFiltersFromParams(searchParams);
    const newSort = (searchParams.get('sort') as SortMode) || 'date-desc';

    // Check if filters actually changed (comparing serialized versions)
    const currentParamsStr = filtersToParams(filters, sortMode).toString();
    const newParamsStr = searchParams.toString();

    if (currentParamsStr !== newParamsStr) {
      setFilters(newFilters);
      setSortMode(newSort);
      if (searchParams.toString().length > 0) {
        setSelectedIds(new Set());
        // Perform search with new filters from URL
        performSearch(1, false, newFilters);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Run initial search if URL has params
  useEffect(() => {
    if (hasInitialSearch) {
      performSearch(1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="search-page">
      <div className="container col-lg-8 mx-auto my-5">
        {/* Page header */}
        <h3 className="mb-3 text-center">What are state and federal legislators saying?</h3>

        {/* Preset search cards carousel */}
        <SearchCardsCarousel onCardSelect={handlePresetCardSelect} />

        {/* Search form */}
        <SearchForm
          filters={filters}
          onFiltersChange={setFilters}
          onSearch={handleSearch}
          onClear={() => setShowClearModal(true)}
        />

        {/* Charts panel */}
        {hasSearched && (histogramData.length > 0 || partyTotals) && (
          <ChartsPanel
            histogramData={histogramData}
            partyTotals={partyTotals}
            currentStartDate={filters.start_date}
            currentEndDate={filters.end_date}
            searchTerm={searchedTerm}
            onDateRangeSelect={(start, end) => {
              const newFilters = { ...filters, start_date: start, end_date: end };
              setFilters(newFilters);
              setSelectedIds(new Set());
              const newParams = filtersToParams(newFilters, sortMode);
              setSearchParams(newParams, { replace: false });
              performSearch(1, false, { start_date: start, end_date: end });
            }}
            onPartySelect={(party) => {
              const newFilters = { ...filters, party };
              setFilters(newFilters);
              setSelectedIds(new Set());
              const newParams = filtersToParams(newFilters, sortMode);
              setSearchParams(newParams, { replace: false });
              performSearch(1, false, { party });
            }}
          />
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="text-center mt-5 mb-5">
            <div className="spinner-border text-primary mb-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div className="small text-muted mb-2">Searching millions of entries...</div>
          </div>
        )}

        {/* Results info panel */}
        {hasSearched && !isLoading && (
          <ResultsInfoPanel
            totalCount={totalResultCount}
            uniqueLegislators={uniqueLegislatorCount}
            sortMode={sortMode}
            onSortChange={handleSortChange}
            onShare={() => setShowShareModal(true)}
            onExport={() => setShowExportModal(true)}
            selectedCount={selectedIds.size}
          />
        )}

        {/* Results */}
        {!isLoading && results.length > 0 && (
          <div className="results-container">
            {results.map((result) => (
              <ResultCard
                key={result.classification_id}
                result={result}
                highlightTerms={highlightTerms}
                filters={filters}
                isSelected={selectedIds.has(result.classification_id)}
                onSelect={() => handleCardSelect(result.classification_id)}
                onFilterChange={handleFilterChange}
              />
            ))}
          </div>
        )}

        {/* No results message */}
        {hasSearched && !isLoading && results.length === 0 && (
          <div className="text-center mt-5 text-muted">
            <i className="bi bi-search fs-1 mb-3 d-block"></i>
            <p>No results found. Try adjusting your search filters.</p>
          </div>
        )}

        {/* Loading more indicator */}
        {isLoadingMore && (
          <div className="text-center mt-5 mb-5">
            <div className="spinner-border text-primary mb-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div className="small text-muted mb-2">Loading more results...</div>
          </div>
        )}

        {/* Modals */}
        <ShareModal
          show={showShareModal}
          onHide={() => setShowShareModal(false)}
          filters={filters}
          sortMode={sortMode}
        />

        <ExportModal
          show={showExportModal}
          onHide={() => setShowExportModal(false)}
          filters={filters}
          totalCount={totalResultCount}
          selectedIds={Array.from(selectedIds)}
        />

        <ClearConfirmModal
          show={showClearModal}
          onHide={() => setShowClearModal(false)}
          onConfirm={handleClearFilters}
        />
      </div>

      {/* Back to top button */}
      <BackToTopButton />
    </div>
  );
}

function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      className="btn btn-primary back-to-top-btn"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Back to top"
    >
      <span aria-hidden="true">&#8593;</span> Top
    </button>
  );
}

export default LegislatorSearch;
