import { useState, useEffect, useMemo } from 'react';
import { useAdminToast } from './context/AdminToastContext';
import { getAdminPassword, handleUnauthorized } from './utils/adminAuth';

const MONITORING_API_BASE = import.meta.env.DEV
  ? '/monitoring'
  : import.meta.env.VITE_MONITORING_API_URL;

interface Official {
  bioguide_id: string;
  first_name: string;
  last_name: string;
  party: string;
  state: string;
  government_website: string | null;
  press_release_url: string | null;
  press_release_url_status: string | null;
}

type StatusFilter = 'all' | 'needs_review' | 'not_found' | 'error' | 'found';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  found: { bg: '#10b98120', text: '#10b981' },
  needs_review: { bg: '#f59e0b20', text: '#f59e0b' },
  not_found: { bg: '#ef444420', text: '#ef4444' },
  error: { bg: '#ef444420', text: '#ef4444' },
  unknown: { bg: '#6b728020', text: '#6b7280' },
};

export function PressUrlsAdmin() {
  const [officials, setOfficials] = useState<Official[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('needs_review');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [editStatus, setEditStatus] = useState('found');
  const [saving, setSaving] = useState(false);
  const { showError, showSuccess } = useAdminToast();

  const fetchOfficials = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${MONITORING_API_BASE}/officials/press-urls`, {
        headers: { 'x-admin-password': getAdminPassword() },
      });
      if (response.status === 401) return handleUnauthorized();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setOfficials(data.officials);
      setCounts(data.counts);
    } catch (error) {
      showError('Failed to load officials', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficials();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return officials.filter((o) => {
      const matchesStatus =
        statusFilter === 'all' || (o.press_release_url_status || 'unknown') === statusFilter;
      const matchesSearch =
        !searchTerm ||
        `${o.first_name} ${o.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.state || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.bioguide_id || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [officials, statusFilter, searchTerm]);

  const startEdit = (official: Official) => {
    setEditingId(official.bioguide_id);
    setEditUrl(official.press_release_url || '');
    setEditStatus(official.press_release_url_status || 'found');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditUrl('');
    setEditStatus('found');
  };

  const saveEdit = async (bioguide_id: string) => {
    setSaving(true);
    try {
      const response = await fetch(`${MONITORING_API_BASE}/officials/press-urls/update`, {
        method: 'POST',
        headers: {
          'x-admin-password': getAdminPassword(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bioguide_id,
          press_release_url: editUrl || null,
          press_release_url_status: editStatus,
        }),
      });
      if (response.status === 401) return handleUnauthorized();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Update local state
      setOfficials((prev) =>
        prev.map((o) =>
          o.bioguide_id === bioguide_id
            ? { ...o, press_release_url: editUrl || null, press_release_url_status: editStatus }
            : o,
        ),
      );

      // Update counts
      const old = officials.find((o) => o.bioguide_id === bioguide_id);
      if (old) {
        setCounts((prev) => {
          const next = { ...prev };
          const oldStatus = old.press_release_url_status || 'unknown';
          next[oldStatus] = (next[oldStatus] || 1) - 1;
          next[editStatus] = (next[editStatus] || 0) + 1;
          return next;
        });
      }

      cancelEdit();
      showSuccess('Updated successfully');
    } catch (error) {
      showError('Failed to update', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-64 rounded mb-4" style={{ background: 'var(--bg-secondary)' }} />
        <div className="h-64 rounded" style={{ background: 'var(--bg-secondary)' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Press Release URLs
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Review and update press release page URLs for federal officials
          </p>
        </div>
        <button
          onClick={fetchOfficials}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <i className="bi bi-arrow-clockwise mr-2"></i>Refresh
        </button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(['found', 'needs_review', 'not_found', 'error'] as const).map((status) => {
          const colors = STATUS_COLORS[status];
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className="p-3 rounded-lg text-left transition-all"
              style={{
                background: isActive ? colors.bg : 'var(--bg-secondary)',
                border: `1px solid ${isActive ? colors.text : 'var(--border)'}`,
              }}
            >
              <div className="text-2xl font-bold" style={{ color: colors.text }}>
                {counts[status] || 0}
              </div>
              <div className="text-xs mt-1 capitalize" style={{ color: 'var(--text-secondary)' }}>
                {status.replace('_', ' ')}
              </div>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, state, or bioguide ID..."
          className="w-full px-4 py-2 rounded-lg"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Results count */}
      <div className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
        Showing {filtered.length} of {officials.length} officials
        {statusFilter !== 'all' && (
          <button
            onClick={() => setStatusFilter('all')}
            className="ml-2 underline"
            style={{ color: 'var(--accent)' }}
          >
            show all
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Official</th>
              <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium hidden lg:table-cell" style={{ color: 'var(--text-secondary)' }}>Gov Website</th>
              <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Press URL</th>
              <th className="text-right px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((official) => {
              const isEditing = editingId === official.bioguide_id;
              const status = official.press_release_url_status || 'unknown';
              const colors = STATUS_COLORS[status] || STATUS_COLORS.unknown;

              return (
                <tr key={official.bioguide_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {official.first_name} {official.last_name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {official.party} - {official.state}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="px-2 py-1 rounded text-xs"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      >
                        <option value="found">Found</option>
                        <option value="needs_review">Needs Review</option>
                        <option value="not_found">Not Found</option>
                        <option value="error">Error</option>
                      </select>
                    ) : (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                        style={{ background: colors.bg, color: colors.text }}
                      >
                        {status.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {official.government_website ? (
                      <a
                        href={official.government_website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        {new URL(official.government_website).hostname}
                      </a>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="url"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-2 py-1 rounded text-xs"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', minWidth: 200 }}
                      />
                    ) : official.press_release_url ? (
                      <a
                        href={official.press_release_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline break-all"
                        style={{ color: 'var(--accent)' }}
                      >
                        {official.press_release_url.replace(/^https?:\/\//, '').slice(0, 50)}
                        {official.press_release_url.replace(/^https?:\/\//, '').length > 50 ? '...' : ''}
                      </a>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveEdit(official.bioguide_id)}
                          disabled={saving}
                          className="p-1 mr-1"
                          style={{ color: '#10b981', opacity: saving ? 0.5 : 1 }}
                          title="Save"
                        >
                          <i className="bi bi-check-lg"></i>
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1"
                          style={{ color: 'var(--text-muted)' }}
                          title="Cancel"
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(official)}
                          className="p-1 mr-1 hover:opacity-70"
                          style={{ color: 'var(--text-secondary)' }}
                          title="Edit"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        {official.press_release_url && (
                          <a
                            href={official.press_release_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:opacity-70 inline-block"
                            style={{ color: 'var(--text-secondary)' }}
                            title="Open URL"
                          >
                            <i className="bi bi-box-arrow-up-right"></i>
                          </a>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
            No officials found
          </div>
        )}
      </div>
    </div>
  );
}
