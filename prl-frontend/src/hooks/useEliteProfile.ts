import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

const IMAGE_BASE = 'https://americaspoliticalpulse.com';

export interface CategoryBreakdown {
  policy: number;
  attack_policy: number;
  attack_personal: number;
  outcome_creditclaiming: number;
  outcome_bipartisanship: number;
}

export interface CategoryRanks {
  policy?: number;
  attack_policy?: number;
  attack_personal?: number;
  outcome_creditclaiming?: number;
  outcome_bipartisanship?: number;
}

export interface RecentPost {
  date: string;
  text: string;
  source: string;
  url?: string;
  policy?: number | null;
  attack_policy?: number | null;
  attack_personal?: number | null;
  outcome_creditclaiming?: number | null;
  outcome_bipartisanship?: number | null;
  policy_area?: string[];
}

// Communication scores by source
export interface CommunicationBySource {
  [source: string]: {
    'Policy Discussion'?: number;
    'Policy Criticism'?: number;
    'Personal Attacks'?: number;
    'Accomplishments'?: number;
    'Bipartisanship'?: number;
  };
}

// Ideology data
export interface IdeologyData {
  percentile: number;
  rank: number;
  rankMax: number;
  score: number;
}

// Effectiveness data
export interface BillProgressData {
  signed: number;
  introduced: number;
  passedHouse: number;
  passedSenate: number;
  toPresident: number;
  signedAvg: number;
  introducedAvg: number;
  passedHouseAvg: number;
  passedSenateAvg: number;
  toPresidentAvg: number;
}

export interface EffectivenessData {
  attendanceTotal: number;
  attendanceAvg: number;
  attendanceMax: number;
  attendanceRate: number;
  avgAttendanceRate: number;
  sponsored: BillProgressData;
  cosponsored: BillProgressData;
  topics: Record<string, number>;
}

// Campaign Finance data
export interface CampaignFinanceData {
  totalRaised: number;
  totalRaisedAvg: number;
  totalRaisedRank: number;
  totalDonors: number;
  totalDonorsAvg: number;
  totalDonorsRank: number;
  instateTotal: number;
  outstateTotal: number;
  instateCount: number;
  outstateCount: number;
  stateMap?: Record<string, number>;
}

export interface EliteProfileDetail {
  source_id: string;
  name: string;
  party: string;
  state: string;
  chamber: string;
  image_url?: string;
  bioguide_id?: string;
  birthday?: string;
  servingSince?: string;
  nextElection?: number;
  website?: string;
  twitter_id?: string;
  categories: CategoryBreakdown;
  ranks?: CategoryRanks;
  statement_count?: number;
  ideology_percentile?: number;
  posts?: RecentPost[];
  over_time?: {
    dates: string[];
    policy: number[];
    attack_policy: number[];
    attack_personal: number[];
    outcome_creditclaiming: number[];
    outcome_bipartisanship: number[];
  };
  // New data for tabs
  communicationBySource?: CommunicationBySource;
  ideology?: IdeologyData;
  effectiveness?: EffectivenessData;
  campaignFinance?: CampaignFinanceData;
}

interface UseEliteProfileResult {
  profile: EliteProfileDetail | null;
  loading: boolean;
  error: string | null;
}

