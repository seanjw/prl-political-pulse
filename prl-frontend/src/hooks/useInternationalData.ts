import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

export interface CountryTimeSeriesPoint {
  date: string;
  value: number;
}

export interface CountryData {
  name: string;
  affpol: CountryTimeSeriesPoint[];
  inpartyRating: CountryTimeSeriesPoint[];
  outpartyRating: CountryTimeSeriesPoint[];
  violenceSupport: CountryTimeSeriesPoint[];
  normsSupport: CountryTimeSeriesPoint[];
}

export interface InternationalData {
  countries: CountryData[];
}

const defaultData: InternationalData = {
  countries: [],
};

// Helper to parse the date-value array format from API: [{date: value}, {date: value}, ...]
function parseTimeSeriesArray(arr: Array<{ [date: string]: number }> | undefined): CountryTimeSeriesPoint[] {
  if (!arr || !Array.isArray(arr)) return [];
  return arr.map(item => {
    const date = Object.keys(item)[0];
    const value = item[date];
    return { date, value };
  });
}

export function useInternationalData() {
  const [data, setData] = useState<InternationalData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`${API_BASE}/data/citizens/international`);
        const json = await response.json();
        const d = json.data;

        // Get all country names from affpol (they should be the same across all metrics)
        const countryNames = Object.keys(d.affpol || {});

        const countries: CountryData[] = countryNames.map(name => ({
          name,
          affpol: parseTimeSeriesArray(d.affpol?.[name]?.affpol),
          inpartyRating: parseTimeSeriesArray(d.affpol?.[name]?.inparty_rating),
          outpartyRating: parseTimeSeriesArray(d.affpol?.[name]?.outparty_rating),
          violenceSupport: parseTimeSeriesArray(d.violence?.[name]?.num_violent_acts_supported),
          normsSupport: parseTimeSeriesArray(d.norms?.[name]?.num_norm_violations_supported),
        }));

        setData({ countries });
        setLoading(false);
      } catch (err) {
        console.error('Failed to load international data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error };
}

// Country colors for consistent styling
export const COUNTRY_COLORS: { [key: string]: string } = {
  'Brazil': '#009c3b',
  'Germany': '#dd0000',
  'India': '#ff9933',
  'Israel': '#0038b8',
  'Poland': '#dc143c',
  'United States': 'rgba(0,0,0,0.3)',
};

// Helper to get latest value from time series
export function getLatestValue(series: CountryTimeSeriesPoint[]): number | null {
  if (!series || series.length === 0) return null;
  return series[series.length - 1].value;
}
