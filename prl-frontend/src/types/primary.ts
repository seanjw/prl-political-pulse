export interface PrimaryCandidateAward {
  category: string;
  type: 'top' | 'bottom' | 'zero_attacks';
  award_name: string;
}

export interface PrimaryAward extends PrimaryCandidateAward {
  candidate_id: string;
  name: string;
  party: 'Democrat' | 'Republican';
  state: string;
  office: 'H' | 'S';
  district: string;
  race_id: string;
  value: number;
  statement_count: number;
}

export interface PrimaryCandidate {
  candidate_id: string;
  name: string;
  party: 'Democrat' | 'Republican';
  state: string;
  district: string;
  office: 'H' | 'S';
  office_full?: string;
  race_id: string;
  bioguide_id?: string;
  image_url?: string;
  incumbent_challenge: 'I' | 'C' | 'O';
  twitter_handle: string | null;
  campaign_website: string | null;
  first_file_date: string;
  last_file_date?: string;
  has_raised_funds?: boolean;
  candidate_status?: string;
  primary_winner?: boolean;
  rhetoric: Record<string, number>;
  statement_count: number;
  rhetoric_data_available: boolean;
  // Tweet engagement
  follower_count?: number;
  first_tweet_date?: string;
  last_tweet_date?: string;
  avg_likes?: number;
  avg_retweets?: number;
  avg_impressions?: number;
  // Incumbent-only
  government_website?: string;
  gender?: string;
  birthday?: string;
  serving_since?: string;
  facebook?: string;
  awards?: PrimaryCandidateAward[];
  // FEC campaign finance
  finance?: {
    total_receipts: number;
    total_disbursements: number;
    cash_on_hand: number;
    debts_owed: number;
    individual_contributions: number;
    pac_contributions: number;
    party_contributions: number;
    candidate_contributions: number;
    candidate_loans: number;
    coverage_end_date?: string;
    total_receipts_rank: number;
    race_rank: number;
  };
}

export interface PrimaryRace {
  race_id: string;
  state: string;
  state_name: string;
  office: 'H' | 'S';
  district: string;
  display_name: string;
  candidates: { democrat: string[]; republican: string[] };
  candidate_count: number;
  race_called?: boolean;
}

export interface PrimaryStatement {
  id: string;
  candidate_id: string;
  date: string;
  source: 'twitter' | 'campaign_website' | 'press_release' | 'statements' | 'newsletters' | 'floor';
  categories: string[];
  text: string;
  tweet_id?: string;
}

export interface FeaturedRace {
  race_id: string;
  title: string;
  description: string;
}

export interface PrimaryFilters {
  state: string;
  chamber: string;
  party: string;
  incumbentStatus: string;
  search: string;
}
