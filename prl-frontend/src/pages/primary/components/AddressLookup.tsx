import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { US_STATES } from '../../../config/elitesCategories';
import type { PrimaryRace } from '../../../types/primary';

interface AddressLookupProps {
  races: PrimaryRace[];
}

interface LookupResult {
  state: string;
  stateName: string;
  district: string | null;
  senateRaces: PrimaryRace[];
  houseRace: PrimaryRace | null;
}

const isDev = import.meta.env.DEV;
const CENSUS_GEOCODER_URL = isDev
  ? '/geocoder/geographies/onelineaddress'
  : 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';

export function AddressLookup({ races }: AddressLookupProps) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualState, setManualState] = useState('');
  const [manualDistrict, setManualDistrict] = useState('');
  const [mode, setMode] = useState<'address' | 'manual'>('address');

  const districtsByState = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const race of races) {
      if (race.office === 'H') {
        if (!(race.state in map)) map[race.state] = [];
        map[race.state].push(race.district);
      }
    }
    for (const state in map) {
      map[state].sort((a, b) => Number(a) - Number(b));
    }
    return map;
  }, [races]);

  const statesWithRaces = useMemo(() => {
    const stateCodes = new Set(races.map((r) => r.state));
    return US_STATES.filter((s) => stateCodes.has(s.code));
  }, [races]);

  const findRaces = useCallback(
    (stateCode: string, districtNum: string | null): LookupResult | null => {
      const stateInfo = US_STATES.find((s) => s.code === stateCode);
      if (!stateInfo) return null;
      const senateRaces = races.filter((r) => r.state === stateCode && r.office === 'S');
      const houseRace = districtNum
        ? races.find((r) => r.state === stateCode && r.office === 'H' && r.district === districtNum) || null
        : null;
      return { state: stateCode, stateName: stateInfo.name, district: districtNum, senateRaces, houseRace };
    },
    [races]
  );

  const handleAddressLookup = useCallback(async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({
        address: address.trim(),
        benchmark: 'Public_AR_Current',
        vintage: 'Current_Current',
        format: 'json',
      });
      const response = await fetch(`${CENSUS_GEOCODER_URL}?${params}`);
      if (!response.ok) throw new Error('Lookup failed');
      const data = await response.json();
      const matches = data?.result?.addressMatches;
      if (!matches || matches.length === 0) {
        setError('Address not found. Try the manual selector.');
        setLoading(false);
        return;
      }
      const match = matches[0];
      const geos = match.geographies;
      const stateGeo = geos?.['States']?.[0];
      const cdGeo = geos?.['Congressional Districts']?.[0];
      if (!stateGeo?.STUSAB) {
        setError('Could not determine state.');
        setLoading(false);
        return;
      }
      const stateCode = stateGeo.STUSAB;
      let districtNum: string | null = null;
      if (cdGeo?.CD) {
        const rawCd = cdGeo.CD;
        districtNum = rawCd === '98' || rawCd === '00' ? '0' : String(parseInt(rawCd, 10));
      }
      const found = findRaces(stateCode, districtNum);
      if (found) {
        setResult(found);
        setManualState(stateCode);
        setManualDistrict(districtNum || '');
      } else {
        setError(`No primary races found for ${stateCode}.`);
      }
    } catch {
      setError('Lookup unavailable. Use the manual selector.');
    }
    setLoading(false);
  }, [address, findRaces]);

  const handleManualLookup = useCallback(() => {
    if (!manualState) return;
    setError(null);
    const found = findRaces(manualState, manualDistrict || null);
    if (found) setResult(found);
  }, [manualState, manualDistrict, findRaces]);

  const handleManualStateChange = (code: string) => {
    setManualState(code);
    setManualDistrict('');
    setResult(null);
    setError(null);
  };

  const manualDistricts = manualState ? districtsByState[manualState] || [] : [];

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    outline: 'none',
    fontFamily: "'Source Sans 3', sans-serif",
    fontSize: '0.8125rem',
    height: '2rem',
  };

  return (
    <div>
      {/* Compact inline lookup bar */}
      <div
        className="rounded-lg px-3 py-2.5 flex flex-wrap items-center gap-2"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        {/* Icon + label */}
        <div className="flex items-center gap-1.5 shrink-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Find your races
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-4 hidden sm:block" style={{ background: 'var(--border)' }} />

        {/* Mode toggle */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setMode('address')}
            className="px-2 py-0.5 text-[11px] font-semibold rounded transition-colors"
            style={{
              background: mode === 'address' ? 'var(--bg-tertiary)' : 'transparent',
              color: mode === 'address' ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            Address
          </button>
          <button
            onClick={() => setMode('manual')}
            className="px-2 py-0.5 text-[11px] font-semibold rounded transition-colors"
            style={{
              background: mode === 'manual' ? 'var(--bg-tertiary)' : 'transparent',
              color: mode === 'manual' ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            State / District
          </button>
        </div>

        {/* Separator */}
        <div className="w-px h-4 hidden sm:block" style={{ background: 'var(--border)' }} />

        {/* Inputs */}
        {mode === 'address' ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddressLookup(); }}
              placeholder="123 Main St, Springfield, IL"
              className="flex-1 px-2 rounded"
              style={inputStyle}
            />
            <button
              onClick={handleAddressLookup}
              disabled={loading || !address.trim()}
              className="px-3 rounded text-xs font-bold shrink-0"
              style={{
                height: '2rem',
                background: loading ? 'var(--text-muted)' : 'var(--text-primary)',
                color: 'var(--bg-primary)',
                border: 'none',
                cursor: loading ? 'wait' : 'pointer',
                opacity: !address.trim() ? 0.4 : 1,
                letterSpacing: '0.02em',
              }}
            >
              {loading ? '...' : 'Look up'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <select
              value={manualState}
              onChange={(e) => handleManualStateChange(e.target.value)}
              className="px-2 rounded flex-1 min-w-[120px]"
              style={inputStyle}
            >
              <option value="">State...</option>
              {statesWithRaces.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
            <select
              value={manualDistrict}
              onChange={(e) => setManualDistrict(e.target.value)}
              disabled={!manualState}
              className="px-2 rounded min-w-[110px]"
              style={{ ...inputStyle, opacity: !manualState ? 0.4 : 1 }}
            >
              <option value="">
                {manualDistricts.length === 1 && manualDistricts[0] === '0' ? 'At-Large' : 'District...'}
              </option>
              {manualDistricts.map((d) => (
                <option key={d} value={d}>{d === '0' ? 'At-Large' : `District ${d}`}</option>
              ))}
            </select>
            <button
              onClick={handleManualLookup}
              disabled={!manualState}
              className="px-3 rounded text-xs font-bold shrink-0"
              style={{
                height: '2rem',
                background: !manualState ? 'var(--text-muted)' : 'var(--text-primary)',
                color: 'var(--bg-primary)',
                border: 'none',
                cursor: !manualState ? 'default' : 'pointer',
                opacity: !manualState ? 0.4 : 1,
                letterSpacing: '0.02em',
              }}
            >
              Find
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 px-3 py-1.5 text-xs rounded" style={{ background: 'rgba(220, 38, 38, 0.06)', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* Results — compact inline cards */}
      {result && (
        <div
          className="mt-2 rounded-lg px-3 py-2 flex flex-wrap items-center gap-3"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#059669' }} />
            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
              {result.stateName}
              {result.district && result.district !== '0' ? `-${result.district}` : result.district === '0' ? ' (At-Large)' : ''}
            </span>
          </div>
          <div className="w-px h-4" style={{ background: 'var(--border)' }} />
          <div className="flex items-center gap-2 flex-wrap">
            {result.senateRaces.map((race) => (
              <RaceChip key={race.race_id} race={race} type="Senate" />
            ))}
            {result.houseRace && <RaceChip race={result.houseRace} type="House" />}
            {result.senateRaces.length === 0 && !result.houseRace && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No races found.{' '}
                <Link to={`/primary/state/${result.state}`} className="font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                  View {result.stateName}
                </Link>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RaceChip({ race, type }: { race: PrimaryRace; type: string }) {
  const accentColor = type === 'Senate' ? '#7c3aed' : '#0891b2';
  const demCount = race.candidates.democrat.length;
  const repCount = race.candidates.republican.length;

  return (
    <Link
      to={`/primary/race/${race.race_id}`}
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs transition-colors"
      style={{ border: `1px solid var(--border)`, background: 'var(--bg-primary)' }}
      onMouseOver={(e) => { e.currentTarget.style.borderColor = accentColor; }}
      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <span className="font-bold tracking-wider uppercase" style={{ color: accentColor, fontSize: '10px' }}>
        {type}
      </span>
      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
        {race.display_name}
      </span>
      <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
        {demCount > 0 && <><span className="w-1 h-1 rounded-full inline-block" style={{ background: '#2563eb' }} />{demCount}D</>}
        {demCount > 0 && repCount > 0 && <span>/</span>}
        {repCount > 0 && <><span className="w-1 h-1 rounded-full inline-block" style={{ background: '#dc2626' }} />{repCount}R</>}
      </span>
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.3 }}>
        <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
