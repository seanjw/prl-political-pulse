export interface PrimaryCategory {
  key: string;
  label: string;
  color: string;
  description: string;
}

export const PRIMARY_CATEGORIES: Record<string, PrimaryCategory> = {
  policy: {
    key: 'policy',
    label: 'Policy Discussion',
    color: '#4B5563',
    description: 'Discussion of political issues without attacking opponents',
  },
  attack_policy: {
    key: 'attack_policy',
    label: 'Policy Criticism',
    color: '#2563EB',
    description: 'Being critical of a policy or political position',
  },
  attack_personal: {
    key: 'attack_personal',
    label: 'Personal Attacks',
    color: '#EA580C',
    description: 'Attacking or disrespecting a person or party',
  },
  accomplishments: {
    key: 'accomplishments',
    label: 'Accomplishments',
    color: '#DB2777',
    description: 'Taking credit for legislation, funding, or other accomplishments',
  },
  bipartisanship: {
    key: 'bipartisanship',
    label: 'Bipartisanship',
    color: '#059669',
    description: 'Collaboration and finding common ground across party lines',
  },
};

export const PRIMARY_CATEGORY_KEYS = Object.keys(PRIMARY_CATEGORIES);

// Minimum number of tracked statements required for a candidate to appear in
// rankings (leaderboards, race category leaders). Matches the AWARDS_MIN_STATEMENTS
// threshold used on the backend for award eligibility.
export const MIN_STATEMENTS_TO_RANK = 50;

export const PRIMARY_CATEGORY_TABS = PRIMARY_CATEGORY_KEYS.map((key) => ({
  key,
  label: PRIMARY_CATEGORIES[key].label,
  color: PRIMARY_CATEGORIES[key].color,
}));
