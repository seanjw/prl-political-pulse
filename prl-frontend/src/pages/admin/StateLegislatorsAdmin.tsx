import { useState, useEffect, useCallback } from 'react';
import { useAdminToast } from './context/AdminToastContext';
import { API_BASE } from '../../config/api';
import { getAdminPassword, handleUnauthorized } from './utils/adminAuth';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
];

const PARTY_OPTIONS = ['Democrat', 'Republican', 'Independent', 'Libertarian', 'Green'];
const GENDER_OPTIONS = ['man', 'woman', 'nonbinary'];

interface Legislator {
  id: number;
  openstates_id: string;
  state: string;
  active: number;
  reviewed: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  party: string | null;
  position: string | null;
  district: string | null;
  email: string | null;
  campaign_website: string | null;
  government_website: string | null;
  twitter_handle: string | null;
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  youtube: string | null;
  truth_social: string | null;
  tiktok: string | null;
}

interface Stats {
  total: number;
  reviewed: number;
  unreviewed: number;
  by_state: Record<string, { total: number; unreviewed: number }>;
}

type ReviewedFilter = 'all' | '0' | '1';

const STATUS_COLORS = {
  unreviewed: { bg: '#f59e0b20', text: '#f59e0b' },
  reviewed: { bg: '#10b98120', text: '#10b981' },
};

