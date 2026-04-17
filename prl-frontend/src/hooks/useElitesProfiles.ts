import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config/api';

const IMAGE_BASE = 'https://americaspoliticalpulse.com';

// State code to full name mapping
const STATE_CODE_TO_NAME: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', PR: 'Puerto Rico', GU: 'Guam', VI: 'Virgin Islands',
  AS: 'American Samoa', MP: 'Northern Mariana Islands',
};

export interface LegislatorProfile {
  source_id: string;
  name: string;
  party: string;
  state: string;
  chamber: string;
  image_url?: string;
  policy?: number;
  attack_policy?: number;
  attack_personal?: number;
  outcome_creditclaiming?: number;
  outcome_bipartisanship?: number;
}

export interface ProfileFilters {
  name?: string;
  state?: string;
  party?: string[];
  chamber?: string[];
  sourceType?: 'national' | 'state';
}

interface QueryFilter {
  field: string;
  op: 'eq' | 'in' | 'icontains';
  value: string | string[];
}

interface QueryRequest {
  table: string;
  filters?: QueryFilter[];
  nextpage?: number;
  pagesize?: number;
}

interface UseElitesProfilesResult {
  profiles: LegislatorProfile[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

export function useElitesProfiles(filters: ProfileFilters): UseElitesProfilesResult {
  const [profiles, setProfiles] = useState<LegislatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const buildFilters = useCallback((): QueryFilter[] => {
    const queryFilters: QueryFilter[] = [];

    // Add level filter based on sourceType
    const level = filters.sourceType === 'state' ? 'State' : 'National';
    queryFilters.push({
      field: 'level',
      op: 'in',
      value: [level],
    });

    if (filters.name && filters.name.trim()) {
      queryFilters.push({
        field: 'name',
        op: 'icontains',
        value: filters.name.trim(),
      });
    }

    if (filters.state) {
      // Convert state code to full name if needed
      const stateName = STATE_CODE_TO_NAME[filters.state] || filters.state;
      queryFilters.push({
        field: 'state',
        op: 'eq',
        value: stateName,
      });
    }

    if (filters.party && filters.party.length > 0) {
      queryFilters.push({
        field: 'party',
        op: 'in',
        value: filters.party,
      });
    }

    if (filters.chamber && filters.chamber.length > 0) {
      // Map chamber display names to type values used by API
      const chamberToType: Record<string, string> = {
        'House': 'Representative',
        'Senate': 'Senator',
        'Lower': 'lower',
        'Upper': 'upper',
        'Legislature': 'legislature',
      };
      const typeValues = filters.chamber.map(c => chamberToType[c] || c);
      queryFilters.push({
        field: 'type',
        op: 'in',
        value: typeValues,
      });
    }

    return queryFilters;
  }, [filters.name, filters.state, filters.party, filters.chamber, filters.sourceType]);

  // Helper to transform raw API data to LegislatorProfile
  const transformProfiles = (rawProfiles: Record<string, unknown>[]): LegislatorProfile[] => {
    return rawProfiles.map((p) => {
      const type = p.type as string;
      const chamber = type === 'Representative' ? 'House' : type === 'Senator' ? 'Senate' : type || '';
      const scores = p.scores as Record<string, number> | null;

      return {
        source_id: p.source_id as string,
        name: p.name as string,
        party: p.party as string,
        state: p.state as string,
        chamber,
        image_url: p.image_url ? `${IMAGE_BASE}${p.image_url}` : undefined,
        policy: scores?.policy ?? 0,
        attack_policy: scores?.attack_policy ?? 0,
        attack_personal: scores?.attack_personal ?? 0,
        outcome_creditclaiming: scores?.outcome_creditclaiming ?? 0,
        outcome_bipartisanship: scores?.outcome_bipartisanship ?? 0,
      };
    });
  };

  const fetchProfiles = useCallback(async (isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setLoading(true);
        setProfiles([]);
      }

      const filters = buildFilters();
      let allProfiles: LegislatorProfile[] = [];
      let currentNextPage: number | null = isLoadMore && nextPage !== null ? nextPage : null;

      // Fetch multiple pages on initial load (5 pages = 100 results)
      const pagesToFetch = isLoadMore ? 1 : 5;

      for (let i = 0; i < pagesToFetch; i++) {
        const request: QueryRequest = {
          table: 'legislators',
          filters,
        };

        if (currentNextPage !== null) {
          request.nextpage = currentNextPage;
        }

        const response = await fetch(`${API_BASE}/query/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const json = await response.json();
        const rawProfiles = json.data || [];
        const newProfiles = transformProfiles(rawProfiles);
        allProfiles = [...allProfiles, ...newProfiles];
        currentNextPage = json.nextpage ?? null;

        // Stop if no more pages
        if (currentNextPage === null) break;
      }

      if (isLoadMore) {
        setProfiles((prev) => [...prev, ...allProfiles]);
      } else {
        setProfiles(allProfiles);
      }

      setNextPage(currentNextPage);
      setHasMore(currentNextPage !== null);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Failed to load profiles:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profiles');
      setLoading(false);
    }
  }, [buildFilters, nextPage]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchProfiles(true);
    }
  }, [hasMore, loading, fetchProfiles]);

  const refetch = useCallback(() => {
    setNextPage(null);
    fetchProfiles(false);
  }, [fetchProfiles]);

  // Initial fetch and refetch when filters change
  useEffect(() => {
    setNextPage(null);
    fetchProfiles(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.name, filters.state, JSON.stringify(filters.party), JSON.stringify(filters.chamber), filters.sourceType]);

  return {
    profiles,
    loading,
    error,
    hasMore,
    loadMore,
    refetch,
  };
}