export function useEliteProfile(sourceId: string | undefined): UseEliteProfileResult {
  const [profile, setProfile] = useState<EliteProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    async function fetchProfile() {
      try {
        setLoading(true);

        // Determine tables from ID prefix (N = national, S = state)
        const isNational = sourceId!.startsWith('N');
        const level = isNational ? 'National' : 'State';
        const profileTable = isNational ? 'federal_profiles' : 'state_profiles';

        // Make two requests in parallel: basic info + detailed scores
        const [basicResponse, scoresResponse] = await Promise.all([
          fetch(`${API_BASE}/query/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'legislators',
              filters: [
                { field: 'level', op: 'in', value: [level] },
                { field: 'source_id', op: 'eq', value: sourceId },
              ],
            }),
          }),
          fetch(`${API_BASE}/query/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: profileTable,
              filters: [
                { field: 'source_id', op: 'eq', value: sourceId },
              ],
            }),
          }),
        ]);

        if (!basicResponse.ok || !scoresResponse.ok) {
          throw new Error(`HTTP error!`);
        }

        const [basicJson, scoresJson] = await Promise.all([
          basicResponse.json(),
          scoresResponse.json(),
        ]);

        const basicData = basicJson.data?.[0];
        const scoresData = scoresJson.data?.[0];

        if (!basicData && !scoresData) {
          throw new Error('Legislator not found');
        }

        // Extract effectiveness data
        const efficacySponsored = scoresData?.efficacy_sponsored || {};
        const efficacyCosponsored = scoresData?.efficacy_cosponsored || {};
        const attendanceTotal = scoresData?.attendance_total || 0;
        const attendanceMax = scoresData?.attendance_max || 1;
        const attendanceAvg = scoresData?.attendance_avg || 0;

        // Combine data from both sources
        const profileData: EliteProfileDetail = {
          source_id: sourceId!,
          name: basicData?.name || '',
          party: scoresData?.communication_party || basicData?.party || '',
          state: basicData?.state || '',
          chamber: basicData?.type || scoresData?.type || '',
          // Use large image from scoresData (federal_profiles has the large version)
          image_url: scoresData?.image_url
            ? `${IMAGE_BASE}${scoresData.image_url}`
            : (basicData?.image_url ? `${IMAGE_BASE}${basicData.image_url}` : undefined),
          bioguide_id: scoresData?.bioguide_id,
          birthday: scoresData?.birthday,
          servingSince: scoresData?.serving_position_since,
          nextElection: scoresData?.next_election,
          website: scoresData?.government_website,
          twitter_id: scoresData?.twitter_id,
          categories: {
            policy: scoresData?.communication_policy_mean || 0,
            attack_policy: scoresData?.communication_attack_policy_mean || 0,
            attack_personal: scoresData?.communication_attack_personal_mean || 0,
            outcome_creditclaiming: scoresData?.communication_outcome_creditclaiming_mean || 0,
            outcome_bipartisanship: scoresData?.communication_outcome_bipartisanship_mean || 0,
          },
          ranks: {
            policy: scoresData?.communication_policy_rank,
            attack_policy: scoresData?.communication_attack_policy_rank,
            attack_personal: scoresData?.communication_attack_personal_rank,
            outcome_creditclaiming: scoresData?.communication_outcome_creditclaiming_rank,
            outcome_bipartisanship: scoresData?.communication_outcome_bipartisanship_rank,
          },
          statement_count: scoresData?.communication_count,
          ideology_percentile: scoresData?.ideology_percentile,
          posts: scoresData?.posts?.slice(0, 30) || [],
          over_time: scoresData?.over_time,

          // Communication by source
          communicationBySource: scoresData?.communication_scores_by_source,

          // Ideology data
          ideology: scoresData?.ideology_percentile !== undefined ? {
            percentile: scoresData.ideology_percentile,
            rank: scoresData.ideology_rank || 0,
            rankMax: scoresData.ideology_rank_max || 535,
            score: scoresData.ideology_ideology || 0,
          } : undefined,

          // Effectiveness data
          effectiveness: {
            attendanceTotal,
            attendanceAvg,
            attendanceMax,
            attendanceRate: attendanceMax > 0 ? (attendanceTotal / attendanceMax) * 100 : 0,
            avgAttendanceRate: attendanceMax > 0 ? (attendanceAvg / attendanceMax) * 100 : 0,
            sponsored: {
              signed: efficacySponsored.signed || 0,
              introduced: efficacySponsored.introduced || 0,
              passedHouse: efficacySponsored.passed_house || 0,
              passedSenate: efficacySponsored.passed_senate || 0,
              toPresident: efficacySponsored.to_president || 0,
              signedAvg: efficacySponsored['signed-avg'] || 0,
              introducedAvg: efficacySponsored['introduced-avg'] || 0,
              passedHouseAvg: efficacySponsored['passed_house-avg'] || 0,
              passedSenateAvg: efficacySponsored['passed_senate-avg'] || 0,
              toPresidentAvg: efficacySponsored['to_president-avg'] || 0,
            },
            cosponsored: {
              signed: efficacyCosponsored.signed || 0,
              introduced: efficacyCosponsored.introduced || 0,
              passedHouse: efficacyCosponsored.passed_house || 0,
              passedSenate: efficacyCosponsored.passed_senate || 0,
              toPresident: efficacyCosponsored.to_president || 0,
              signedAvg: efficacyCosponsored['signed-avg'] || 0,
              introducedAvg: efficacyCosponsored['introduced-avg'] || 0,
              passedHouseAvg: efficacyCosponsored['passed_house-avg'] || 0,
              passedSenateAvg: efficacyCosponsored['passed_senate-avg'] || 0,
              toPresidentAvg: efficacyCosponsored['to_president-avg'] || 0,
            },
            topics: scoresData?.efficacy_topics || {},
          },

          // Campaign Finance data
          campaignFinance: scoresData?.money_total_money !== undefined ? {
            totalRaised: scoresData.money_total_money || 0,
            totalRaisedAvg: scoresData.money_total_money_avg || 0,
            totalRaisedRank: scoresData.money_total_money_rank || 0,
            totalDonors: scoresData.money_total_ind_don || 0,
            totalDonorsAvg: scoresData.money_total_ind_don_avg || 0,
            totalDonorsRank: scoresData.money_total_ind_don_rank || 0,
            instateTotal: scoresData.money_instate_total || 0,
            outstateTotal: scoresData.money_outstate_total || 0,
            instateCount: scoresData.money_instate_count || 0,
            outstateCount: scoresData.money_outstate_count || 0,
            stateMap: scoresData.money_state_map,
          } : undefined,
        };

        setProfile(profileData);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
        setLoading(false);
      }
    }

    fetchProfile();
  }, [sourceId]);

  return { profile, loading, error };
}
