import { useState, useEffect, useMemo } from 'react';
import { API_BASE } from '../config/api';
import { usePrimaryData, loadStateData } from './usePrimaryData';
import type { PrimaryCandidate, PrimaryRace, PrimaryStatement } from '../types/primary';

interface PrimaryCandidateData {
  candidate: PrimaryCandidate | null;
  race: PrimaryRace | null;
  raceCandidates: PrimaryCandidate[];
  statements: PrimaryStatement[];
}

export function usePrimaryCandidate(candidateId: string | undefined) {
  const { data, loading: dataLoading, error, refresh } = usePrimaryData();
  const [statements, setStatements] = useState<PrimaryStatement[]>([]);
  const [statementsLoading, setStatementsLoading] = useState(!!candidateId);
  const [stateLoading, setStateLoading] = useState(false);

  // If candidate not found in cache, try to find their state from raceMap and load it
  useEffect(() => {
    if (!data || !candidateId) return;
    const candidate = data.candidateMap.get(candidateId);
    if (candidate) return; // already loaded

    // Candidate not in cache — find their state from the race data
    // Race IDs are formatted as {state}-{district} or {state}-S
    // Search all races for this candidate ID
    let stateCode: string | null = null;
    for (const race of data.races) {
      const allIds = [...race.candidates.democrat, ...race.candidates.republican];
      if (allIds.includes(candidateId)) {
        stateCode = race.state;
        break;
      }
    }

    if (stateCode) {
      setStateLoading(true);
      loadStateData(stateCode).then(() => {
        refresh();
        setStateLoading(false);
      });
    }
  }, [data, candidateId, refresh]);

  // Fetch statements via /query/
  useEffect(() => {
    if (!candidateId) return;
    let cancelled = false;
    setStatementsLoading(true);

    async function fetchStatements() {
      try {
        const res = await fetch(`${API_BASE}/primary/statements/${candidateId}`);
        if (!res.ok) throw new Error('Failed to fetch statements');
        const json = await res.json();

        if (!cancelled) {
          setStatements(json.data.slice(0, 20));
          setStatementsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setStatements([]);
          setStatementsLoading(false);
        }
      }
    }

    fetchStatements();
    return () => { cancelled = true; };
  }, [candidateId]);

  const result = useMemo<PrimaryCandidateData>(() => {
    if (!data || !candidateId) {
      return { candidate: null, race: null, raceCandidates: [], statements: [] };
    }

    const candidate = data.candidateMap.get(candidateId) || null;
    if (!candidate) {
      return { candidate: null, race: null, raceCandidates: [], statements: [] };
    }

    const race = data.raceMap.get(candidate.race_id) || null;
    const raceCandidates = race
      ? [...race.candidates.democrat, ...race.candidates.republican]
          .map((id) => data.candidateMap.get(id))
          .filter((c): c is PrimaryCandidate => !!c)
      : [];

    return { candidate, race, raceCandidates, statements };
  }, [data, candidateId, statements]);

  return {
    ...result,
    loading: dataLoading || statementsLoading || stateLoading,
    error,
  };
}
