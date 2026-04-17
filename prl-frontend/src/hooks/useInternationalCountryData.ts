import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

export interface QuestionTimeSeries {
  dates: string[];
  values: number[];
}

export interface PartyTimeSeries {
  dates: string[];
  [partyName: string]: (number | null)[] | string[];
}

export interface PartyOverallData {
  parties: string[];
  values: number[];
  counts: number[];
}

export interface CountryQuestionData {
  country: string;
  violence: Record<string, QuestionTimeSeries>;
  norms: Record<string, QuestionTimeSeries>;
  violenceByParty: Record<string, PartyTimeSeries>;
  normsByParty: Record<string, PartyTimeSeries>;
  violenceOverallByParty: Record<string, PartyOverallData>;
  normsOverallByParty: Record<string, PartyOverallData>;
  parties: string[];
  partyColors: Record<string, string>;
}

interface ApiResponse {
  data: {
    country: string;
    violence: Record<string, Array<{ [date: string]: number }>>;
    norms: Record<string, Array<{ [date: string]: number }>>;
    violence_by_party: Record<string, PartyTimeSeries>;
    norms_by_party: Record<string, PartyTimeSeries>;
    violence_overall_by_party: Record<string, PartyOverallData>;
    norms_overall_by_party: Record<string, PartyOverallData>;
    parties: string[];
    party_colors: Record<string, string>;
  };
}

// Helper to parse the date-value array format from API: [{date: value}, {date: value}, ...]
function parseTimeSeriesArray(arr: Array<{ [date: string]: number }> | undefined): QuestionTimeSeries {
  if (!arr || !Array.isArray(arr)) return { dates: [], values: [] };

  const dates: string[] = [];
  const values: number[] = [];

  arr.forEach(item => {
    const date = Object.keys(item)[0];
    const value = item[date];
    dates.push(date);
    values.push(value);
  });

  return { dates, values };
}

// Transform API response to our data structure
function transformApiResponse(apiData: ApiResponse['data']): CountryQuestionData {
  const violence: Record<string, QuestionTimeSeries> = {};
  const norms: Record<string, QuestionTimeSeries> = {};

  if (apiData.violence) {
    Object.entries(apiData.violence).forEach(([key, arr]) => {
      violence[key] = parseTimeSeriesArray(arr);
    });
  }

  if (apiData.norms) {
    Object.entries(apiData.norms).forEach(([key, arr]) => {
      norms[key] = parseTimeSeriesArray(arr);
    });
  }

  return {
    country: apiData.country,
    violence,
    norms,
    violenceByParty: apiData.violence_by_party || {},
    normsByParty: apiData.norms_by_party || {},
    violenceOverallByParty: apiData.violence_overall_by_party || {},
    normsOverallByParty: apiData.norms_overall_by_party || {},
    parties: apiData.parties || [],
    partyColors: apiData.party_colors || {},
  };
}

const defaultData: CountryQuestionData = {
  country: '',
  violence: {},
  norms: {},
  violenceByParty: {},
  normsByParty: {},
  violenceOverallByParty: {},
  normsOverallByParty: {},
  parties: [],
  partyColors: {},
};

export function useInternationalCountryData(countryCode: string | null) {
  const [data, setData] = useState<CountryQuestionData>(defaultData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notAvailable, setNotAvailable] = useState(false);

  useEffect(() => {
    if (!countryCode) {
      setData(defaultData);
      setLoading(false);
      setError(null);
      return;
    }

    const code = countryCode; // Capture for use in async function

    async function fetchData() {
      setLoading(true);
      setError(null);
      setNotAvailable(false);

      try {
        const response = await fetch(`${API_BASE}/data/citizens/international/${code.toLowerCase()}/questions`);

        if (response.status === 404) {
          // Endpoint doesn't exist yet - this is expected during development
          setNotAvailable(true);
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const json: ApiResponse = await response.json();
        const transformed = transformApiResponse(json.data);
        setData(transformed);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load country question data:', err);
        // Don't set error for network issues - just mark as not available
        // This allows the UI to show a "data coming soon" message instead of an error
        setNotAvailable(true);
        setLoading(false);
      }
    }

    fetchData();
  }, [countryCode]);

  return { data, loading, error, notAvailable };
}

// Helper to check if we have data for a specific question
export function hasQuestionData(data: CountryQuestionData, questionKey: string, type: 'violence' | 'norms'): boolean {
  const series = type === 'violence' ? data.violence[questionKey] : data.norms[questionKey];
  return series && series.dates.length > 0;
}

// Helper to get the latest value for a question
export function getLatestQuestionValue(data: CountryQuestionData, questionKey: string, type: 'violence' | 'norms'): number | null {
  const series = type === 'violence' ? data.violence[questionKey] : data.norms[questionKey];
  if (!series || series.values.length === 0) return null;
  return series.values[series.values.length - 1];
}
