import { useState, useCallback, useEffect } from 'react';
import { getAlertConfig, updateAlertConfig, sendTestAlert } from './monitoringApi';
import { BATCH_JOBS } from './types';
import type { AlertConfig } from './types';

export function OperationsAlerts() {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAlertConfig();
      setConfig(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load alert config');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateAlertConfig({
        critical_jobs: config.critical_jobs,
        alert_emails: config.alert_emails,
        enabled: config.enabled,
      });
      setSuccess('Alert configuration saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save alert config');
    } finally {
      setSaving(false);
    }
  };

  const handleTestAlert = async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);
    try {
      await sendTestAlert();
      setSuccess('Test alert sent. Check your email.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send test alert');
    } finally {
      setTesting(false);
    }
  };

  const toggleJob = (job: string) => {
    if (!config) return;
    const jobs = config.critical_jobs.includes(job)
      ? config.critical_jobs.filter((j) => j !== job)
      : [...config.critical_jobs, job];
    setConfig({ ...config, critical_jobs: jobs });
  };

  const addEmail = () => {
    if (!config || !newEmail || !newEmail.includes('@')) return;
    if (config.alert_emails.includes(newEmail)) return;
    setConfig({ ...config, alert_emails: [...config.alert_emails, newEmail] });
    setNewEmail('');
  };

  const removeEmail = (email: string) => {
    if (!config) return;
    setConfig({ ...config, alert_emails: config.alert_emails.filter((e) => e !== email) });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Alert Configuration
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Configure email alerts for critical batch job failures
          </p>
        </div>
        <button
          onClick={loadConfig}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`}></i>
          {' '}{loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div
          className="p-4 rounded-lg mb-6 text-sm"
          style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}
        >
          <i className="bi bi-exclamation-triangle mr-2"></i>{error}
        </div>
      )}
      {success && (
        <div
          className="p-4 rounded-lg mb-6 text-sm"
          style={{ background: '#10b98120', color: '#10b981', border: '1px solid #10b98140' }}
        >
          <i className="bi bi-check-circle mr-2"></i>{success}
        </div>
      )}

      {!config && loading && (
        <div
          className="p-12 rounded-xl text-center"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <i className="bi bi-arrow-clockwise animate-spin text-2xl mb-3 block" style={{ color: 'var(--text-muted)' }}></i>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading alert settings...
          </p>
        </div>
      )}

      {!config && !loading && !error && (
        <div
          className="p-12 rounded-xl text-center"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <i className="bi bi-bell text-4xl mb-3 block" style={{ color: 'var(--text-muted)' }}></i>
          <p className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            No alert configuration found
          </p>
        </div>
      )}

      {config && (
        <div className="space-y-6">
          {/* Enable/Disable */}
          <div
            className="p-6 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                  Alerts Enabled
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  When enabled, email alerts are sent for critical job failures.
                </p>
              </div>
              <button
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className="relative w-12 h-6 rounded-full transition-colors"
                style={{
                  background: config.enabled ? '#10b981' : 'var(--bg-tertiary)',
                  border: `1px solid ${config.enabled ? '#10b981' : 'var(--border)'}`,
                }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                  style={{
                    background: '#fff',
                    left: config.enabled ? '24px' : '2px',
                  }}
                />
              </button>
            </div>
          </div>

          {/* Email Addresses */}
          <div
            className="p-6 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Alert Email Addresses
            </h2>
            <div className="flex gap-2 mb-4">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                placeholder="Enter email address..."
                className="flex-1 px-4 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                onClick={addEmail}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <i className="bi bi-plus"></i> Add
              </button>
            </div>
            {config.alert_emails.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No email addresses configured.
              </p>
            ) : (
              <div className="space-y-2">
                {config.alert_emails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {email}
                    </span>
                    <button
                      onClick={() => removeEmail(email)}
                      className="text-sm px-2 py-1 rounded"
                      style={{ color: '#ef4444' }}
                    >
                      <i className="bi bi-x"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              New emails will receive an SNS confirmation email that must be accepted.
            </p>
          </div>

          {/* Critical Jobs */}
          <div
            className="p-6 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Critical Jobs
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Select which jobs should trigger alerts on failure.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {BATCH_JOBS.map((job) => {
                const checked = config.critical_jobs.includes(job);
                return (
                  <label
                    key={job}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
                    style={{
                      background: checked ? 'var(--accent)10' : 'transparent',
                      border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleJob(job)}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {job}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 rounded-lg text-sm font-medium"
              style={{
                background: 'var(--accent)',
                color: '#fff',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            <button
              onClick={handleTestAlert}
              disabled={testing}
              className="px-6 py-2 rounded-lg text-sm font-medium"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                opacity: testing ? 0.7 : 1,
              }}
            >
              <i className="bi bi-send mr-2"></i>
              {testing ? 'Sending...' : 'Send Test Alert'}
            </button>
          </div>

          {/* Last updated */}
          {config.updated_at && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Last updated: {new Date(config.updated_at).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
