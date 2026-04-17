import type { PrlMeta } from '../types/event';

export const PRL_META_COLORS: Record<PrlMeta | string, string> = {
  'Government Policy': '#3B82F6',
  'Politician/Party': '#EF4444',
  'Unclear': '#6B7280',
  'Institution': '#8B5CF6',
};

export function getMarkerRadius(totalKilled: number, maxKilled: number): number {
  if (maxKilled === 0) return 4;
  const normalized = totalKilled / maxKilled;
  return 4 + normalized * 16;
}

export function getMarkerColor(prlMeta: string): string {
  return PRL_META_COLORS[prlMeta] || PRL_META_COLORS['Unclear'];
}

export const STATE_NAME_MAP: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
  'Puerto Rico': 'PR'
};

export const STATE_ABBR_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAME_MAP).map(([name, abbr]) => [abbr, name])
);

// State centers and zoom levels for zooming into states
// Centers are adjusted to keep state fully visible within the map viewport
export const STATE_CENTERS: Record<string, { center: [number, number]; zoom: number }> = {
  'Alabama': { center: [-86.9, 32.8], zoom: 4.5 },
  'Alaska': { center: [-153, 64], zoom: 2 },
  'Arizona': { center: [-111.5, 34.2], zoom: 4 },
  'Arkansas': { center: [-92.4, 34.9], zoom: 4.5 },
  'California': { center: [-119.5, 37.5], zoom: 3.2 },
  'Colorado': { center: [-105.5, 39], zoom: 4 },
  'Connecticut': { center: [-72.7, 41.6], zoom: 7 },
  'Delaware': { center: [-75.5, 39], zoom: 7 },
  'Florida': { center: [-83, 28], zoom: 3.8 },
  'Georgia': { center: [-83.5, 32.7], zoom: 4.5 },
  'Hawaii': { center: [-157, 20.5], zoom: 4 },
  'Idaho': { center: [-114.7, 44.4], zoom: 3.8 },
  'Illinois': { center: [-89.2, 40], zoom: 4 },
  'Indiana': { center: [-86.3, 39.9], zoom: 4.5 },
  'Iowa': { center: [-93.5, 42], zoom: 4.5 },
  'Kansas': { center: [-98.4, 38.5], zoom: 4 },
  'Kentucky': { center: [-85.7, 37.8], zoom: 4.5 },
  'Louisiana': { center: [-91.9, 31], zoom: 4.5 },
  'Maine': { center: [-69, 45.4], zoom: 4.5 },
  'Maryland': { center: [-76.8, 39.1], zoom: 5.5 },
  'Massachusetts': { center: [-71.8, 42.2], zoom: 6 },
  'Michigan': { center: [-85.6, 44.3], zoom: 3.8 },
  'Minnesota': { center: [-94.3, 46.3], zoom: 3.8 },
  'Mississippi': { center: [-89.7, 32.7], zoom: 4.5 },
  'Missouri': { center: [-92.5, 38.4], zoom: 4 },
  'Montana': { center: [-110, 47], zoom: 3.5 },
  'Nebraska': { center: [-99.8, 41.5], zoom: 4 },
  'Nevada': { center: [-116.6, 39], zoom: 3.5 },
  'New Hampshire': { center: [-71.6, 43.7], zoom: 5.5 },
  'New Jersey': { center: [-74.7, 40.2], zoom: 6 },
  'New Mexico': { center: [-106, 34.4], zoom: 4 },
  'New York': { center: [-75.5, 43], zoom: 4 },
  'North Carolina': { center: [-79.4, 35.5], zoom: 4.5 },
  'North Dakota': { center: [-100.5, 47.5], zoom: 4.5 },
  'Ohio': { center: [-82.8, 40.3], zoom: 4.5 },
  'Oklahoma': { center: [-97.5, 35.5], zoom: 4 },
  'Oregon': { center: [-120.5, 44], zoom: 4 },
  'Pennsylvania': { center: [-77.6, 41], zoom: 4.5 },
  'Rhode Island': { center: [-71.5, 41.7], zoom: 8 },
  'South Carolina': { center: [-80.9, 33.9], zoom: 5 },
  'South Dakota': { center: [-100.2, 44.4], zoom: 4 },
  'Tennessee': { center: [-86.3, 35.8], zoom: 4.5 },
  'Texas': { center: [-99.5, 31.5], zoom: 3 },
  'Utah': { center: [-111.7, 39.3], zoom: 4 },
  'Vermont': { center: [-72.7, 44], zoom: 5.5 },
  'Virginia': { center: [-78.8, 37.5], zoom: 4.5 },
  'Washington': { center: [-120.5, 47.4], zoom: 4 },
  'West Virginia': { center: [-80.6, 38.9], zoom: 5 },
  'Wisconsin': { center: [-89.8, 44.6], zoom: 4 },
  'Wyoming': { center: [-107.5, 43], zoom: 4 },
  'District of Columbia': { center: [-77, 38.9], zoom: 10 },
};
