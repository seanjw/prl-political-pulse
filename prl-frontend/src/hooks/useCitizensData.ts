import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

export interface GaugeData {
  val: number;
  val_change: number;
}

export interface IntroGauges {
  norms: GaugeData;
  affpol: GaugeData;
  violence: GaugeData;
}

export interface IntroInfo {
  'to-year': string;
  'to-month': string;
  num_weeks: number;
  num_responses: string;
  num_responses_unique: string;
}

export interface StateData {
  name: string;
  value: number;
}

export interface PartyOverTimeData {
  dates: string[];
  dem: number[];
  rep: number[];
  ind?: number[];
}

export interface CitizensData {
  introGauges: IntroGauges | null;
  introInfo: IntroInfo | null;
  norms: {
    byState: StateData[];
    byStatePerType: { [key: string]: StateData[] };
    supportByParty: {
      dems: { [key: string]: number };
      reps: { [key: string]: number };
    } | null;
    supportByPartyOverTime: { [key: string]: PartyOverTimeData };
  };
  affpol: {
    byState: StateData[];
    overtime: { dates: string[]; values: number[] } | null;
    demThermOvertime: { dates: string[]; dems: number[]; reps: number[] } | null;
    repThermOvertime: { dates: string[]; dems: number[]; reps: number[] } | null;
  };
  violence: {
    supportByParty: {
      dems: { [key: string]: number };
      reps: { [key: string]: number };
    } | null;
    supportByPartyOverTime: { [key: string]: PartyOverTimeData };
    countByState: StateData[];
    countByStatePerType: { [key: string]: StateData[] };
  };
}

const defaultData: CitizensData = {
  introGauges: null,
  introInfo: null,
  norms: {
    byState: [],
    byStatePerType: {},
    supportByParty: null,
    supportByPartyOverTime: {},
  },
  affpol: {
    byState: [],
    overtime: null,
    demThermOvertime: null,
    repThermOvertime: null,
  },
  violence: {
    supportByParty: null,
    supportByPartyOverTime: {},
    countByState: [],
    countByStatePerType: {},
  },
};

export function useCitizensData() {
  const [data, setData] = useState<CitizensData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`${API_BASE}/data/citizens/landing-full`);
        const json = await response.json();
        const d = json.data;

        // Parse norm support by party over time for each norm type
        const normTypes = ['norm_judges', 'norm_loyalty', 'norm_polling', 'norm_executive', 'norm_censorship'];
        const normsSupportByPartyOverTime: { [key: string]: PartyOverTimeData } = {};
        for (const normType of normTypes) {
          if (d.norms?.support_by_party_over_time?.[normType]) {
            normsSupportByPartyOverTime[normType] = {
              dates: d.norms.support_by_party_over_time[normType].dates || [],
              dem: d.norms.support_by_party_over_time[normType].dems || [],
              rep: d.norms.support_by_party_over_time[normType].reps || [],
            };
          }
        }

        // Parse norm by state for each norm type
        const normsByStatePerType: { [key: string]: StateData[] } = {};
        for (const normType of normTypes) {
          const stateKey = `${normType}_by_state`;
          if (d.norms?.[stateKey]) {
            normsByStatePerType[normType] = d.norms[stateKey];
          }
        }

        // Parse violence by state for each violence type
        const violenceTypes = ['violence1', 'violence2', 'violence3', 'violence4', 'violence5', 'violence6'];
        const violenceByStatePerType: { [key: string]: StateData[] } = {};
        for (const violenceType of violenceTypes) {
          const stateKey = `${violenceType}_by_state`;
          if (d.violence?.[stateKey]) {
            violenceByStatePerType[violenceType] = d.violence[stateKey];
          }
        }

        // Parse violence support by party over time for each violence type
        const violenceSupportByPartyOverTime: { [key: string]: PartyOverTimeData } = {};
        for (const violenceType of violenceTypes) {
          if (d.violence?.support_by_party_over_time?.[violenceType]) {
            violenceSupportByPartyOverTime[violenceType] = {
              dates: d.violence.support_by_party_over_time[violenceType].dates || [],
              dem: d.violence.support_by_party_over_time[violenceType].dems || [],
              rep: d.violence.support_by_party_over_time[violenceType].reps || [],
            };
          }
        }

        // Parse the data into our structured format
        const parsed: CitizensData = {
          introGauges: d['intro-gauges'] || null,
          introInfo: d['intro-info'] || null,
          norms: {
            byState: d.norms?.norms_by_state || [],
            byStatePerType: normsByStatePerType,
            supportByParty: d.norms?.norm_violation_support_by_party ? {
              dems: d.norms.norm_violation_support_by_party.dems || {},
              reps: d.norms.norm_violation_support_by_party.reps || {},
            } : null,
            supportByPartyOverTime: normsSupportByPartyOverTime,
          },
          affpol: {
            byState: d.affpol?.affpol_by_state || [],
            overtime: d.affpol?.affpol_overtime ? {
              dates: d.affpol.affpol_overtime.dates || [],
              values: d.affpol.affpol_overtime.total || [],
            } : null,
            demThermOvertime: d.affpol?.dem_therm_overtime ? {
              dates: d.affpol.dem_therm_overtime.dates || [],
              dems: d.affpol.dem_therm_overtime.dems || [],
              reps: d.affpol.dem_therm_overtime.reps || [],
            } : null,
            repThermOvertime: d.affpol?.rep_therm_overtime ? {
              dates: d.affpol.rep_therm_overtime.dates || [],
              dems: d.affpol.rep_therm_overtime.dems || [],
              reps: d.affpol.rep_therm_overtime.reps || [],
            } : null,
          },
          violence: {
            supportByParty: d.violence?.support_by_party ? {
              dems: d.violence.support_by_party.dems || {},
              reps: d.violence.support_by_party.reps || {},
            } : null,
            supportByPartyOverTime: violenceSupportByPartyOverTime,
            countByState: d.violence?.violence_count_by_state || [],
            countByStatePerType: violenceByStatePerType,
          },
        };

        setData(parsed);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load citizens data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { data, loading, error };
}
