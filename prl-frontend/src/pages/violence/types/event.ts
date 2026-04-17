export interface PoliticalViolenceEvent {
  rowid: number;
  year: number;
  month: number;
  day: number;
  state: string;
  city: string;
  latitude: number;
  longitude: number;
  summary: string;
  attack_type: string;
  target: string;
  motive: string;
  num_perps: number;
  total_killed: number;
  perps_killed: number;
  prl_meta: PrlMeta;
  sex: Sex;
  trans: number;
  race: string;
}

export type PrlMeta = 'Government Policy' | 'Politician/Party' | 'Unclear' | 'Institution';

export type Sex = 'Male' | 'Female' | 'Both' | '';

export interface FilterState {
  prl_meta: PrlMeta[];
  sex: Sex[];
  trans: boolean | null;
  race: string[];
  yearRange: [number, number];
  massCasualty: boolean | null;
  attackType: string[];
  target: string[];
}

export interface StateData {
  name: string;
  count: number;
  killed: number;
}

export interface TimelineDataPoint {
  date: string;
  count: number;
  killed: number;
}
