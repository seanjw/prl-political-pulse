// State code mappings
export const STATE_TO_CODE: Record<string, string> = {
  'Alabama': 'AL',
  'Alaska': 'AK',
  'Arizona': 'AZ',
  'Arkansas': 'AR',
  'California': 'CA',
  'Colorado': 'CO',
  'Connecticut': 'CT',
  'Delaware': 'DE',
  'District of Columbia': 'DC',
  'Florida': 'FL',
  'Georgia': 'GA',
  'Hawaii': 'HI',
  'Idaho': 'ID',
  'Illinois': 'IL',
  'Indiana': 'IN',
  'Iowa': 'IA',
  'Kansas': 'KS',
  'Kentucky': 'KY',
  'Louisiana': 'LA',
  'Maine': 'ME',
  'Maryland': 'MD',
  'Massachusetts': 'MA',
  'Michigan': 'MI',
  'Minnesota': 'MN',
  'Mississippi': 'MS',
  'Missouri': 'MO',
  'Montana': 'MT',
  'Nebraska': 'NE',
  'Nevada': 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  'Ohio': 'OH',
  'Oklahoma': 'OK',
  'Oregon': 'OR',
  'Pennsylvania': 'PA',
  'Puerto Rico': 'PR',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  'Tennessee': 'TN',
  'Texas': 'TX',
  'Utah': 'UT',
  'Vermont': 'VT',
  'Virginia': 'VA',
  'Washington': 'WA',
  'West Virginia': 'WV',
  'Wisconsin': 'WI',
  'Wyoming': 'WY',
};

export const CODE_TO_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_TO_CODE).map(([name, code]) => [code, name])
);

// Party aliases for canonicalization
export const PARTY_ALIASES: Record<string, Set<string>> = {
  Democrat: new Set([
    "Democrat",
    "Democratic-Farmer-Labor",
    "Democratic/Independence/Working Families",
    "Democratic/Progressive",
    "Democratic/Working Families",
  ]),
  Republican: new Set([
    "Republican",
    "Republican/Conservative",
    "Republican/Conservative/Independence",
    "Republican/Conservative/Independence/Ref",
  ]),
  Independent: new Set(["Independent", "Nonpartisan"]),
};

// Party badge classes (Bootstrap)
export const PARTY_BADGES: Record<string, string> = {
  'Democrat': 'bg-primary',
  'Democratic-Farmer-Labor': 'bg-primary',
  'Democratic/Independence/Working Families': 'bg-primary',
  'Democratic/Progressive': 'bg-primary',
  'Democratic/Working Families': 'bg-primary',
  'Republican': 'bg-danger',
  'Republican/Conservative': 'bg-danger',
  'Republican/Conservative/Independence': 'bg-danger',
  'Republican/Conservative/Independence/Ref': 'bg-danger',
  'Independent': 'bg-secondary',
  'Nonpartisan': 'bg-secondary',
  'Movimiento Victoria Ciudadana': 'bg-warning text-dark',
  'Partido Independentista Puertorriqueño': 'bg-warning text-dark',
  'Partido Nuevo Progresista': 'bg-warning text-dark',
  'Partido Popular Democrático': 'bg-warning text-dark',
  'Proyecto Dignidad': 'bg-warning text-dark',
};

// Labels
export const CHAMBER_LABELS: Record<string, string> = {
  'Representative': 'House',
  'Senator': 'Senate',
  'lower': 'Lower',
  'upper': 'Upper',
  'legislature': 'Legislature',
};

export const SOURCE_LABELS: Record<string, string> = {
  'tweets': 'Tweet',
  'tweets_state': 'Tweet',
  'floor': 'Floor Speech',
  'newsletters': 'Newsletter',
  'statements': 'Statement',
};

export const LEVEL_LABELS: Record<string, string> = {
  'state': 'State',
  'federal': 'Federal',
};

// Date and history limits
export const MIN_START_DATE = '2017-07-01';
export const MAX_HISTORY_LENGTH = 75;
export const SCROLL_LOAD_THRESHOLD = 0.65;

// Chart colors
export const PARTY_COLORS_LIGHT: Record<string, string> = {
  'Democrat': 'rgba(13, 110, 253, 0.35)',
  'Republican': 'rgba(220, 53, 69, 0.35)',
  'Independent': 'rgba(201, 203, 207, 0.35)',
};

export const PARTY_COLORS_DARK: Record<string, string> = {
  'Democrat': 'rgba(13, 110, 253, 1)',
  'Republican': 'rgba(220, 53, 69, 1)',
  'Independent': 'rgba(201, 203, 207, 1)',
};

// Sort display text
export const SORT_DISPLAY_TEXT: Record<string, string> = {
  'date-desc': 'Sorting by Newest',
  'date-asc': 'Sorting by Oldest',
  'alpha-asc': 'Sorting A-Z',
  'alpha-desc': 'Sorting Z-A',
  'speaker-freq': 'Sorting by Frequency'
};

// API configuration
// Use empty string for dev (Vite proxy handles /dev/* requests)
// In production, use the API Gateway endpoint directly
export const API_BASE = import.meta.env.DEV ? '' : import.meta.env.VITE_SEARCH_API_URL;

// Utility functions
export function normalizePartyName(party: string): string {
  if (!party) return "";
  for (const [canonical, aliasSet] of Object.entries(PARTY_ALIASES)) {
    if (aliasSet.has(party)) return canonical;
  }
  return party;
}

export function getPartyBadgeClass(party: string): string {
  return PARTY_BADGES[party] || 'bg-secondary';
}

export function transformStateValue(value: string): string {
  if (!value) return "";
  const uppercase = value.toUpperCase();
  if (STATE_TO_CODE[value]) return STATE_TO_CODE[value];
  if (CODE_TO_STATE[uppercase]) return uppercase;
  return value;
}

export function getDefaultDateRange(): { start: string; end: string } {
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  const minimumDate = new Date(MIN_START_DATE);
  const startDateFinal = oneYearAgo < minimumDate ? minimumDate : oneYearAgo;

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    start: formatDate(startDateFinal),
    end: formatDate(today),
  };
}

export function formatDateToReadable(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function highlightSearchTerms(text: string, highlightTerms: string[]): string {
  if (!text || !highlightTerms || highlightTerms.length === 0) return text;

  const sortedTerms = [...highlightTerms].sort((a, b) => b.length - a.length);

  const escapedTerms = sortedTerms.map((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return /^\w+$/.test(term) ? `\\b${escaped}\\b` : escaped;
  });

  const pattern = `(${escapedTerms.join("|")})`;
  const regex = new RegExp(pattern, "giu");
  return text.replace(regex, (match) => `<strong class="search-highlight">${match}</strong>`);
}

// Preset search card type and data
export interface PresetSearchCard {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  params: {
    search?: string;
    start_date?: string;
    end_date?: string;
    party?: string;
    policy?: string;
    sort_mode?: string;
  };
}

export const PRESET_SEARCH_CARDS: PresetSearchCard[] = [
  {
    id: 'immigration',
    title: 'Immigration',
    subtitle: 'Statements about immigration',
    icon: 'bi bi-globe',
    params: {
      search: 'immigration',
      sort_mode: 'date-desc',
    },
  },
  {
    id: 'economy',
    title: 'Economy',
    subtitle: 'Economic policy statements',
    icon: 'bi bi-graph-up',
    params: {
      search: 'economy',
      sort_mode: 'date-desc',
    },
  },
];
