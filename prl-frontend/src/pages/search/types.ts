// Search filter types
export interface SearchFilters {
  name: string;
  gender: string;
  level: string;
  type: string;
  state: string;
  district: string;
  party: string;
  active: string;
  source: string;
  start_date: string;
  end_date: string;
  search: string;
  extreme_label: string;
  attack_policy: string;
  attack_personal: string;
  policy: string;
  outcome_bipartisanship: string;
  outcome_creditclaiming: string;
}

export type SortMode = 'date-desc' | 'date-asc' | 'alpha-asc' | 'alpha-desc' | 'speaker-freq';

// API response types
export interface SearchResult {
  classification_id: string;
  name: string;
  party: string;
  type: string;
  level: string;
  state: string;
  district: string;
  source: string;
  date: string;
  text: string;
  result_index: number;
  extreme_label: string;
  attack_policy: number;
  attack_personal: number;
  policy: number;
  outcome_bipartisanship: number;
  outcome_creditclaiming: number;
  gender: string;
  active: number;
  campaign_website: string;
  email: string;
  government_website: string;
  truth_social: string;
  twitter_handle: string;
  youtube: string;
  tweet_id?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  highlight_terms: string[];
  has_more_results: boolean;
  total_result_count: number;
  unique_legislator_count: number;
  duration: number;
}

export interface HistogramDataPoint {
  month: string;
  Democrat: number;
  Republican: number;
  Independent: number;
}

export interface HistogramResponse {
  histogram_data: HistogramDataPoint[];
}

export interface PartyTotals {
  Democrat: number;
  Republican: number;
  Independent: number;
}

export interface TotalsResponse {
  totals: PartyTotals;
}

export interface AutocompleteData {
  names: string[];
  states: string[];
  districts: string[];
}

// Preset search card
export interface PresetSearch {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  fields: Partial<SearchFilters>;
}
