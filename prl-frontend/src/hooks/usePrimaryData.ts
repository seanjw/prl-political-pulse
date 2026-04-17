import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config/api';
import type { PrimaryCandidate, PrimaryRace, PrimaryAward } from '../types/primary';

export interface PrimaryData {
  candidates: PrimaryCandidate[];
  races: PrimaryRace[];
  awards: PrimaryAward[];
  candidateMap: Map<string, PrimaryCandidate>;
  raceMap: Map<string, PrimaryRace>;
}

interface LandingPayload {
  races: PrimaryRace[];
  candidates: PrimaryCandidate[];
  awards?: PrimaryAward[];
}

// Shared global cache that grows as data is loaded
const globalCache = {
  candidateMap: new Map<string, PrimaryCandidate>(),
  raceMap: new Map<string, PrimaryRace>(),
  awards: [] as PrimaryAward[],
  landingLoaded: false,
  allCandidatesLoaded: false,
  statesLoaded: new Set<string>(),
  statePromises: new Map<string, Promise<void>>(),
};

function buildSnapshot(): PrimaryData {
  return {
    candidates: Array.from(globalCache.candidateMap.values()),
    races: Array.from(globalCache.raceMap.values()),
    awards: [...globalCache.awards],
    candidateMap: new Map(globalCache.candidateMap),
    raceMap: new Map(globalCache.raceMap),
  };
}

function mergePayload(payload: LandingPayload) {
  for (const r of payload.races) {
    globalCache.raceMap.set(r.race_id, r);
  }
  for (const c of payload.candidates) {
    // Incumbent rhetoric arrives as percentages (0–100); challengers as fractions (0–1).
    // Normalise to 0–1 so every downstream component can simply multiply by 100.
    if (c.rhetoric && Object.values(c.rhetoric).some((v) => v > 1)) {
      for (const key of Object.keys(c.rhetoric)) {
        c.rhetoric[key] = c.rhetoric[key] / 100;
      }
    }
    globalCache.candidateMap.set(c.candidate_id, c);
  }
  if (payload.awards) {
    // Normalise award values — incumbent data may arrive as percentages (0–100)
    globalCache.awards = payload.awards.map((a) =>
      a.value > 1 ? { ...a, value: a.value / 100 } : a,
    );
  }
}

let landingPromise: Promise<void> | null = null;

function ensureLandingLoaded(): Promise<void> {
  if (globalCache.landingLoaded) return Promise.resolve();
  if (!landingPromise) {
    landingPromise = fetch(`${API_BASE}/data/primary/landing`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch primary landing data');
        return res.json();
      })
      .then((json) => {
        mergePayload(json.data as LandingPayload);
        globalCache.landingLoaded = true;
      });
  }
  return landingPromise;
}

let allCandidatesPromise: Promise<void> | null = null;

export function loadAllCandidates(): Promise<void> {
  if (globalCache.allCandidatesLoaded) return Promise.resolve();
  if (!allCandidatesPromise) {
    allCandidatesPromise = fetch(`${API_BASE}/data/primary/all-candidates`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch all candidates');
        return res.json();
      })
      .then((json) => {
        const candidates = json.data as PrimaryCandidate[];
        for (const c of candidates) {
          // Normalise rhetoric — incumbent data may arrive as percentages (0–100)
          if (c.rhetoric && Object.values(c.rhetoric).some((v) => v > 1)) {
            for (const key of Object.keys(c.rhetoric)) {
              c.rhetoric[key] = c.rhetoric[key] / 100;
            }
          }
          globalCache.candidateMap.set(c.candidate_id, c);
        }
        globalCache.allCandidatesLoaded = true;
      });
  }
  return allCandidatesPromise;
}

export function loadStateData(stateCode: string): Promise<void> {
  if (globalCache.statesLoaded.has(stateCode)) return Promise.resolve();
  const existing = globalCache.statePromises.get(stateCode);
  if (existing) return existing;

  const promise = fetch(`${API_BASE}/data/primary/state/${stateCode}`)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch state ${stateCode}`);
      return res.json();
    })
    .then((json) => {
      mergePayload(json.data as LandingPayload);
      globalCache.statesLoaded.add(stateCode);
    });

  globalCache.statePromises.set(stateCode, promise);
  return promise;
}

/**
 * Load primary landing data (all races + competitive candidates).
 * Optionally pass state codes to also load those states' candidates.
 */
export function usePrimaryData(states?: string[]) {
  const [data, setData] = useState<PrimaryData | null>(
    globalCache.landingLoaded ? buildSnapshot() : null,
  );
  const [loading, setLoading] = useState(!globalCache.landingLoaded);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => setData(buildSnapshot()), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await ensureLandingLoaded();
        if (states && states.length > 0) {
          await Promise.all(states.map(loadStateData));
        }
        if (!cancelled) {
          setData(buildSnapshot());
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states?.join(',')]);

  return { data, loading, error, refresh, loadStateData, loadAllCandidates };
}
