import { useState, useEffect, useMemo } from 'react';
import type { PoliticalViolenceEvent, PrlMeta, Sex } from '../../types/admin';
import { useAdminToast } from './context/AdminToastContext';

const STORAGE_KEY = 'admin-violence-events';

const PRL_META_OPTIONS: PrlMeta[] = ['Government Policy', 'Politician/Party', 'Unclear', 'Institution'];
const SEX_OPTIONS: Sex[] = ['Male', 'Female', 'Both', ''];

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia'
];

// Geocode city + state using OpenStreetMap Nominatim API
async function geocodeLocation(city: string, state: string): Promise<{ lat: number; lon: number } | null> {
  if (!city || !state) return null;

  try {
    const query = encodeURIComponent(`${city}, ${state}, USA`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: { 'User-Agent': 'AmericasPoliticalPulse-Admin/1.0' }
    });
    const data = await res.json();

    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
}

function downloadJSON(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const emptyEvent: Omit<PoliticalViolenceEvent, 'rowid'> = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  day: new Date().getDate(),
  state: '',
  city: '',
  latitude: 0,
  longitude: 0,
  summary: '',
  attack_type: '',
  target: '',
  motive: '',
  num_perps: 1,
  total_killed: 0,
  perps_killed: 0,
  prl_meta: 'Unclear',
  sex: 'Male',
  trans: 0,
  race: '',
};

