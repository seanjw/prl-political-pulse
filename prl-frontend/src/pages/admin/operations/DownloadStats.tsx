import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { getDownloadStats, refreshDownloadStats } from './monitoringApi';
import type { DownloadStats as DownloadStatsType } from './types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="p-5 rounded-xl"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  );
}

export function DownloadStats() {
  const [stats, setStats] = useState<DownloadStatsType | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDownloadStats();
      setStats(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load download stats';
      // 404 means "not generated yet" — show a friendlier message
      if (msg.includes('404')) {
        setError('No stats available yet. Click "Refresh now" to generate the first aggregation.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshDownloadStats();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            to="/admin"
            className="text-sm mb-2 inline-block"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}
          >
            ← Back to Operations
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Download Stats
          </h1>
          {stats && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Last {stats.window_days} days · Updated {formatRelativeTime(stats.as_of)}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          {refreshing ? 'Regenerating…' : 'Refresh now'}
        </button>
      </div>

      {loading && !stats && (
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      )}

      {error && (
        <div
          className="p-4 rounded-lg mb-6"
          style={{ background: '#ef444420', border: '1px solid #ef4444', color: '#ef4444' }}
        >
          {error}
        </div>
      )}

      {stats && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard
              label="Total downloads"
              value={formatNumber(stats.totals.total_downloads)}
            />
            <StatCard
              label="Unique IPs"
              value={formatNumber(stats.totals.unique_ips)}
            />
            <StatCard
              label="Total bytes transferred"
              value={formatBytes(stats.totals.total_bytes)}
            />
          </div>

          {/* Monthly chart */}
          <section
            className="p-5 rounded-xl mb-6"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Downloads by month
            </h2>
            {stats.by_month.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No data yet.</p>
            ) : (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={stats.by_month}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" stroke="var(--text-muted)" />
                    <YAxis stroke="var(--text-muted)" />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                      }}
                    />
                    <Bar dataKey="downloads" fill="var(--accent)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Top files */}
          <section
            className="p-5 rounded-xl mb-6"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Top files
            </h2>
            {stats.by_file.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th className="text-left py-2">File</th>
                    <th className="text-right py-2">Downloads</th>
                    <th className="text-right py-2">Bytes</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_file.map((row) => (
                    <tr key={row.uri} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-2 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                        {row.uri}
                      </td>
                      <td className="py-2 text-right" style={{ color: 'var(--text-primary)' }}>
                        {formatNumber(row.downloads)}
                      </td>
                      <td className="py-2 text-right" style={{ color: 'var(--text-muted)' }}>
                        {formatBytes(row.bytes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Top referrers */}
          <section
            className="p-5 rounded-xl mb-6"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Top referrers (external)
            </h2>
            {stats.by_referrer.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>
                No external referrers yet — most traffic is direct or self-referring.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th className="text-left py-2">Referrer</th>
                    <th className="text-right py-2">Downloads</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.by_referrer.map((row) => (
                    <tr key={row.referrer} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                        {row.referrer}
                      </td>
                      <td className="py-2 text-right" style={{ color: 'var(--text-primary)' }}>
                        {formatNumber(row.downloads)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