export function StateLegislatorsAdmin() {
  const [legislators, setLegislators] = useState<Legislator[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Filters
  const [reviewedFilter, setReviewedFilter] = useState<ReviewedFilter>('0');
  const [stateFilter, setStateFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Edit modal
  const [editingLeg, setEditingLeg] = useState<Legislator | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editReviewed, setEditReviewed] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { showError, showSuccess } = useAdminToast();

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/state-legislators/stats`, {
        headers: { 'x-admin-password': getAdminPassword() },
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats(await res.json());
    } catch (error) {
      showError('Failed to load stats', error);
    }
  }, [showError]);

  const fetchLegislators = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (reviewedFilter !== 'all') params.set('reviewed', reviewedFilter);
      if (stateFilter) params.set('state', stateFilter);
      if (partyFilter) params.set('party', partyFilter);
      if (searchTerm) params.set('search', searchTerm);
      params.set('page', String(page));
      params.set('page_size', String(pageSize));

      const res = await fetch(`${API_BASE}/admin/state-legislators?${params}`, {
        headers: { 'x-admin-password': getAdminPassword() },
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLegislators(data.data);
      setTotal(data.total);
    } catch (error) {
      showError('Failed to load legislators', error);
    } finally {
      setLoading(false);
    }
  }, [reviewedFilter, stateFilter, partyFilter, searchTerm, page, showError]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchLegislators(); }, [fetchLegislators]);

  // Reset page when filters change
  const handleFilterChange = useCallback(<T extends string>(setter: (v: T) => void, value: T) => {
    setter(value);
    setPage(0);
    setSelectedIds(new Set());
  }, []);

  // Edit modal
  const openEdit = (leg: Legislator) => {
    setEditingLeg(leg);
    setEditForm({
      name: leg.name || '',
      first_name: leg.first_name || '',
      last_name: leg.last_name || '',
      gender: leg.gender || '',
      party: leg.party || '',
      position: leg.position || '',
      district: leg.district || '',
      email: leg.email || '',
      campaign_website: leg.campaign_website || '',
      government_website: leg.government_website || '',
      twitter_handle: leg.twitter_handle || '',
      facebook: leg.facebook || '',
      instagram: leg.instagram || '',
      linkedin: leg.linkedin || '',
      youtube: leg.youtube || '',
      truth_social: leg.truth_social || '',
      tiktok: leg.tiktok || '',
    });
    setEditReviewed(leg.reviewed === 1);
  };

  const saveEdit = async () => {
    if (!editingLeg) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { ...editForm, reviewed: editReviewed ? 1 : 0 };
      const res = await fetch(`${API_BASE}/admin/state-legislators/${editingLeg.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': getAdminPassword(),
        },
        body: JSON.stringify(body),
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showSuccess('Legislator updated');
      setEditingLeg(null);
      fetchLegislators();
      fetchStats();
    } catch (error) {
      showError('Failed to save', error);
    } finally {
      setSaving(false);
    }
  };

  // Bulk mark reviewed
  const bulkMarkReviewed = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch(`${API_BASE}/admin/state-legislators/mark-reviewed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': getAdminPassword(),
        },
        body: JSON.stringify({ ids: Array.from(selectedIds), reviewed: 1 }),
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      showSuccess(data.message);
      setSelectedIds(new Set());
      fetchLegislators();
      fetchStats();
    } catch (error) {
      showError('Failed to mark reviewed', error);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === legislators.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(legislators.map(l => l.id)));
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      handleFilterChange(setSearchTerm, searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1" style={{ color: 'var(--text-primary)' }}>State Legislators</h2>
          <p className="mb-0" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Review and curate state legislator profiles
          </p>
        </div>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => { fetchLegislators(); fetchStats(); }}>
          <i className="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      </div>

      {/* Summary cards */}
      {stats && (
        <div className="row g-3 mb-4">
          {([
            { label: 'Unreviewed', value: stats.unreviewed, filter: '0' as ReviewedFilter, color: STATUS_COLORS.unreviewed },
            { label: 'Reviewed', value: stats.reviewed, filter: '1' as ReviewedFilter, color: STATUS_COLORS.reviewed },
            { label: 'Total', value: stats.total, filter: 'all' as ReviewedFilter, color: { bg: '#6366f120', text: '#6366f1' } },
          ]).map(card => (
            <div key={card.label} className="col-md-4">
              <div
                className="p-3 rounded-3"
                style={{
                  background: reviewedFilter === card.filter ? card.color.bg : 'var(--bg-tertiary)',
                  border: reviewedFilter === card.filter ? `1px solid ${card.color.text}40` : '1px solid var(--border)',
                  cursor: 'pointer',
                }}
                onClick={() => handleFilterChange(setReviewedFilter, card.filter)}
              >
                <div style={{ color: card.color.text, fontSize: '1.8rem', fontWeight: 700 }}>{card.value.toLocaleString()}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{card.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Search by name..."
          style={{ maxWidth: 220, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 140, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          value={stateFilter}
          onChange={e => handleFilterChange(setStateFilter, e.target.value)}
        >
          <option value="">All States</option>
          {US_STATES.map(s => (
            <option key={s} value={s}>
              {s}{stats?.by_state[s]?.unreviewed ? ` (${stats.by_state[s].unreviewed})` : ''}
            </option>
          ))}
        </select>
        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 160, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          value={partyFilter}
          onChange={e => handleFilterChange(setPartyFilter, e.target.value)}
        >
          <option value="">All Parties</option>
          {PARTY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {selectedIds.size > 0 && (
          <button className="btn btn-sm btn-success ms-auto" onClick={bulkMarkReviewed}>
            <i className="bi bi-check-all me-1"></i>Mark {selectedIds.size} as Reviewed
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="mb-2" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Showing {legislators.length} of {total.toLocaleString()} legislators
        {totalPages > 1 && <span> &middot; Page {page + 1} of {totalPages}</span>}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-5" style={{ color: 'var(--text-muted)' }}>
          <div className="spinner-border spinner-border-sm me-2"></div>Loading...
        </div>
      ) : legislators.length === 0 ? (
        <div className="text-center py-5" style={{ color: 'var(--text-muted)' }}>
          {reviewedFilter === '0' ? 'No unreviewed legislators found. All caught up!' : 'No legislators match the current filters.'}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle" style={{ color: 'var(--text-primary)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === legislators.length && legislators.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Name</th>
                <th>State</th>
                <th>Party</th>
                <th>Position</th>
                <th>District</th>
                <th>Status</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {legislators.map(leg => (
                <tr key={leg.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(leg.id)}
                      onChange={() => toggleSelect(leg.id)}
                    />
                  </td>
                  <td style={{ fontWeight: 500 }}>{leg.name || `${leg.first_name || ''} ${leg.last_name || ''}`}</td>
                  <td>{leg.state}</td>
                  <td>
                    <span style={{
                      color: leg.party === 'Democrat' ? '#3b82f6' : leg.party === 'Republican' ? '#ef4444' : 'var(--text-secondary)',
                      fontWeight: 500,
                    }}>
                      {leg.party || '--'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{leg.position || '--'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{leg.district || '--'}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: leg.reviewed ? STATUS_COLORS.reviewed.bg : STATUS_COLORS.unreviewed.bg,
                        color: leg.reviewed ? STATUS_COLORS.reviewed.text : STATUS_COLORS.unreviewed.text,
                        fontSize: '0.75rem',
                      }}
                    >
                      {leg.reviewed ? 'Reviewed' : 'Unreviewed'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => openEdit(leg)}
                      title="Edit"
                    >
                      <i className="bi bi-pencil"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center gap-2 mt-3">
          <button
            className="btn btn-sm btn-outline-secondary"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            <i className="bi bi-chevron-left"></i> Prev
          </button>
          <span className="d-flex align-items-center px-2" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            className="btn btn-sm btn-outline-secondary"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            Next <i className="bi bi-chevron-right"></i>
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editingLeg && (
        <div
          className="modal d-block"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditingLeg(null); }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
                <h5 className="modal-title">
                  Edit: {editingLeg.name || `${editingLeg.first_name} ${editingLeg.last_name}`}
                  <span className="ms-2" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    ({editingLeg.state})
                  </span>
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setEditingLeg(null)}></button>
              </div>
              <div className="modal-body">
                {/* Mark as reviewed toggle */}
                <div className="form-check form-switch mb-4 p-3 rounded" style={{ background: 'var(--bg-tertiary)' }}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="reviewedCheck"
                    checked={editReviewed}
                    onChange={e => setEditReviewed(e.target.checked)}
                    style={{ marginLeft: 0 }}
                  />
                  <label className="form-check-label ms-3" htmlFor="reviewedCheck" style={{ fontWeight: 500 }}>
                    Mark as Reviewed
                  </label>
                </div>

                {/* Identity fields */}
                <h6 className="mb-3" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  Identity
                </h6>
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label small">Full Name</label>
                    <input className="form-control form-control-sm" style={inputStyle} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small">First Name</label>
                    <input className="form-control form-control-sm" style={inputStyle} value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small">Last Name</label>
                    <input className="form-control form-control-sm" style={inputStyle} value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small">Gender</label>
                    <select className="form-select form-select-sm" style={inputStyle} value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
                      <option value="">--</option>
                      {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small">Party</label>
                    <select className="form-select form-select-sm" style={inputStyle} value={editForm.party} onChange={e => setEditForm(f => ({ ...f, party: e.target.value }))}>
                      <option value="">--</option>
                      {PARTY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {/* Position fields */}
                <h6 className="mb-3" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  Position
                </h6>
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <label className="form-label small">Position</label>
                    <input className="form-control form-control-sm" style={inputStyle} value={editForm.position} onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">District</label>
                    <input className="form-control form-control-sm" style={inputStyle} value={editForm.district} onChange={e => setEditForm(f => ({ ...f, district: e.target.value }))} />
                  </div>
                </div>

                {/* Contact fields */}
                <h6 className="mb-3" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  Contact
                </h6>
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label small">Email</label>
                    <input className="form-control form-control-sm" style={inputStyle} value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small">Government Website</label>
                    <input className="form-control form-control-sm" style={inputStyle} value={editForm.government_website} onChange={e => setEditForm(f => ({ ...f, government_website: e.target.value }))} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small">Campaign Website</label>
                    <input className="form-control form-control-sm" style={inputStyle} value={editForm.campaign_website} onChange={e => setEditForm(f => ({ ...f, campaign_website: e.target.value }))} />
                  </div>
                </div>

                {/* Social media fields */}
                <h6 className="mb-3" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  Social Media
                </h6>
                <div className="row g-3">
                  {([
                    ['twitter_handle', 'X / Twitter'],
                    ['facebook', 'Facebook'],
                    ['instagram', 'Instagram'],
                    ['linkedin', 'LinkedIn'],
                    ['youtube', 'YouTube'],
                    ['truth_social', 'Truth Social'],
                    ['tiktok', 'TikTok'],
                  ] as const).map(([field, label]) => (
                    <div key={field} className="col-md-4">
                      <label className="form-label small">{label}</label>
                      <input
                        className="form-control form-control-sm"
                        style={inputStyle}
                        value={editForm[field]}
                        onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingLeg(null)}>Cancel</button>
                <button className="btn btn-sm btn-primary" onClick={saveEdit} disabled={saving}>
                  {saving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</> : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
};
