export interface EliteCategory {
  key: string;
  label: string;
  color: string;
  description: string;
}

export const ELITE_CATEGORIES: Record<string, EliteCategory> = {
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
  outcome_creditclaiming: {
    key: 'outcome_creditclaiming',
    label: 'Accomplishments',
    color: '#DB2777',
    description: 'Taking credit for legislation, funding, or other accomplishments',
  },
  outcome_bipartisanship: {
    key: 'outcome_bipartisanship',
    label: 'Bipartisanship',
    color: '#059669',
    description: 'Collaboration and finding common ground across party lines',
  },
};

export const CATEGORY_KEYS = Object.keys(ELITE_CATEGORIES);

export const CATEGORY_TABS = CATEGORY_KEYS.map((key) => ({
  key,
  label: ELITE_CATEGORIES[key].label,
  color: ELITE_CATEGORIES[key].color,
}));

// Map API field names to display labels for over_time data
export const OVERTIME_LABEL_MAP: Record<string, string> = {
  'Policy Discussion': 'policy',
  'Policy Criticism': 'attack_policy',
  'Personal Attacks': 'attack_personal',
  'Accomplishments': 'outcome_creditclaiming',
  'Bipartisanship': 'outcome_bipartisanship',
};

// US States for filtering
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'GU', name: 'Guam' },
  { code: 'VI', name: 'Virgin Islands' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'MP', name: 'Northern Mariana Islands' },
];

// Party colors
export const PARTY_COLORS = {
  Democrat: '#2563eb',
  Republican: '#dc2626',
  Independent: '#6b7280',
};
