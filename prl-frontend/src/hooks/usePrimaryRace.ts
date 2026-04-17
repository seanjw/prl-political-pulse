import { useMemo } from 'react';
import { usePrimaryData } from './usePrimaryData';
import type { PrimaryCandidate, PrimaryRace } from '../types/primary';

interface PrimaryRaceData {
  race: PrimaryRace | null;
  candidates: PrimaryCandidate[];
  democrats: PrimaryCandidate[];
  republicans: PrimaryCandidate[];
}

export function usePrimaryRace(raceId: string | undefined) {
  // Determine the state from the raceId (format: "XX-NN" or "XX-S")
  const stateCode = raceId?.split('-')[0];
  const states = stateCode ? [stateCode] : undefined;
  const { data, loading, error } = usePrimaryData(states);

  const raceData = useMemo<PrimaryRaceData>(() => {
    if (!data || !raceId) {
      return { race: null, candidates: [], democrats: [], republicans: [] };
    }

    const race = data.raceMap.get(raceId) || null;
    if (!race) {
      return { race: null, candidates: [], democrats: [], republicans: [] };
    }

    const allIds = [...race.candidates.democrat, ...race.candidates.republican];
    const candidates = allIds
      .map((id) => data.candidateMap.get(id))
      .filter((c): c is PrimaryCandidate => !!c);

    const democrats = candidates.filter((c) => c.party === 'Democrat');
    const republicans = candidates.filter((c) => c.party === 'Republican');

    return { race, candidates, democrats, republicans };
  }, [data, raceId]);

  return { ...raceData, loading, error };
}
