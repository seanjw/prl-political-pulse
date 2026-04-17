import { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE } from '../../config/api';
import { PRIMARY_DATES } from '../../config/primaryDates';
import type { PrimaryCandidate, PrimaryRace } from '../../types/primary';
import { useAdminToast } from './context/AdminToastContext';
import { getAdminPassword, handleUnauthorized } from './utils/adminAuth';

interface WinnerRecord {
  candidate_id: string;
  race_id: string;
  called_at: string;
}

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getPartyColor(party: string): string {
  const p = party.toLowerCase();
  if (p.includes('democrat')) return '#3b82f6';
  if (p.includes('republican')) return '#ef4444';
  return '#9ca3af';
}

function getIncumbentLabel(ic: string): string {
  if (ic === 'I') return 'Incumbent';
  if (ic === 'C') return 'Challenger';
  if (ic === 'O') return 'Open Seat';
  return '';
}

type Tab = 'adjudicate' | 'called' | 'upcoming';

export function PrimaryAdmin() {
  const { showSuccess, showError } = useAdminToast();
  const [loading, setLoading] = useState(true);
  const [races, setRaces] = useState<PrimaryRace[]>([]);
  const [candidates, setCandidates] = useState<PrimaryCandidate[]>([]);
  const [winners, setWinners] = useState<WinnerRecord[]>([]);
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmRaceId, setConfirmRaceId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('adjudicate');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [adminRes, winnersRes] = await Promise.all([
          fetch(`${API_BASE}/data/primary/admin-all-candidates`),
          fetch(`${API_BASE}/admin/primary-winners`, {
            headers: { 'x-admin-password': getAdminPassword() },
          }),
        ]);

        if (winnersRes.status === 401) return handleUnauthorized();
        if (!adminRes.ok) throw new Error('Failed to load candidates');

        const adminData = await adminRes.json();
        const candidatesData: PrimaryCandidate[] = adminData.data?.candidates ?? [];
        const racesData: PrimaryRace[] = adminData.data?.races ?? [];

        let winnersData: WinnerRecord[] = [];
        if (winnersRes.ok) {
          const wJson = await winnersRes.json();
          winnersData = wJson.data ?? [];
        }

        setCandidates(candidatesData);
        setRaces(racesData);
        setWinners(winnersData);

        const sel: Record<string, Set<string>> = {};
        for (const w of winnersData) {
          if (!sel[w.race_id]) sel[w.race_id] = new Set();
          sel[w.race_id].add(w.candidate_id);
        }
        setSelections(sel);
      } catch (err) {
        showError('Failed to load primary data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const candidateMap = useMemo(() => {
    const m = new Map<string, PrimaryCandidate>();
    for (const c of candidates) m.set(c.candidate_id, c);
    return m;
  }, [candidates]);

  const winnersByRace = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const w of winners) {
      if (!m.has(w.race_id)) m.set(w.race_id, new Set());
      m.get(w.race_id)!.add(w.candidate_id);
    }
    return m;
  }, [winners]);

  // Split races into three buckets
  const { needsAdjudication, calledRaces, upcomingRaces } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const needs: PrimaryRace[] = [];
    const called: PrimaryRace[] = [];
    const upcoming: PrimaryRace[] = [];

    for (const race of races) {
      const isCalled = winnersByRace.has(race.race_id);
      const primaryDate = PRIMARY_DATES[race.state]?.date;
      const isPast = primaryDate ? new Date(primaryDate) < now : false;

      if (isCalled) {
        called.push(race);
      } else if (isPast) {
        needs.push(race);
      } else {
        upcoming.push(race);
      }
    }

    // Sort needs adjudication by date (oldest first — most overdue at top)
    needs.sort((a, b) => {
      const da = PRIMARY_DATES[a.state]?.date ?? '9999';
      const db = PRIMARY_DATES[b.state]?.date ?? '9999';
      return da.localeCompare(db);
    });

    // Sort called by most recently called
    called.sort((a, b) => {
      const wa = winners.filter(w => w.race_id === a.race_id);
      const wb = winners.filter(w => w.race_id === b.race_id);
      const ta = wa.length ? wa[0].called_at : '';
      const tb = wb.length ? wb[0].called_at : '';
      return tb.localeCompare(ta);
    });

    // Sort upcoming by date (soonest first)
    upcoming.sort((a, b) => {
      const da = PRIMARY_DATES[a.state]?.date ?? '9999';
      const db = PRIMARY_DATES[b.state]?.date ?? '9999';
      return da.localeCompare(db);
    });

    return { needsAdjudication: needs, calledRaces: called, upcomingRaces: upcoming };
  }, [races, winnersByRace, winners]);

  const activeRaces = useMemo(() => {
    const list = tab === 'adjudicate' ? needsAdjudication
      : tab === 'called' ? calledRaces
      : upcomingRaces;

    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(r => {
      if (r.display_name.toLowerCase().includes(q)) return true;
      if (r.race_id.toLowerCase().includes(q)) return true;
      if ((STATE_NAMES[r.state] || '').toLowerCase().includes(q)) return true;
      const allCids = [...r.candidates.democrat, ...r.candidates.republican];
      return allCids.some(cid => {
        const c = candidateMap.get(cid);
        return c && c.name.toLowerCase().includes(q);
      });
    });
  }, [tab, needsAdjudication, calledRaces, upcomingRaces, search, candidateMap]);

  // Group by state
  const racesByState = useMemo(() => {
    const groups: Record<string, PrimaryRace[]> = {};
    for (const r of activeRaces) {
      if (!groups[r.state]) groups[r.state] = [];
      groups[r.state].push(r);
    }
    return groups;
  }, [activeRaces]);

  const stateOrder = useMemo(() => {
    return Object.keys(racesByState).sort((a, b) => {
      const da = PRIMARY_DATES[a]?.date ?? '9999';
      const db = PRIMARY_DATES[b]?.date ?? '9999';
      return da.localeCompare(db);
    });
  }, [racesByState]);

  const toggleCandidate = useCallback((raceId: string, candidateId: string) => {
    setSelections(prev => {
      const next = { ...prev };
      if (!next[raceId]) next[raceId] = new Set();
      else next[raceId] = new Set(next[raceId]);

      if (next[raceId].has(candidateId)) {
        next[raceId].delete(candidateId);
      } else {
        next[raceId].add(candidateId);
      }
      return next;
    });
  }, []);

  const hasUnsavedChanges = useCallback((raceId: string) => {
    const saved = winnersByRace.get(raceId) ?? new Set();
    const selected = selections[raceId] ?? new Set();
    if (saved.size !== selected.size) return true;
    for (const id of saved) {
      if (!selected.has(id)) return true;
    }
    return false;
  }, [winnersByRace, selections]);

  const saveWinners = useCallback(async (raceId: string) => {
    const selected = selections[raceId];
    if (!selected || selected.size === 0) {
      showError('Select at least one winner before saving');
      return;
    }

    setSaving(raceId);
    try {
      const res = await fetch(`${API_BASE}/admin/primary-winners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: getAdminPassword(),
          race_id: raceId,
          winner_candidate_ids: Array.from(selected),
        }),
      });

      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to save');
      }

      setWinners(prev => {
        const filtered = prev.filter(w => w.race_id !== raceId);
        const newWinners = Array.from(selected).map(cid => ({
          candidate_id: cid,
          race_id: raceId,
          called_at: new Date().toISOString(),
        }));
        return [...filtered, ...newWinners];
      });

      showSuccess(`Winners saved for ${raceId}`);
    } catch (err) {
      showError('Failed to save winners', err);
    } finally {
      setSaving(null);
      setConfirmRaceId(null);
    }
  }, [selections, showSuccess, showError]);

  const clearRace = useCallback(async (raceId: string) => {
    setSaving(raceId);
    try {
      const res = await fetch(`${API_BASE}/admin/primary-winners/${encodeURIComponent(raceId)}`, {
        method: 'DELETE',
        headers: { 'x-admin-password': getAdminPassword() },
      });

      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to clear');
      }

      setWinners(prev => prev.filter(w => w.race_id !== raceId));
      setSelections(prev => {
        const next = { ...prev };
        delete next[raceId];
        return next;
      });

      showSuccess(`Cleared winners for ${raceId}`);
    } catch (err) {
      showError('Failed to clear race', err);
    } finally {
      setSaving(null);
    }
  }, [showSuccess, showError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center" style={{ color: 'var(--text-secondary)' }}>
          <i className="bi bi-arrow-repeat spin text-2xl mb-2 d-block"></i>
          Loading primary data...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header with summary stats */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          Primary Winners
        </h1>
        <div className="flex gap-4">
          <div
            className="px-4 py-3 rounded-lg flex-1 text-center"
            style={{
              background: needsAdjudication.length > 0
                ? 'rgba(245, 158, 11, 0.1)'
                : 'var(--bg-secondary)',
              border: `1px solid ${needsAdjudication.length > 0 ? 'rgba(245, 158, 11, 0.3)' : 'var(--border)'}`,
            }}
          >
            <div
              className="text-2xl font-bold"
              style={{ color: needsAdjudication.length > 0 ? '#f59e0b' : 'var(--text-primary)' }}
            >
              {needsAdjudication.length}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Need Adjudication</div>
          </div>
          <div
            className="px-4 py-3 rounded-lg flex-1 text-center"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="text-2xl font-bold" style={{ color: '#22c55e' }}>
              {calledRaces.length}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Called</div>
          </div>
          <div
            className="px-4 py-3 rounded-lg flex-1 text-center"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {upcomingRaces.length}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Upcoming</div>
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {([
            { key: 'adjudicate' as Tab, label: 'Needs Adjudication', count: needsAdjudication.length },
            { key: 'called' as Tab, label: 'Called', count: calledRaces.length },
            { key: 'upcoming' as Tab, label: 'Upcoming', count: upcomingRaces.length },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(''); }}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: tab === t.key ? 'var(--accent)' : 'var(--bg-secondary)',
                color: tab === t.key ? '#fff' : 'var(--text-secondary)',
                borderRight: t.key !== 'upcoming' ? '1px solid var(--border)' : undefined,
              }}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="px-3 py-2 rounded-lg text-sm flex-1 min-w-[180px]"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Race list */}
      {stateOrder.map(state => (
        <div key={state} className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {STATE_NAMES[state] || state}
            </h2>
            {PRIMARY_DATES[state] && (
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: tab === 'adjudicate'
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'var(--bg-tertiary)',
                  color: tab === 'adjudicate' ? '#f59e0b' : 'var(--text-muted)',
                }}
              >
                {formatDate(PRIMARY_DATES[state].date)}
                {tab === 'adjudicate' && ` (${daysSince(PRIMARY_DATES[state].date)}d ago)`}
              </span>
            )}
            {PRIMARY_DATES[state]?.notes && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {PRIMARY_DATES[state].notes}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {(racesByState[state] ?? []).map(race => {
              const isCalled = winnersByRace.has(race.race_id);
              const allCids = [...race.candidates.democrat, ...race.candidates.republican];
              const raceSelections = selections[race.race_id] ?? new Set();
              const isSaving = saving === race.race_id;
              const changed = hasUnsavedChanges(race.race_id);

              return (
                <div
                  key={race.race_id}
                  className="rounded-lg p-4"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${
                      isCalled ? 'rgba(34, 197, 94, 0.3)'
                      : tab === 'adjudicate' ? 'rgba(245, 158, 11, 0.25)'
                      : 'var(--border)'
                    }`,
                  }}
                >
                  {/* Race header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {race.display_name}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {race.race_id}
                      </span>
                      {isCalled && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
                        >
                          Called
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isCalled && (
                        <button
                          onClick={() => clearRace(race.race_id)}
                          disabled={isSaving}
                          className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                          }}
                        >
                          Clear
                        </button>
                      )}
                      {changed && (
                        <button
                          onClick={() => setConfirmRaceId(race.race_id)}
                          disabled={isSaving || raceSelections.size === 0}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80"
                          style={{
                            background: 'var(--accent)',
                            color: '#fff',
                            opacity: isSaving || raceSelections.size === 0 ? 0.5 : 1,
                          }}
                        >
                          {isSaving ? 'Saving...' : 'Save Winners'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Candidates as checkboxes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {allCids.map(cid => {
                      const c = candidateMap.get(cid);
                      if (!c) return null;
                      const isSelected = raceSelections.has(cid);
                      const isSavedWinner = winnersByRace.get(race.race_id)?.has(cid);

                      return (
                        <label
                          key={cid}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                          style={{
                            background: isSelected
                              ? 'rgba(34, 197, 94, 0.08)'
                              : 'var(--bg-tertiary)',
                            border: `1px solid ${isSelected ? 'rgba(34, 197, 94, 0.3)' : 'transparent'}`,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCandidate(race.race_id, cid)}
                            className="w-4 h-4 rounded flex-shrink-0"
                            style={{ accentColor: '#22c55e' }}
                          />
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: getPartyColor(c.party) }}
                          />
                          <div className="flex-1 min-w-0">
                            <span
                              className="text-sm font-medium"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {c.name}
                            </span>
                            <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                              {c.party} · {getIncumbentLabel(c.incumbent_challenge)}
                            </span>
                          </div>
                          {isSavedWinner && (
                            <i
                              className="bi bi-trophy-fill text-xs flex-shrink-0"
                              style={{ color: '#eab308' }}
                              title="Current winner"
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {activeRaces.length === 0 && (
        <div
          className="text-center py-16 rounded-lg"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          {tab === 'adjudicate' ? (
            <>
              <i className="bi bi-check-circle text-3xl mb-2 d-block" style={{ color: '#22c55e' }}></i>
              <p style={{ color: 'var(--text-secondary)' }}>All past primaries have been adjudicated.</p>
            </>
          ) : tab === 'called' ? (
            <>
              <i className="bi bi-trophy text-3xl mb-2 d-block" style={{ color: 'var(--text-muted)' }}></i>
              <p style={{ color: 'var(--text-secondary)' }}>No races called yet.</p>
            </>
          ) : (
            <>
              <i className="bi bi-calendar-check text-3xl mb-2 d-block" style={{ color: 'var(--text-muted)' }}></i>
              <p style={{ color: 'var(--text-secondary)' }}>No upcoming primaries.</p>
            </>
          )}
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmRaceId && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setConfirmRaceId(null)}
        >
          <div
            className="p-6 rounded-xl max-w-md w-full mx-4"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Confirm Winners
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Mark the following as winners of <strong>{confirmRaceId}</strong>?
              All other candidates will be hidden from the public site after the next data rebuild.
            </p>
            <ul className="mb-4 space-y-1">
              {Array.from(selections[confirmRaceId] ?? []).map(cid => {
                const c = candidateMap.get(cid);
                return (
                  <li key={cid} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: getPartyColor(c?.party ?? '') }}
                    />
                    {c?.name ?? cid} ({c?.party})
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmRaceId(null)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => saveWinners(confirmRaceId)}
                disabled={saving !== null}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {saving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
