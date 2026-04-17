import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

export interface CategoryMeans {
  policy: number;
  attack_policy: number;
  attack_personal: number;
  outcome_bipartisanship: number;
  outcome_creditclaiming: number;
}

export interface ElitesIntro {
  count: string;
  'to-day': string;
  'to-year': string;
  'to-month': string;
  'category-means': CategoryMeans;
}

export interface CongressMember {
  name: string;
  party: string;
  state: string;
  chamber: string;
  image_url?: string;
  source_id: string;
}

export interface LeaderboardEntry {
  name: string;
  party: string;
  state: string;
  value: number;
  source_id: string;
}

export interface StateGeoData {
  name: string;
  value: number;
}

export interface PartyBreakdown {
  Democrat: number;
  Republican: number;
  Independent?: number;
}

export interface CongressByParty {
  [category: string]: PartyBreakdown;
}

export interface ElitesData {
  intro: ElitesIntro | null;
  congress: {
    byType: {
      House: CategoryMeans;
      Senate: CategoryMeans;
    };
    byParty: CongressByParty;
  };
  leaderboards: {
    [category: string]: {
      dems: LeaderboardEntry[];
      reps: LeaderboardEntry[];
    };
  };
  geo: {
    [category: string]: StateGeoData[];
  };
  categoriesOverTime: {
    dates: string[];
    [category: string]: number[] | string[];
  } | null;
}

const defaultData: ElitesData = {
  intro: null,
  congress: {
    byType: {
      House: { policy: 0, attack_policy: 0, attack_personal: 0, outcome_bipartisanship: 0, outcome_creditclaiming: 0 },
      Senate: { policy: 0, attack_policy: 0, attack_personal: 0, outcome_bipartisanship: 0, outcome_creditclaiming: 0 },
    },
    byParty: {},
  },
  leaderboards: {},
  geo: {},
  categoriesOverTime: null,
};

export function useElitesData() {
  const [data, setData] = useState<ElitesData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`${API_BASE}/data/elites/landing`);
        const json = await response.json();
        const d = json.data;

        // Parse leaderboards - API returns {category: {dems: [...], reps: [...]}}
        // API entries have: first_name, last_name, percent, source_id, party, state
        // We need: name, value, source_id, party, state
        const leaderboards: ElitesData['leaderboards'] = {};
        if (d.leaderboards) {
          for (const [category, entries] of Object.entries(d.leaderboards)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const e = entries as { dems?: any[]; reps?: any[] };
            const transformEntry = (entry: { first_name?: string; last_name?: string; percent?: number; source_id?: string; party?: string; state?: string }): LeaderboardEntry => ({
              name: `${entry.first_name || ''} ${entry.last_name || ''}`.trim(),
              value: entry.percent || 0,
              source_id: entry.source_id || '',
              party: entry.party || '',
              state: entry.state || '',
            });
            leaderboards[category] = {
              dems: (e.dems || []).map(transformEntry),
              reps: (e.reps || []).map(transformEntry),
            };
          }
        }

        // Parse geo data - API returns {category: [{name, value}, ...]}
        const geo: ElitesData['geo'] = {};
        if (d.geo) {
          for (const [category, stateData] of Object.entries(d.geo)) {
            geo[category] = stateData as StateGeoData[];
          }
        }

        // Parse congress by_party data
        // API structure: Congress.Democrats/Republicans/Independents with fields like policy_mean, attack_policy_mean
        const byParty: CongressByParty = {};
        if (d.congress?.by_party?.Congress) {
          const partyData = d.congress.by_party.Congress;
          const categories = ['policy', 'attack_policy', 'attack_personal', 'outcome_bipartisanship', 'outcome_creditclaiming'];
          for (const cat of categories) {
            const meanKey = `${cat}_mean`;
            byParty[cat] = {
              Democrat: partyData.Democrats?.[meanKey] || 0,
              Republican: partyData.Republicans?.[meanKey] || 0,
              Independent: partyData.Independents?.[meanKey] || 0,
            };
          }
        }

        const parsed: ElitesData = {
          intro: d.intro || null,
          congress: {
            byType: {
              House: d.congress?.by_type?.House || defaultData.congress.byType.House,
              Senate: d.congress?.by_type?.Senate || defaultData.congress.byType.Senate,
            },
            byParty,
          },
          leaderboards,
          geo,
          categoriesOverTime: d['categories-over-time'] || null,
        };

        setData(parsed);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load elites data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error };
}
