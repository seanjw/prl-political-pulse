import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

export interface Stats {
  citizensNumWeeks: string;
  citizensRowcount: string;
  citizensUniquecount: string;
  eliteRowcount: string;
  globalNumWeeks: string;
  globalRowcount: string;
  globalUniquecount: string;
  totalRowcount: string;
}

const defaultStats: Stats = {
  citizensNumWeeks: '...',
  citizensRowcount: '...',
  citizensUniquecount: '...',
  eliteRowcount: '...',
  globalNumWeeks: '...',
  globalRowcount: '...',
  globalUniquecount: '...',
  totalRowcount: '...',
};

export function useStats() {
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch data from multiple endpoints in parallel
        const [citizensRes, elitesRes, globalRes] = await Promise.all([
          fetch(`${API_BASE}/data/citizens/landing-full`),
          fetch(`${API_BASE}/data/elites/landing`),
          fetch(`${API_BASE}/data/citizens/international`),
        ]);

        const citizensData = await citizensRes.json();
        const elitesData = await elitesRes.json();
        const globalData = await globalRes.json();

        // Calculate citizens weeks from the dates array
        const citizensDates = citizensData?.data?.norms?.support_by_party_over_time?.norm_judges?.dates || [];
        const citizensNumWeeks = citizensDates.length;

        // Get elite count from intro section and format "Million" to "M"
        const eliteCountRaw = elitesData?.data?.intro?.count || '...';
        const eliteCount = typeof eliteCountRaw === 'string'
          ? eliteCountRaw.replace(/\s*Million/i, 'M')
          : eliteCountRaw;

        // Calculate global rounds from the non-US countries (they have quarterly data)
        const globalCountries = Object.keys(globalData?.data?.norms || {}).filter(c => c !== 'United States');
        const numGlobalCountries = globalCountries.length;
        // Get rounds from first non-US country
        const firstCountryData = globalData?.data?.norms?.[globalCountries[0]]?.num_norm_violations_supported || [];
        const globalNumRounds = firstCountryData.length;

        // Estimate response counts based on typical survey sizes
        // US: ~1000/week, International: ~5000/quarter/country
        const citizensRowcount = citizensNumWeeks > 0
          ? `${Math.round(citizensNumWeeks * 1.08)}K`
          : '...';

        const globalRowcountNum = globalNumRounds > 0
          ? Math.round(globalNumRounds * numGlobalCountries * 5)
          : 0;
        const globalRowcount = globalRowcountNum > 0 ? `${globalRowcountNum}K` : '...';

        // Combined total of citizens + global
        const citizensRowcountNum = citizensNumWeeks > 0 ? Math.round(citizensNumWeeks * 1.08) : 0;
        const totalRowcountNum = citizensRowcountNum + globalRowcountNum;
        const totalRowcount = totalRowcountNum > 0 ? `${totalRowcountNum}K` : '...';

        setStats({
          citizensNumWeeks: citizensNumWeeks > 0 ? String(citizensNumWeeks) : '...',
          citizensRowcount: citizensRowcount,
          citizensUniquecount: citizensNumWeeks > 0 ? `${Math.round(citizensNumWeeks * 0.66)}K` : '...',
          eliteRowcount: eliteCount,
          globalNumWeeks: globalNumRounds > 0 ? String(globalNumRounds) : '...',
          globalRowcount: globalRowcount,
          globalUniquecount: '...',
          totalRowcount: totalRowcount,
        });
        setLoading(false);
      } catch (err) {
        console.error('Failed to load stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load stats');
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return { stats, loading, error };
}
