import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import type { PrimaryCandidate, PrimaryRace, PrimaryFilters } from '../types/primary';

const defaultFilters: PrimaryFilters = {
  state: '',
  chamber: '',
  party: '',
  incumbentStatus: '',
  search: '',
};

export function usePrimaryFilters(
  candidates: PrimaryCandidate[],
  races: PrimaryRace[]
) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [filters, setFiltersState] = useState<PrimaryFilters>(() => ({
    state: searchParams.get('state') || '',
    chamber: searchParams.get('chamber') || '',
    party: searchParams.get('party') || '',
    incumbentStatus: searchParams.get('status') || '',
    search: searchParams.get('q') || '',
  }));

  const setFilters = useCallback(
    (update: Partial<PrimaryFilters>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...update };
        const params = new URLSearchParams();
        if (next.state) params.set('state', next.state);
        if (next.chamber) params.set('chamber', next.chamber);
        if (next.party) params.set('party', next.party);
        if (next.incumbentStatus) params.set('status', next.incumbentStatus);
        if (next.search) params.set('q', next.search);
        const search = params.toString();
        navigate({ search: search ? `?${search}` : '', hash: location.hash }, { replace: true });
        return next;
      });
    },
    [navigate, location.hash]
  );

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    navigate({ search: '', hash: location.hash }, { replace: true });
  }, [navigate, location.hash]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (filters.state && c.state !== filters.state) return false;
      if (filters.chamber) {
        if (filters.chamber === 'senate' && c.office !== 'S') return false;
        if (filters.chamber === 'house' && c.office !== 'H') return false;
      }
      if (filters.party) {
        if (filters.party === 'democrat' && c.party !== 'Democrat') return false;
        if (filters.party === 'republican' && c.party !== 'Republican') return false;
      }
      if (filters.incumbentStatus) {
        if (filters.incumbentStatus === 'incumbent' && c.incumbent_challenge !== 'I') return false;
        if (filters.incumbentStatus === 'challenger' && c.incumbent_challenge !== 'C') return false;
        if (filters.incumbentStatus === 'open' && c.incumbent_challenge !== 'O') return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!c.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [candidates, filters]);

  const filteredRaces = useMemo(() => {
    const hasCandidateFilter = !!(filters.party || filters.incumbentStatus || filters.search);
    if (!filters.state && !filters.chamber && !hasCandidateFilter) return races;

    // When a candidate-level filter is active, restrict to races containing at
    // least one candidate that matches. filteredCandidates already applies
    // state/chamber too, so we can use it as the source of truth.
    const matchingRaceIds = hasCandidateFilter
      ? new Set(filteredCandidates.map((c) => c.race_id))
      : null;

    return races.filter((r) => {
      if (filters.state && r.state !== filters.state) return false;
      if (filters.chamber) {
        if (filters.chamber === 'senate' && r.office !== 'S') return false;
        if (filters.chamber === 'house' && r.office !== 'H') return false;
      }
      if (matchingRaceIds && !matchingRaceIds.has(r.race_id)) return false;
      return true;
    });
  }, [races, filters, filteredCandidates]);

  return { filters, setFilters, resetFilters, filteredCandidates, filteredRaces };
}
