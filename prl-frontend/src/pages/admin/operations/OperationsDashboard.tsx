import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSystemStatus, getJobHistory, getJobs, getJobResultsSummary, triggerJob } from './monitoringApi';
import type { SystemStatus, JobHistoryResponse, JobTask, HealthStatus, JobResultsSummary } from './types';
import { BATCH_JOBS } from './types';
import { formatMetric } from './formatMetric';

function statusColor(status: HealthStatus | string): string {
  switch (status) {
    case 'ok': return '#10b981';
    case 'running': return '#3b82f6';
    case 'degraded':
    case 'idle':
    case 'unknown': return '#f59e0b';
    case 'error':
    case 'not_found': return '#ef4444';
    default: return '#6b7280';
  }
}

function statusBg(status: HealthStatus | string): string {
  switch (status) {
    case 'ok': return '#10b98120';
    case 'running': return '#3b82f620';
    case 'degraded':
    case 'idle':
    case 'unknown': return '#f59e0b20';
    case 'error':
    case 'not_found': return '#ef444420';
    default: return '#6b728020';
  }
}

function StatusBadge({ status }: { status: HealthStatus | string }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium uppercase"
      style={{ background: statusBg(status), color: statusColor(status) }}
    >
      {status}
    </span>
  );
}

/** Format duration between two dates or from a date to now */
function formatDuration(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const diffMs = end - start;
  if (diffMs < 0) return '0s';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** Extract job name from task_definition like "prl-floor-ingest:27" */
function jobNameFromTaskDef(taskDef: string): string {
  return taskDef.replace(/^prl-/, '').replace(/:\d+$/, '');
}

function DataRegenerationActions() {
  const [triggering, setTriggering] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleTrigger = async (jobName: string, label: string) => {
    if (!window.confirm(`Are you sure you want to trigger "${label}"? This will start an ECS task.`)) return;
    setTriggering(jobName);
    try {
      const result = await triggerJob(jobName);
      setToast({ type: 'success', message: `${label} triggered successfully` + (result.task_arn ? ` (${result.task_arn.split('/').pop()})` : '') });
    } catch (e) {
      setToast({ type: 'error', message: e instanceof Error ? e.message : 'Failed to trigger job' });
    } finally {
      setTriggering(null);
    }
  };

  const handleRegenerateDownloads = async () => {
    if (!window.confirm('This will regenerate all-data.zip AND rhetoric/profiles ZIPs. Continue?')) return;
    setTriggering('downloads');
    try {
      await Promise.all([
        triggerJob('regenerate-data'),
        triggerJob('rhetoric-public-s3'),
      ]);
      setToast({ type: 'success', message: 'Both download regeneration jobs triggered' });
    } catch (e) {
      setToast({ type: 'error', message: e instanceof Error ? e.message : 'Failed to trigger jobs' });
    } finally {
      setTriggering(null);
    }
  };

  return (
    <div className="mb-8">
      <div
        className="p-5 rounded-xl"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <i className="bi bi-arrow-repeat text-lg" style={{ color: 'var(--accent)' }}></i>
          <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>
            Data Regeneration
          </h2>
        </div>

        {toast && (
          <div
            className="p-3 rounded-lg mb-4 text-sm"
            style={{
              background: toast.type === 'success' ? '#10b98120' : '#ef444420',
              color: toast.type === 'success' ? '#10b981' : '#ef4444',
              border: `1px solid ${toast.type === 'success' ? '#10b98140' : '#ef444440'}`,
            }}
          >
            <i className={`bi ${toast.type === 'success' ? 'bi-check-circle' : 'bi-exclamation-triangle'} mr-2`}></i>
            {toast.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <button
              onClick={() => handleTrigger('toplines-generate', 'Regenerate Toplines')}
              disabled={triggering !== null}
              className="w-full px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              style={{
                background: 'var(--accent)',
                color: '#fff',
                opacity: triggering !== null ? 0.7 : 1,
              }}
            >
              {triggering === 'toplines-generate' ? (
                <><i className="bi bi-arrow-clockwise animate-spin"></i> Triggering...</>
              ) : (
                <><i className="bi bi-file-earmark-pdf"></i> Regenerate Toplines</>
              )}
            </button>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Rebuilds all survey topline PDFs from the database
            </p>
          </div>

          <div>
            <button
              onClick={handleRegenerateDownloads}
              disabled={triggering !== null}
              className="w-full px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              style={{
                background: 'var(--accent)',
                color: '#fff',
                opacity: triggering !== null ? 0.7 : 1,
              }}
            >
              {triggering === 'downloads' ? (
                <><i className="bi bi-arrow-clockwise animate-spin"></i> Triggering...</>
              ) : (
                <><i className="bi bi-file-earmark-zip"></i> Regenerate Download Data</>
              )}
            </button>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Rebuilds all-data.zip + rhetoric/profiles ZIPs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OperationsDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [jobHistory, setJobHistory] = useState<JobHistoryResponse | null>(null);
  const [liveTasks, setLiveTasks] = useState<JobTask[]>([]);
  const [resultsSummary, setResultsSummary] = useState<JobResultsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [status, history, jobs, results] = await Promise.all([
        getSystemStatus(),
        getJobHistory(),
        getJobs(),
        getJobResultsSummary().catch(() => null),
      ]);
      setSystemStatus(status);
      setJobHistory(history);
      setLiveTasks(jobs.jobs ?? []);
      setResultsSummary(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount + auto-refresh every 60s
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Tick every 10s to update running durations
  useEffect(() => {
    const hasRunning = liveTasks.some(t => t.status === 'RUNNING');
    if (!hasRunning) return;
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, [liveTasks]);

  // Build a map of job name -> live task info (filter out old ARM exec format errors)
  const liveTaskMap = new Map<string, JobTask>();
  for (const task of liveTasks) {
    if (task.status === 'STOPPED' && task.exit_code === 255) continue; // skip ARM errors
    const name = jobNameFromTaskDef(task.task_definition);
    const existing = liveTaskMap.get(name);
    // Keep the most recent task per job
    if (!existing || (task.started_at && (!existing.started_at || task.started_at > existing.started_at))) {
      liveTaskMap.set(name, task);
    }
  }

  // Summary cards data
  const summaryCards = systemStatus ? [
    {
      title: 'Batch Jobs',
      status: systemStatus.jobs.status,
      icon: 'bi-gear',
      detail: systemStatus.jobs.running != null
        ? `${systemStatus.jobs.running} running, ${systemStatus.jobs.recent_failures ?? 0} failed`
        : systemStatus.jobs.detail ?? 'Unknown',
    },
    {
      title: 'API Services',
      status: systemStatus.apis.status,
      icon: 'bi-cloud',
      detail: systemStatus.apis.functions
        ? Object.entries(systemStatus.apis.functions).map(([k, v]) => `${k}: ${v.status}`).join(', ')
        : systemStatus.apis.detail ?? 'Unknown',
    },
    {
      title: 'Database',
      status: systemStatus.database.status,
      icon: 'bi-database',
      detail: systemStatus.database.detail ?? (systemStatus.database.status === 'ok' ? 'Connected' : 'Unknown'),
    },
  ] : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Operations Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            System health and batch job monitoring
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`}></i>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-4 rounded-lg mb-6 text-sm"
          style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}
        >
          <i className="bi bi-exclamation-triangle mr-2"></i>{error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !systemStatus && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 rounded-xl animate-pulse"
              style={{ background: 'var(--bg-secondary)', height: '120px' }}
            />
          ))}
        </div>
      )}

      {/* Summary Cards */}
      {systemStatus && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {summaryCards.map((card) => (
              <div
                key={card.title}
                className="p-6 rounded-xl"
                style={{
                  background: 'var(--bg-secondary)',
                  border: `1px solid ${statusColor(card.status)}40`,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <i className={`bi ${card.icon} text-lg`} style={{ color: statusColor(card.status) }}></i>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {card.title}
                    </span>
                  </div>
                  <StatusBadge status={card.status} />
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {card.detail}
                </p>
              </div>
            ))}
          </div>

          {/* Data Regeneration Quick Actions */}
          <DataRegenerationActions />

          {/* Job Status Grid */}
          <div className="mb-8">
            <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Batch Jobs
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {BATCH_JOBS.map((jobName) => {
                const history = jobHistory?.history[jobName];
                const lastRun = history?.runs?.[0];
                const hasRuns = (history?.run_count ?? 0) > 0;
                const liveTask = liveTaskMap.get(jobName);
                const isRunning = liveTask?.status === 'RUNNING';
                const isStopped = liveTask?.status === 'STOPPED';
                const hasCompleted = isStopped && (liveTask.exit_code === 0 || liveTask.exit_code == null);
                const hasFailed = isStopped && liveTask.exit_code != null && liveTask.exit_code !== 0;

                // Determine job status
                let jobStatus: HealthStatus | 'running' = 'unknown';
                if (isRunning) {
                  jobStatus = 'running';
                } else if (hasFailed || history?.error) {
                  jobStatus = 'error';
                } else if (hasCompleted || hasRuns) {
                  jobStatus = 'ok';
                }

                return (
                  <Link
                    key={jobName}
                    to={`/admin/operations/job/${jobName}`}
                    className="p-4 rounded-lg transition-all hover:scale-[1.02]"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: `1px solid ${statusColor(jobStatus)}30`,
                      textDecoration: 'none',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isRunning ? (
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse"
                            style={{ background: statusColor('running') }}
                          />
                        ) : (
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: statusColor(jobStatus) }}
                          />
                        )}
                        {isRunning && (
                          <span className="text-xs font-medium" style={{ color: statusColor('running') }}>
                            Running
                          </span>
                        )}
                        {hasFailed && (
                          <span className="text-xs font-medium" style={{ color: '#ef4444' }}>
                            Failed
                          </span>
                        )}
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {history?.run_count ?? 0} runs
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {jobName}
                    </p>
                    {/* Running duration */}
                    {isRunning && liveTask.started_at && (
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: statusColor('running') }}>
                        <i className="bi bi-clock"></i>
                        {formatDuration(liveTask.started_at)}
                      </p>
                    )}
                    {/* Completed successfully */}
                    {hasCompleted && liveTask.stopped_at && (
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#10b981' }}>
                        <i className="bi bi-check-circle"></i>
                        {formatDuration(liveTask.started_at!, liveTask.stopped_at)} &middot; {new Date(liveTask.stopped_at).toLocaleTimeString()}
                      </p>
                    )}
                    {/* Failed with exit code */}
                    {hasFailed && (
                      <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                        Exit code {liveTask.exit_code}
                        {liveTask.started_at && ` after ${formatDuration(liveTask.started_at, liveTask.stopped_at)}`}
                      </p>
                    )}
                    {/* Last successful run (only if not running/failed/just completed) */}
                    {!isRunning && !hasFailed && !hasCompleted && lastRun?.last_event && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Last: {new Date(lastRun.last_event).toLocaleDateString()}
                      </p>
                    )}
                    {/* Headline metrics from job_results */}
                    {(() => {
                      const jobResult = resultsSummary?.summary?.[jobName];
                      if (jobResult?.headline_metrics?.length) {
                        return (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {jobResult.headline_metrics.map((h) => (
                              <span
                                key={h.key}
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                                title={h.label}
                              >
                                {h.label}: <strong>{formatMetric(h.value, h.format)}</strong>
                              </span>
                            ))}
                            {jobResult.error_count > 0 && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded font-medium"
                                style={{ background: '#ef444420', color: '#ef4444' }}
                              >
                                {jobResult.error_count} error{jobResult.error_count !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {/* Job summary */}
                    {!resultsSummary?.summary?.[jobName]?.headline_metrics?.length && (history?.job_summary?.description || history?.last_message) && (
                      <p
                        className="text-xs mt-1.5 truncate"
                        style={{ color: history?.job_summary ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                        title={history?.job_summary?.description || history?.last_message || ''}
                      >
                        {history?.job_summary?.description || history?.last_message}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/admin/operations/logs"
              className="p-4 rounded-xl flex items-center gap-3 transition-all hover:scale-[1.02]"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              <i className="bi bi-terminal text-xl" style={{ color: 'var(--accent)' }}></i>
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Log Viewer</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Search and browse job logs</p>
              </div>
            </Link>
            <Link
              to="/admin/operations/alerts"
              className="p-4 rounded-xl flex items-center gap-3 transition-all hover:scale-[1.02]"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              <i className="bi bi-bell text-xl" style={{ color: 'var(--accent)' }}></i>
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Alert Configuration</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Manage email alerts for failures</p>
              </div>
            </Link>
            <Link
              to="/admin/operations/downloads"
              className="p-4 rounded-xl flex items-center gap-3 transition-all hover:scale-[1.02]"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              <i className="bi bi-download text-xl" style={{ color: 'var(--accent)' }}></i>
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Download Stats</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>CloudFront dataset downloads</p>
              </div>
            </Link>
            <Link
              to="/admin/media"
              className="p-4 rounded-xl flex items-center gap-3 transition-all hover:scale-[1.02]"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              <i className="bi bi-pencil-square text-xl" style={{ color: 'var(--accent)' }}></i>
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Content Management</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Media, reports, surveys</p>
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