export function ViolenceAdmin() {
  const [events, setEvents] = useState<PoliticalViolenceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [geocoding, setGeocoding] = useState(false);
  const { showError, showSuccess, showToast } = useAdminToast();

  const [formData, setFormData] = useState<Omit<PoliticalViolenceEvent, 'rowid'>>(emptyEvent);

  // Extract unique values from existing events for dropdowns
  const uniqueValues = useMemo(() => {
    const getUnique = (field: keyof PoliticalViolenceEvent) =>
      [...new Set(events.map((e) => e[field] as string).filter((v) => v && v.trim()))].sort();

    return {
      attackTypes: getUnique('attack_type'),
      targets: getUnique('target'),
      motives: getUnique('motive'),
      races: getUnique('race'),
    };
  }, [events]);

  useEffect(() => {
    async function loadData() {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setEvents(JSON.parse(stored));
        setIsDirty(true);
      } else {
        try {
          const eventsModule = await import('../../pages/violence/data/events.json');
          setEvents(eventsModule.default as PoliticalViolenceEvent[]);
        } catch (error) {
          showError('Failed to load violence events', error);
        }
      }
      setLoading(false);
    }
    loadData();
  }, [showError]);

  const saveToStorage = (data: PoliticalViolenceEvent[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setIsDirty(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId !== null) {
      const updated = events.map((ev) =>
        ev.rowid === editingId ? { ...formData, rowid: editingId } : ev
      );
      setEvents(updated);
      saveToStorage(updated);
    } else {
      const maxId = events.reduce((max, ev) => Math.max(max, ev.rowid), 0);
      const newEvent: PoliticalViolenceEvent = { ...formData, rowid: maxId + 1 };
      const updated = [newEvent, ...events];
      setEvents(updated);
      saveToStorage(updated);
    }

    resetForm();
  };

  const handleEdit = (event: PoliticalViolenceEvent) => {
    const { rowid, ...rest } = event;
    setFormData(rest);
    setEditingId(rowid);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this event?')) {
      const updated = events.filter((ev) => ev.rowid !== id);
      setEvents(updated);
      saveToStorage(updated);
    }
  };

  const resetForm = () => {
    setFormData(emptyEvent);
    setEditingId(null);
    setShowForm(false);
  };

  const handleGeocode = async () => {
    if (!formData.city || !formData.state) {
      showToast('warning', 'Please enter both city and state first');
      return;
    }

    setGeocoding(true);
    const coords = await geocodeLocation(formData.city, formData.state);
    setGeocoding(false);

    if (coords) {
      setFormData({ ...formData, latitude: coords.lat, longitude: coords.lon });
      showSuccess('Coordinates found');
    } else {
      showError('Could not find coordinates for this location');
    }
  };

  const handleExport = () => {
    downloadJSON(events, 'events.json');
  };

  const handleResetToSource = async () => {
    if (confirm('This will discard all local changes. Continue?')) {
      localStorage.removeItem(STORAGE_KEY);
      try {
        const eventsModule = await import('../../pages/violence/data/events.json');
        setEvents(eventsModule.default as PoliticalViolenceEvent[]);
        setIsDirty(false);
        showSuccess('Reset to source data');
      } catch (error) {
        showError('Failed to reload data', error);
      }
    }
  };

  const years = [...new Set(events.map((e) => e.year))].sort((a, b) => b - a);

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.state.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesYear = filterYear === 'all' || e.year === Number(filterYear);
    return matchesSearch && matchesYear;
  });

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-48 rounded mb-4" style={{ background: 'var(--bg-secondary)' }} />
        <div className="h-64 rounded" style={{ background: 'var(--bg-secondary)' }} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Violence Events
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {events.length} events {isDirty && <span style={{ color: '#f59e0b' }}>(unsaved changes)</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {isDirty && (
            <button
              onClick={handleResetToSource}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              Reset
            </button>
          )}
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#10b981', color: '#fff' }}
          >
            <i className="bi bi-download mr-2"></i>Export JSON
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <i className="bi bi-plus-lg mr-2"></i>Add New
          </button>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {editingId ? 'Edit Event' : 'Add Event'}
              </h2>
              <button onClick={resetForm} style={{ color: 'var(--text-muted)' }}>
                <i className="bi bi-x-lg text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-4">
                {/* Date fields */}
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Year *</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                    min={1970}
                    max={2030}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Month *</label>
                  <input
                    type="number"
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                    min={1}
                    max={12}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Day *</label>
                  <input
                    type="number"
                    value={formData.day}
                    onChange={(e) => setFormData({ ...formData, day: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                    min={1}
                    max={31}
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>City *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                    list="cities-list"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>State *</label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                  >
                    <option value="">Select state...</option>
                    {US_STATES.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Coordinates</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: Number(e.target.value) })}
                      className="flex-1 px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      placeholder="Latitude"
                    />
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: Number(e.target.value) })}
                      className="flex-1 px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      placeholder="Longitude"
                    />
                    <button
                      type="button"
                      onClick={handleGeocode}
                      disabled={geocoding}
                      className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                      style={{ background: 'var(--accent)', color: '#fff', opacity: geocoding ? 0.5 : 1 }}
                      title="Auto-fill coordinates from city/state"
                    >
                      {geocoding ? (
                        <><i className="bi bi-hourglass-split mr-2"></i>Loading...</>
                      ) : (
                        <><i className="bi bi-geo-alt mr-2"></i>Get Coordinates</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Classification */}
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Category *</label>
                  <select
                    value={formData.prl_meta}
                    onChange={(e) => setFormData({ ...formData, prl_meta: e.target.value as PrlMeta })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  >
                    {PRL_META_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Attack Type *</label>
                  <select
                    value={formData.attack_type}
                    onChange={(e) => setFormData({ ...formData, attack_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                  >
                    <option value="">Select type...</option>
                    {uniqueValues.attackTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Target *</label>
                  <select
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                  >
                    <option value="">Select target...</option>
                    {uniqueValues.targets.map((target) => (
                      <option key={target} value={target}>{target}</option>
                    ))}
                  </select>
                </div>

                {/* Casualties */}
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}># Perpetrators</label>
                  <input
                    type="number"
                    value={formData.num_perps}
                    onChange={(e) => setFormData({ ...formData, num_perps: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    min={-99}
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>-99 = unknown</p>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Total Killed</label>
                  <input
                    type="number"
                    value={formData.total_killed}
                    onChange={(e) => setFormData({ ...formData, total_killed: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Perps Killed</label>
                  <input
                    type="number"
                    value={formData.perps_killed}
                    onChange={(e) => setFormData({ ...formData, perps_killed: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    min={0}
                  />
                </div>

                {/* Perpetrator demographics */}
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Perpetrator Sex</label>
                  <select
                    value={formData.sex}
                    onChange={(e) => setFormData({ ...formData, sex: e.target.value as Sex })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Unknown</option>
                    {SEX_OPTIONS.filter(s => s).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Race</label>
                  <select
                    value={formData.race}
                    onChange={(e) => setFormData({ ...formData, race: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Unknown</option>
                    {uniqueValues.races.map((race) => (
                      <option key={race} value={race}>{race}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Transgender</label>
                  <select
                    value={formData.trans}
                    onChange={(e) => setFormData({ ...formData, trans: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value={0}>No</option>
                    <option value={1}>Yes</option>
                  </select>
                </div>

                {/* Text fields */}
                <div className="col-span-3">
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Motive</label>
                  <select
                    value={formData.motive}
                    onChange={(e) => setFormData({ ...formData, motive: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Select motive...</option>
                    {uniqueValues.motives.map((motive) => (
                      <option key={motive} value={motive}>{motive}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Summary *</label>
                  <textarea
                    value={formData.summary}
                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    rows={4}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {editingId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by city, state, or summary..."
          className="flex-1 px-4 py-2 rounded-lg"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="px-4 py-2 rounded-lg"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="all">All Years</option>
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Date</th>
              <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Location</th>
              <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Category</th>
              <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Killed</th>
              <th className="text-left px-4 py-3 text-sm font-medium hidden lg:table-cell" style={{ color: 'var(--text-secondary)' }}>Summary</th>
              <th className="text-right px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.slice(0, 100).map((event) => (
              <tr key={event.rowid} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                  {event.year}-{String(event.month).padStart(2, '0')}-{String(event.day).padStart(2, '0')}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                  {event.city}, {event.state}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--accent)' }}>
                  {event.prl_meta}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: event.total_killed > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                  {event.total_killed}
                </td>
                <td className="px-4 py-3 text-sm hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>
                  <span className="line-clamp-1">{event.summary}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleEdit(event)}
                    className="p-1 mr-2 hover:opacity-70"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <i className="bi bi-pencil"></i>
                  </button>
                  <button
                    onClick={() => handleDelete(event.rowid)}
                    className="p-1 hover:opacity-70"
                    style={{ color: '#ef4444' }}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredEvents.length > 100 && (
          <div className="px-4 py-3 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
            Showing first 100 of {filteredEvents.length} events. Use search to filter.
          </div>
        )}
        {filteredEvents.length === 0 && (
          <div className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
            No events found
          </div>
        )}
      </div>
    </div>
  );
}
