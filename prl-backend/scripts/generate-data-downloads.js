#!/usr/bin/env node
/**
 * Script to generate CSV download files from the API data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = process.env.DATA_API_URL;
if (!API_BASE) {
  console.error('Error: DATA_API_URL environment variable is required');
  process.exit(1);
}
const PUBLIC_DATA_DIR = path.join(__dirname, '../public/data');

// Ensure directories exist
const dirs = ['citizens', 'violence', 'international', 'elites'];
dirs.forEach(dir => {
  const dirPath = path.join(PUBLIC_DATA_DIR, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Helper to convert array of objects to CSV
function toCSV(data, columns) {
  if (!data || data.length === 0) return '';
  const headers = columns || Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(col => {
      let val = row[col];
      if (val === null || val === undefined) val = '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
        val = `"${val}"`;
      }
      return val;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

async function fetchJSON(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`);
  const json = await response.json();
  return json.data;
}

// Generate Citizens data files
async function generateCitizensData() {
  console.log('Fetching citizens data...');
  const data = await fetchJSON('/data/citizens/landing-full');

  // 1. Affective Polarization Time Series
  console.log('  Creating affective-polarization.csv...');
  const affpolData = [];
  if (data.affpol?.dem_therm_overtime && data.affpol?.rep_therm_overtime) {
    const dates = data.affpol.dem_therm_overtime.dates || [];
    for (let i = 0; i < dates.length; i++) {
      affpolData.push({
        date: dates[i],
        dem_rating_of_dems: data.affpol.dem_therm_overtime.dems[i] || '',
        dem_rating_of_reps: data.affpol.rep_therm_overtime.dems[i] || '',
        rep_rating_of_dems: data.affpol.dem_therm_overtime.reps[i] || '',
        rep_rating_of_reps: data.affpol.rep_therm_overtime.reps[i] || '',
      });
    }
  }
  fs.writeFileSync(
    path.join(PUBLIC_DATA_DIR, 'citizens/affective-polarization.csv'),
    toCSV(affpolData)
  );

  // 2. Violence Support Time Series
  console.log('  Creating violence-support.csv...');
  const violenceTypes = ['violence1', 'violence2', 'violence3', 'violence4', 'violence5', 'violence6'];
  const violenceLabels = {
    violence1: 'protesting_without_permit',
    violence2: 'vandalism',
    violence3: 'assault',
    violence4: 'arson',
    violence5: 'deadly_weapon',
    violence6: 'murder'
  };

  // Collect all dates
  const allViolenceDates = new Set();
  violenceTypes.forEach(type => {
    const typeData = data.violence?.support_by_party_over_time?.[type];
    if (typeData?.dates) {
      typeData.dates.forEach(d => allViolenceDates.add(d));
    }
  });
  const sortedViolenceDates = Array.from(allViolenceDates).sort();

  const violenceData = sortedViolenceDates.map(date => {
    const row = { date };
    violenceTypes.forEach(type => {
      const typeData = data.violence?.support_by_party_over_time?.[type];
      const label = violenceLabels[type];
      if (typeData?.dates) {
        const idx = typeData.dates.indexOf(date);
        row[`${label}_dem`] = idx >= 0 ? typeData.dems[idx] : '';
        row[`${label}_rep`] = idx >= 0 ? typeData.reps[idx] : '';
      } else {
        row[`${label}_dem`] = '';
        row[`${label}_rep`] = '';
      }
    });
    return row;
  });
  fs.writeFileSync(
    path.join(PUBLIC_DATA_DIR, 'citizens/violence-support.csv'),
    toCSV(violenceData)
  );

  // 3. Norms Support Time Series
  console.log('  Creating norms-support.csv...');
  const normTypes = ['norm_judges', 'norm_polling', 'norm_executive', 'norm_censorship', 'norm_loyalty'];
  const normLabels = {
    norm_judges: 'ignoring_courts',
    norm_polling: 'reducing_polling',
    norm_executive: 'executive_orders',
    norm_censorship: 'media_censorship',
    norm_loyalty: 'party_loyalty'
  };

  const allNormDates = new Set();
  normTypes.forEach(type => {
    const typeData = data.norms?.support_by_party_over_time?.[type];
    if (typeData?.dates) {
      typeData.dates.forEach(d => allNormDates.add(d));
    }
  });
  const sortedNormDates = Array.from(allNormDates).sort();

  const normsData = sortedNormDates.map(date => {
    const row = { date };
    normTypes.forEach(type => {
      const typeData = data.norms?.support_by_party_over_time?.[type];
      const label = normLabels[type];
      if (typeData?.dates) {
        const idx = typeData.dates.indexOf(date);
        row[`${label}_dem`] = idx >= 0 ? typeData.dems[idx] : '';
        row[`${label}_rep`] = idx >= 0 ? typeData.reps[idx] : '';
      } else {
        row[`${label}_dem`] = '';
        row[`${label}_rep`] = '';
      }
    });
    return row;
  });
  fs.writeFileSync(
    path.join(PUBLIC_DATA_DIR, 'citizens/norms-support.csv'),
    toCSV(normsData)
  );

  // 4. State-level data (combined file)
  console.log('  Creating state-data.csv...');
  const stateMap = {};

  // Affpol by state
  (data.affpol?.affpol_by_state || []).forEach(s => {
    if (!stateMap[s.name]) stateMap[s.name] = { state: s.name };
    stateMap[s.name].affective_polarization = s.value;
  });

  // Violence by state
  (data.violence?.violence_count_by_state || []).forEach(s => {
    if (!stateMap[s.name]) stateMap[s.name] = { state: s.name };
    stateMap[s.name].violence_support = s.value;
  });

  // Norms by state
  (data.norms?.norms_by_state || []).forEach(s => {
    if (!stateMap[s.name]) stateMap[s.name] = { state: s.name };
    stateMap[s.name].norms_support = s.value;
  });

  const stateData = Object.values(stateMap);
  fs.writeFileSync(
    path.join(PUBLIC_DATA_DIR, 'citizens/state-data.csv'),
    toCSV(stateData, ['state', 'affective_polarization', 'violence_support', 'norms_support'])
  );

  console.log('  Citizens data files created!');
}

// Generate International data files
async function generateInternationalData() {
  console.log('Fetching international data...');
  const data = await fetchJSON('/data/citizens/international');

  const countryNames = Object.keys(data.affpol || {});

  // Helper to parse time series
  function parseTimeSeries(arr) {
    if (!arr || !Array.isArray(arr)) return [];
    return arr.map(item => {
      const date = Object.keys(item)[0];
      return { date, value: item[date] };
    });
  }

  // 1. International Affective Polarization
  console.log('  Creating international affective-polarization.csv...');
  const allAffpolDates = new Set();
  const countryAffpol = {};
  countryNames.forEach(name => {
    const series = parseTimeSeries(data.affpol?.[name]?.affpol);
    countryAffpol[name] = {};
    series.forEach(p => {
      allAffpolDates.add(p.date);
      countryAffpol[name][p.date] = p.value;
    });
  });

  const sortedAffpolDates = Array.from(allAffpolDates).sort();
  const intlAffpolData = sortedAffpolDates.map(date => {
    const row = { date };
    countryNames.forEach(name => {
      row[name.replace(/\s+/g, '_')] = countryAffpol[name][date] ?? '';
    });
    return row;
  });
  fs.writeFileSync(
    path.join(PUBLIC_DATA_DIR, 'international/affective-polarization.csv'),
    toCSV(intlAffpolData)
  );

  // 2. International Violence Support
  console.log('  Creating international violence-support.csv...');
  const allViolDates = new Set();
  const countryViol = {};
  countryNames.forEach(name => {
    const series = parseTimeSeries(data.violence?.[name]?.num_violent_acts_supported);
    countryViol[name] = {};
    series.forEach(p => {
      allViolDates.add(p.date);
      countryViol[name][p.date] = p.value;
    });
  });

  const sortedViolDates = Array.from(allViolDates).sort();
  const intlViolData = sortedViolDates.map(date => {
    const row = { date };
    countryNames.forEach(name => {
      row[name.replace(/\s+/g, '_')] = countryViol[name][date] ?? '';
    });
    return row;
  });
  fs.writeFileSync(
    path.join(PUBLIC_DATA_DIR, 'international/violence-support.csv'),
    toCSV(intlViolData)
  );

  // 3. International Norms Support
  console.log('  Creating international norms-support.csv...');
  const allNormsDates = new Set();
  const countryNorms = {};
  countryNames.forEach(name => {
    const series = parseTimeSeries(data.norms?.[name]?.num_norm_violations_supported);
    countryNorms[name] = {};
    series.forEach(p => {
      allNormsDates.add(p.date);
      countryNorms[name][p.date] = p.value;
    });
  });

  const sortedNormsDates = Array.from(allNormsDates).sort();
  const intlNormsData = sortedNormsDates.map(date => {
    const row = { date };
    countryNames.forEach(name => {
      row[name.replace(/\s+/g, '_')] = countryNorms[name][date] ?? '';
    });
    return row;
  });
  fs.writeFileSync(
    path.join(PUBLIC_DATA_DIR, 'international/norms-support.csv'),
    toCSV(intlNormsData)
  );

  console.log('  International data files created!');
}

// Generate Violence Events CSV from local JSON
async function generateViolenceData() {
  console.log('Converting violence events JSON to CSV...');
  const eventsPath = path.join(__dirname, '../public/violence/events.json');
  const events = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));

  // Clean up data
  const cleanedEvents = events.map(e => ({
    id: e.rowid,
    date: `${e.year}-${String(e.month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`,
    year: e.year,
    month: e.month,
    day: e.day,
    state: e.state,
    city: e.city,
    latitude: e.latitude,
    longitude: e.longitude,
    attack_type: e.attack_type,
    target: e.target,
    motive: e.motive ? e.motive.replace(/\r/g, '').replace(/\n/g, ' ') : '',
    summary: e.summary ? e.summary.replace(/\r/g, '').replace(/\n/g, ' ') : '',
    num_perpetrators: e.num_perps,
    total_killed: e.total_killed,
    perpetrators_killed: e.perps_killed,
    category: e.prl_meta ? e.prl_meta.replace(/\r/g, '') : '',
    perpetrator_sex: e.sex ? e.sex.replace(/\r/g, '') : '',
    perpetrator_transgender: e.trans,
    perpetrator_race: e.race ? e.race.replace(/\r/g, '') : ''
  }));

  const columns = [
    'id', 'date', 'year', 'month', 'day', 'state', 'city',
    'latitude', 'longitude', 'attack_type', 'target', 'motive',
    'summary', 'num_perpetrators', 'total_killed', 'perpetrators_killed',
    'category', 'perpetrator_sex', 'perpetrator_transgender', 'perpetrator_race'
  ];

  fs.writeFileSync(
    path.join(PUBLIC_DATA_DIR, 'violence/events.csv'),
    toCSV(cleanedEvents, columns)
  );

  // Create state summary
  console.log('  Creating events-by-state.csv...');
  const stateSummary = {};
  cleanedEvents.forEach(e => {
    if (!stateSummary[e.state]) {
      stateSummary[e.state] = {
        state: e.state,
        total_events: 0,
        total_killed: 0,
        earliest_year: e.year,
        latest_year: e.year
      };
    }
    stateSummary[e.state].total_events++;
    stateSummary[e.state].total_killed += e.total_killed || 0;
    stateSummary[e.state].earliest_year = Math.min(stateSummary[e.state].earliest_year, e.year);
    stateSummary[e.state].latest_year = Math.max(stateSummary[e.state].latest_year, e.year);
  });

  const stateData = Object.values(stateSummary).sort((a, b) => b.total_events - a.total_events);
  fs.writeFileSync(
    path.join(PUBLIC_DATA_DIR, 'violence/events-by-state.csv'),
    toCSV(stateData, ['state', 'total_events', 'total_killed', 'earliest_year', 'latest_year'])
  );

  console.log('  Violence data files created!');
}

// Create placeholder README for elites data
async function createElitesPlaceholder() {
  console.log('Creating elites data placeholder...');

  const readme = `# Congressional Rhetoric Data

The full elites datasets are large files that need to be generated separately.

## Available Downloads

- profiles.zip - Aggregated legislator profiles (~5 MB)
- statements-2024.zip - Classified statements from 2024 (~50 MB)
- statements-2023.zip - Classified statements from 2023 (~45 MB)
- statements-2022.zip - Classified statements from 2022 (~40 MB)

## Data Dictionary

| Field | Type | Description |
|-------|------|-------------|
| source_id | string | Unique identifier for the legislator |
| date | date | Date of the statement |
| source_type | string | Source of statement (floor, newsletter, press, twitter) |
| text | string | The statement text |
| category | string | Classified rhetorical category |
| confidence | float | Model confidence score (0-1) |

For access to the full datasets, please contact the research team.
`;

  fs.writeFileSync(
    path.join(PUBLIC_DATA_DIR, 'elites/README.md'),
    readme
  );

  console.log('  Elites placeholder created!');
}

// Main execution
async function main() {
  console.log('Generating data download files...\n');

  try {
    await generateCitizensData();
    console.log('');
    await generateInternationalData();
    console.log('');
    await generateViolenceData();
    console.log('');
    await createElitesPlaceholder();
    console.log('\nAll data files generated successfully!');
  } catch (error) {
    console.error('Error generating data files:', error);
    process.exit(1);
  }
}

main();
