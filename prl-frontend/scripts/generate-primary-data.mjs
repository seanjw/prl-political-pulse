/**
 * Generate primary election data from CSV.
 * Usage: node scripts/generate-primary-data.mjs
 *
 * Reads the CSV of ~3,010 candidates, filters to active+funded,
 * generates simulated rhetoric scores, and outputs JSON files.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CSV_PATH = resolve(ROOT, 'primary_candidates_2026 - primary_candidates_2026.csv');
const OUT_DIR = resolve(__dirname, '../public/data/primary');

mkdirSync(OUT_DIR, { recursive: true });

// --- Seeded PRNG (mulberry32) ---
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// --- CSV Parser ---
function parseCSV(text) {
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// --- State name lookup ---
const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', PR: 'Puerto Rico', GU: 'Guam', VI: 'Virgin Islands',
  AS: 'American Samoa', MP: 'Northern Mariana Islands',
};

const CATEGORY_KEYS = [
  'policy', 'attack_policy', 'attack_personal', 'accomplishments', 'bipartisanship',
  'opponent_attacks', 'party_loyalty', 'issue_positions', 'endorsements',
];

// --- Generate rhetoric scores ---
function generateRhetoric(candidateId, party, incumbentChallenge, hasTwitter) {
  const rng = mulberry32(hashString(candidateId));

  // Base weights by party
  const weights = {};
  if (party === 'Democrat') {
    weights.policy = 0.18; weights.attack_policy = 0.10; weights.attack_personal = 0.06;
    weights.accomplishments = 0.08; weights.bipartisanship = 0.14;
    weights.opponent_attacks = 0.08; weights.party_loyalty = 0.08;
    weights.issue_positions = 0.18; weights.endorsements = 0.10;
  } else {
    weights.policy = 0.12; weights.attack_policy = 0.12; weights.attack_personal = 0.08;
    weights.accomplishments = 0.12; weights.bipartisanship = 0.06;
    weights.opponent_attacks = 0.10; weights.party_loyalty = 0.14;
    weights.issue_positions = 0.14; weights.endorsements = 0.12;
  }

  // Adjust for incumbent status
  if (incumbentChallenge === 'I') {
    weights.accomplishments += 0.06;
    weights.policy += 0.04;
    weights.opponent_attacks -= 0.04;
    weights.attack_personal -= 0.03;
  } else if (incumbentChallenge === 'C') {
    weights.opponent_attacks += 0.04;
    weights.attack_personal += 0.02;
    weights.party_loyalty += 0.02;
    weights.accomplishments -= 0.04;
  } else {
    // Open seat
    weights.opponent_attacks += 0.02;
    weights.party_loyalty += 0.03;
    weights.issue_positions += 0.02;
  }

  // Add noise
  for (const key of CATEGORY_KEYS) {
    weights[key] = Math.max(0.01, weights[key] + (rng() - 0.5) * 0.08);
  }

  // Normalize to sum ≈ 1.0
  const total = CATEGORY_KEYS.reduce((sum, k) => sum + weights[k], 0);
  const rhetoric = {};
  for (const key of CATEGORY_KEYS) {
    rhetoric[key] = Math.round((weights[key] / total) * 1000) / 1000;
  }

  // Zero social-media-heavy categories if no twitter
  if (!hasTwitter) {
    rhetoric.opponent_attacks = Math.round(rhetoric.opponent_attacks * 0.3 * 1000) / 1000;
    rhetoric.attack_personal = Math.round(rhetoric.attack_personal * 0.3 * 1000) / 1000;
  }

  return rhetoric;
}

// --- Generate statements ---
function generateStatements(candidateId, hasTwitter, rhetoric) {
  const rng = mulberry32(hashString(candidateId + '_statements'));
  const count = hasTwitter ? Math.floor(rng() * 11) + 5 : Math.floor(rng() * 4) + 2;
  const statements = [];

  const sources = hasTwitter
    ? ['twitter', 'twitter', 'twitter', 'campaign_website', 'press_release']
    : ['campaign_website', 'press_release'];

  const templates = {
    policy: [
      'We need comprehensive reform to address the challenges facing working families.',
      'My plan focuses on economic growth, job creation, and fiscal responsibility.',
      'Healthcare access remains one of the most critical issues for our district.',
    ],
    attack_policy: [
      'The current approach to this issue is fundamentally flawed and must change.',
      'We cannot continue with failed policies that hurt ordinary Americans.',
      'This legislation would be devastating for small businesses across our state.',
    ],
    attack_personal: [
      'My opponent has consistently failed to show up for the people of this district.',
      'The incumbent has lost touch with the values of our community.',
      'Career politicians have no interest in real reform.',
    ],
    accomplishments: [
      'Proud to have secured funding for infrastructure improvements in our community.',
      'Our office has helped thousands of constituents navigate federal programs.',
      'Working across the aisle, we passed legislation to support our veterans.',
    ],
    bipartisanship: [
      'I believe we can find common ground on the issues that matter most.',
      'Partisan gridlock is the enemy of progress. We need leaders who can build bridges.',
      'Both parties need to come together for the good of the country.',
    ],
    opponent_attacks: [
      'My primary opponent refuses to debate the real issues.',
      'Unlike others in this race, I have a concrete plan to deliver results.',
      'Some candidates talk. I have the record to back up my promises.',
    ],
    party_loyalty: [
      'I am committed to advancing our party\'s platform and values.',
      'We must stand united to achieve our shared goals this election.',
      'Our party represents the best path forward for this country.',
    ],
    issue_positions: [
      'I support strengthening border security while maintaining humanitarian values.',
      'Climate action is an economic opportunity, not just an obligation.',
      'Education funding must be a top priority for the next Congress.',
    ],
    endorsements: [
      'Honored to receive the endorsement of community leaders across the district.',
      'Grateful for the support of labor unions who fight for working families.',
      'Leading organizations recognize our campaign\'s commitment to real change.',
    ],
  };

  for (let i = 0; i < count; i++) {
    // Pick a category weighted by rhetoric scores
    const r = rng();
    let cumulative = 0;
    let category = CATEGORY_KEYS[0];
    for (const key of CATEGORY_KEYS) {
      cumulative += rhetoric[key] || 0;
      if (r < cumulative) {
        category = key;
        break;
      }
    }

    const categoryTemplates = templates[category];
    const text = categoryTemplates[Math.floor(rng() * categoryTemplates.length)];
    const source = sources[Math.floor(rng() * sources.length)];

    // Random date in past 6 months
    const daysAgo = Math.floor(rng() * 180);
    const date = new Date(2026, 1, 27); // Feb 27, 2026
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().split('T')[0];

    statements.push({
      id: `${candidateId}_stmt_${i}`,
      candidate_id: candidateId,
      date: dateStr,
      source,
      categories: [category],
      text,
    });
  }

  // Sort by date descending
  statements.sort((a, b) => b.date.localeCompare(a.date));
  return statements;
}

// --- District display name ---
function districtDisplayName(state, office, district) {
  const stateName = STATE_NAMES[state] || state;
  if (office === 'S') {
    return `${stateName} Senate`;
  }
  if (!district || district === '00') {
    return `${stateName} At-Large`;
  }
  // Ordinal suffix
  const num = parseInt(district, 10);
  const suffix = num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th';
  return `${stateName} ${num}${suffix} District`;
}

function raceId(state, office, district) {
  if (office === 'S') return `${state}-S`;
  return `${state}-${district || '00'}`;
}

// --- Main ---
console.log('Reading CSV...');
const csvText = readFileSync(CSV_PATH, 'utf-8');
const rows = parseCSV(csvText);
console.log(`Parsed ${rows.length} rows`);

// Filter: active + (has raised funds OR is incumbent)
const activeRows = rows.filter((r) => {
  const inactive = r.candidate_inactive === 'TRUE';
  if (inactive) return false;
  const hasFunds = r.has_raised_funds === 'TRUE';
  const isIncumbent = r.incumbent_challenge === 'I';
  const isDemOrRep = r.party === 'Democrat' || r.party === 'Republican';
  return isDemOrRep && (hasFunds || isIncumbent);
});

console.log(`Active + funded candidates: ${activeRows.length}`);

// Build candidates
const candidates = [];
const allStatements = {};
const raceMap = {};

for (const row of activeRows) {
  const id = row.candidate_id;
  const state = row.state;
  const office = row.office === 'S' ? 'S' : 'H';
  const district = office === 'H' ? (row.district || '00') : '';
  const rid = raceId(state, office, district);
  const hasTwitter = !!row.twitter_handle && row.twitter_handle !== '';
  const party = row.party;

  // Clean twitter handle - take first one if comma-separated
  let twitterHandle = row.twitter_handle || null;
  if (twitterHandle) {
    twitterHandle = twitterHandle.split(',')[0].trim();
    if (twitterHandle.startsWith('@')) twitterHandle = twitterHandle.slice(1);
  }

  const rhetoric = generateRhetoric(id, party, row.incumbent_challenge, hasTwitter);
  const stmts = generateStatements(id, hasTwitter, rhetoric);

  const candidate = {
    candidate_id: id,
    name: row.name,
    party,
    state,
    district,
    office,
    race_id: rid,
    incumbent_challenge: row.incumbent_challenge || 'O',
    twitter_handle: twitterHandle,
    campaign_website: row.campaign_website || null,
    first_file_date: row.first_file_date || '',
    rhetoric,
    statement_count: stmts.length,
    rhetoric_data_available: hasTwitter,
  };

  candidates.push(candidate);
  allStatements[id] = stmts;

  // Build race entry
  if (!raceMap[rid]) {
    raceMap[rid] = {
      race_id: rid,
      state,
      state_name: STATE_NAMES[state] || state,
      office,
      district,
      display_name: districtDisplayName(state, office, district),
      candidates: { democrat: [], republican: [] },
      candidate_count: 0,
    };
  }
  if (party === 'Democrat') {
    raceMap[rid].candidates.democrat.push(id);
  } else {
    raceMap[rid].candidates.republican.push(id);
  }
  raceMap[rid].candidate_count++;
}

const races = Object.values(raceMap);

// Featured races — pick competitive ones with many candidates
const competitiveRaces = races
  .filter((r) => r.candidates.democrat.length >= 1 && r.candidates.republican.length >= 1)
  .sort((a, b) => b.candidate_count - a.candidate_count);

const featured = [
  ...(competitiveRaces.find((r) => r.race_id === 'GA-S') ? [{
    race_id: 'GA-S',
    title: 'Georgia Senate',
    description: 'A competitive open Senate race in a key battleground state.',
  }] : []),
  ...(competitiveRaces.find((r) => r.race_id === 'TX-S') ? [{
    race_id: 'TX-S',
    title: 'Texas Senate',
    description: 'One of the most closely watched Senate races of 2026.',
  }] : []),
  ...(competitiveRaces.find((r) => r.race_id === 'MI-S') ? [{
    race_id: 'MI-S',
    title: 'Michigan Senate',
    description: 'A key pickup opportunity in the Midwest.',
  }] : []),
  ...(competitiveRaces.find((r) => r.race_id === 'NC-S') ? [{
    race_id: 'NC-S',
    title: 'North Carolina Senate',
    description: 'An important Senate contest in a swing state.',
  }] : []),
];

// If we don't have enough from the hardcoded list, pick top competitive races
while (featured.length < 6 && competitiveRaces.length > featured.length) {
  const race = competitiveRaces.find(
    (r) => !featured.some((f) => f.race_id === r.race_id)
  );
  if (!race) break;
  featured.push({
    race_id: race.race_id,
    title: race.display_name,
    description: `A competitive ${race.office === 'S' ? 'Senate' : 'House'} race with ${race.candidate_count} candidates.`,
  });
}

// Stats
const demCount = candidates.filter((c) => c.party === 'Democrat').length;
const repCount = candidates.filter((c) => c.party === 'Republican').length;
const withTwitter = candidates.filter((c) => c.twitter_handle).length;
const states = new Set(candidates.map((c) => c.state));

console.log(`\nStats:`);
console.log(`  Total candidates: ${candidates.length}`);
console.log(`  Democrats: ${demCount}, Republicans: ${repCount}`);
console.log(`  With Twitter: ${withTwitter}`);
console.log(`  Unique races: ${races.length}`);
console.log(`  States/territories: ${states.size}`);
console.log(`  Featured races: ${featured.length}`);

// Write output
writeFileSync(resolve(OUT_DIR, 'candidates.json'), JSON.stringify(candidates));
writeFileSync(resolve(OUT_DIR, 'races.json'), JSON.stringify(races));
writeFileSync(resolve(OUT_DIR, 'featured.json'), JSON.stringify(featured));
writeFileSync(resolve(OUT_DIR, 'statements.json'), JSON.stringify(allStatements));

console.log(`\nWrote files to ${OUT_DIR}`);
console.log('Done!');
