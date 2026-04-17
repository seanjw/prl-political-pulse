import { API_BASE, transformStateValue, STATE_TO_CODE } from './config';
import type { SearchFilters, SearchResponse, HistogramResponse, TotalsResponse, AutocompleteData, SortMode } from './types';

// Transform filters before sending to API
function transformFilters(filters: SearchFilters): Record<string, string> {
  const transformed: Record<string, string> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (key === 'state') {
      transformed[key] = transformStateValue(value);
    } else {
      transformed[key] = value;
    }
  }

  return transformed;
}

// Build FormData from filters
function buildFormData(filters: SearchFilters, page: number, sortMode: SortMode): FormData {
  const transformed = transformFilters(filters);
  const formData = new FormData();

  for (const [key, value] of Object.entries(transformed)) {
    formData.append(key, value);
  }

  formData.append('page', String(page));
  formData.append('sort_mode', sortMode);

  return formData;
}

// Build FormData for histogram/totals (no page or sort)
function buildFilterFormData(filters: SearchFilters): FormData {
  const transformed = transformFilters(filters);
  const formData = new FormData();

  for (const [key, value] of Object.entries(transformed)) {
    formData.append(key, value);
  }

  return formData;
}

// Fetch search results
export async function fetchSearchResults(
  filters: SearchFilters,
  page: number,
  sortMode: SortMode,
  signal?: AbortSignal
): Promise<SearchResponse> {
  const formData = buildFormData(filters, page, sortMode);

  const response = await fetch(`${API_BASE}/dev/search`, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

// Fetch histogram data
export async function fetchHistogram(
  filters: SearchFilters,
  signal?: AbortSignal
): Promise<HistogramResponse> {
  const formData = buildFilterFormData(filters);

  const response = await fetch(`${API_BASE}/dev/search_histogram`, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  // Transform API response to expected format
  const data = await response.json();
  const histogram_data = data.labels.map((month: string, index: number) => ({
    month,
    Democrat: data.series[0]?.[index] ?? 0,
    Republican: data.series[1]?.[index] ?? 0,
    Independent: data.series[2]?.[index] ?? 0,
  }));

  return { histogram_data };
}

// Fetch totals data
export async function fetchTotals(
  filters: SearchFilters,
  signal?: AbortSignal
): Promise<TotalsResponse> {
  const formData = buildFilterFormData(filters);

  const response = await fetch(`${API_BASE}/dev/search_totals`, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  // Transform API response to expected format
  const data = await response.json();
  const totals = {
    Democrat: data.totals[0] ?? 0,
    Republican: data.totals[1] ?? 0,
    Independent: data.totals[2] ?? 0,
  };

  return { totals };
}

// Fetch autocomplete data
export async function fetchAutocompleteData(): Promise<AutocompleteData> {
  const response = await fetch(`${API_BASE}/dev/autocomplete_data`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  // Transform API response to match expected format
  // API returns: full_names, twitter_handles, districts
  // Frontend expects: names, states, districts
  return {
    names: data.full_names || [],
    states: Object.keys(STATE_TO_CODE), // Use state names from config
    districts: data.districts || [],
  };
}

// Export results (single request — use for small exports)
export async function exportResults(
  filters: SearchFilters,
  format: 'csv' | 'json',
  range: 'all' | 'first' | 'custom' | 'selected',
  startIndex?: number,
  endIndex?: number,
  selectedIds?: string[],
  signal?: AbortSignal
): Promise<Blob> {
  const formData = buildFilterFormData(filters);
  formData.append('format', format);
  formData.append('range', range);

  if (range === 'custom' && startIndex !== undefined && endIndex !== undefined) {
    formData.append('start_index', String(startIndex));
    formData.append('end_index', String(endIndex));
  }

  if (range === 'selected' && selectedIds) {
    formData.append('selected_ids', JSON.stringify(selectedIds));
  }

  const response = await fetch(`${API_BASE}/dev/export`, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.blob();
}

// Chunked export — pages through results in batches to avoid API Gateway 29s timeout
const EXPORT_CHUNK_SIZE = 5000;

export async function exportResultsChunked(
  filters: SearchFilters,
  format: 'csv' | 'json',
  totalCount: number,
  onProgress?: (downloaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  if (totalCount === 0) {
    return new Blob([''], { type: format === 'csv' ? 'text/csv' : 'application/json' });
  }

  const csvParts: string[] = [];
  const jsonParts: unknown[] = [];

  for (let offset = 0; offset < totalCount; offset += EXPORT_CHUNK_SIZE) {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');

    const startIndex = offset + 1;
    const endIndex = Math.min(offset + EXPORT_CHUNK_SIZE, totalCount);

    const formData = buildFilterFormData(filters);
    formData.append('format', format);
    formData.append('range', 'custom');
    formData.append('start_index', String(startIndex));
    formData.append('end_index', String(endIndex));

    const response = await fetch(`${API_BASE}/dev/export`, {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!response.ok) {
      throw new Error(`Export failed (rows ${startIndex.toLocaleString()}-${endIndex.toLocaleString()}): HTTP ${response.status}`);
    }

    if (format === 'csv') {
      const text = await response.text();
      if (offset === 0) {
        csvParts.push(text);
      } else {
        // Strip header row from subsequent chunks
        const firstNewline = text.indexOf('\n');
        if (firstNewline !== -1 && firstNewline < text.length - 1) {
          csvParts.push(text.substring(firstNewline + 1));
        }
      }
    } else {
      const data = await response.json();
      if (Array.isArray(data)) {
        jsonParts.push(...data);
      }
    }

    onProgress?.(Math.min(endIndex, totalCount), totalCount);
  }

  if (format === 'json') {
    return new Blob([JSON.stringify(jsonParts, null, 2)], { type: 'application/json' });
  }

  return new Blob(csvParts, { type: 'text/csv' });
}
