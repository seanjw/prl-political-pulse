export interface AwardConfig {
  category: string;
  type: 'top' | 'bottom' | 'zero_attacks';
  name: string;
  description: string;
  isPositive: boolean;
}

const AWARD_CONFIGS: AwardConfig[] = [
  // Top awards
  { category: 'policy', type: 'top', name: 'Policy Discussion Leader', description: 'Top 3% in policy discussion among all candidates', isPositive: true },
  { category: 'attack_policy', type: 'top', name: 'Policy Criticism Leader', description: 'Top 3% in policy criticism among all candidates', isPositive: true },
  { category: 'accomplishments', type: 'top', name: 'Accomplishments Leader', description: 'Top 3% in accomplishment claims among all candidates', isPositive: true },
  { category: 'bipartisanship', type: 'top', name: 'Bipartisanship Leader', description: 'Top 3% in bipartisan rhetoric among all candidates', isPositive: true },
  { category: 'attack_personal', type: 'top', name: 'Least Civil Candidate', description: 'Top 3% in personal attacks among all candidates', isPositive: false },
  // Bottom awards
  { category: 'policy', type: 'bottom', name: 'Least Policy-Focused', description: 'Bottom 3% in policy discussion among all candidates', isPositive: false },
  { category: 'attack_policy', type: 'bottom', name: 'Least Policy-Critical', description: 'Bottom 3% in policy criticism among all candidates', isPositive: false },
  { category: 'accomplishments', type: 'bottom', name: 'Fewest Accomplishment Claims', description: 'Bottom 3% in accomplishment claims among all candidates', isPositive: false },
  { category: 'bipartisanship', type: 'bottom', name: 'Least Bipartisan', description: 'Bottom 3% in bipartisan rhetoric among all candidates', isPositive: false },
  { category: 'attack_personal', type: 'bottom', name: 'Most Civil Candidate', description: 'Bottom 3% in personal attacks among all candidates', isPositive: true },
  // Special
  { category: 'attack_personal', type: 'zero_attacks', name: 'Zero Personal Attacks', description: 'Zero personal attacks with 50+ tracked statements', isPositive: true },
];

const configMap = new Map<string, AwardConfig>();
for (const config of AWARD_CONFIGS) {
  configMap.set(`${config.category}:${config.type}`, config);
}

export function getAwardConfig(category: string, type: string): AwardConfig | undefined {
  return configMap.get(`${category}:${type}`);
}

export { AWARD_CONFIGS };
