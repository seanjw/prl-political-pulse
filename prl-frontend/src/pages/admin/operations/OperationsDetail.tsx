import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getJobDetail, getJobHistory, getJobs, getJobResults, getJobResultLatest, triggerJob } from './monitoringApi';
import type { LogEvent, JobRun, JobTask, JobSummary, JobResult, StepResult, JobError } from './types';
import { TRIGGERABLE_JOBS } from './types';
import { MetricsCharts } from './MetricsCharts';
import { formatMetric } from './formatMetric';

/** Schedule descriptions for each job */
const JOB_META: Record<string, { schedule: string; description: string }> = {
  'floor-ingest':           { schedule: 'Daily at 5:20 AM UTC',        description: 'Ingests congressional floor speeches from official transcripts' },
  'twitter-ingest':         { schedule: 'Daily at 5:40 AM UTC',        description: 'Collects tweets from federal elected officials' },
  'twitter-media-ingest':   { schedule: 'Daily at 6:45 AM UTC',        description: 'Downloads media attachments from collected tweets' },
  'twitter-media-annotate': { schedule: 'Daily at 7:55 AM UTC',        description: 'Annotates tweet images using AI classification' },
  'rhetoric-classify':      { schedule: 'Daily at 4:00 AM UTC',        description: 'Classifies legislator rhetoric using NLP models' },
  'rhetoric-profile':       { schedule: 'Weekly (Sun) at 6:00 AM UTC', description: 'Generates rhetoric profiles per legislator' },
  'rhetoric-public-s3':     { schedule: 'Daily at 10:00 AM UTC',       description: 'Publishes classified rhetoric data to public S3' },
  'ideology-update':        { schedule: 'Weekly (Sun) at 6:00 AM UTC', description: 'Computes ideology scores from voting records' },
  'efficacy-update':        { schedule: 'Weekly (Sun) at 6:00 AM UTC', description: 'Computes legislative efficacy scores' },
  'attendance-update':      { schedule: 'Weekly (Sun) at 6:00 AM UTC', description: 'Updates roll call attendance records' },
  'money-update':           { schedule: 'Quarterly (Jan/Mar/Jun/Sep)', description: 'Updates campaign finance data from FEC filings' },
  'federal-update':         { schedule: 'Weekly (Sun) at 6:00 AM UTC', description: 'Syncs federal legislator data from official sources' },
  'twitter-ids-update':     { schedule: 'Weekly (Sun) at 8:00 AM UTC', description: 'Resolves and updates Twitter/X account IDs' },
  'state-sync':             { schedule: 'Weekly (Sat) at 7:00 AM UTC', description: 'Syncs state legislator data from OpenStates' },
  'state-update':           { schedule: 'Monthly (1st) at 7:00 AM UTC', description: 'Updates state legislator profiles and metadata' },
  'pulse-elites-update':    { schedule: 'Daily at 7:40 AM UTC',        description: 'Aggregates elite/legislator data for the dashboard' },
  'statements-ingest':      { schedule: 'Daily at 8:00 AM UTC',        description: 'Ingests press release URLs and scrapes their text' },
  'survey-upload':          { schedule: 'Daily at 9:00 AM UTC',        description: 'Exports US survey data to RDS and S3' },
  'toplines-generate':      { schedule: 'On survey-upload + on-demand', description: 'Generates survey topline PDFs from database' },
  'regenerate-data':        { schedule: 'On-demand',                   description: 'Rebuilds all-data.zip download dataset' },
  'challenger-sync':        { schedule: 'Weekly (Sun) at 3:00 AM UTC', description: 'Syncs challenger candidates from S3 CSV' },
  'challenger-twitter-ingest': { schedule: 'Daily at 10:00 AM UTC',   description: 'Collects tweets from challenger candidates' },
  'challenger-rhetoric-classify': { schedule: 'Daily at 12:00 PM UTC', description: 'Classifies challenger rhetoric using NLP' },
  'pulse-primary-update':   { schedule: 'Daily at 2:00 PM UTC',       description: 'Aggregates primary election data for dashboard' },
  'campaign-sites-crawl':   { schedule: 'Weekly (Sun) at 2:00 AM UTC', description: 'Crawls campaign & government websites for federal officials and challengers' },
  'campaign-sites-crawl-state': { schedule: 'Quarterly (Jan/Apr/Jul/Oct)', description: 'Crawls campaign & government websites for state officials' },
};

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

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  if (diff < 0) return 'just now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function jobNameFromTaskDef(taskDef: string): string {
  return taskDef.replace(/^prl-/, '').replace(/:\d+$/, '');
}

function ErrorViewer({ errors }: { errors: JobError[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="mb-6">
      <h2 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <i className="bi bi-exclamation-triangle" style={{ color: '#ef4444' }}></i>
        Errors ({errors.length})
      </h2>
      <div className="space-y-2">
        {errors.map((err, i) => (
          <div
            key={i}
            className="rounded-lg overflow-hidden"
            style={{ background: '#ef444410', border: '1px solid #ef444430' }}
          >
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left"
              style={{ background: 'transparent', border: 'none' }}
            >
              <i className={`bi ${expanded.has(i) ? 'bi-chevron-down' : 'bi-chevron-right'} mt-0.5`} style={{ color: '#ef4444' }}></i>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: '#ef4444' }}>
                  {err.message.length > 120 ? err.message.slice(0, 120) + '...' : err.message}
                </p>
                <div className="flex gap-3 mt-1">
                  {err.step && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Step: {err.step}
                    </span>
                  )}
                  {err.timestamp && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(err.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </button>
            {expanded.has(i) && err.traceback && (
              <pre
                className="px-4 pb-3 text-xs overflow-auto max-h-[300px]"
                style={{
                  fontFamily: '"SF Mono", "Fira Code", monospace',
                  color: '#ef4444',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {err.traceback}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface ProblemSite {
  source_type: string;
  source_id: string;
  name: string;
  site_url: string;
  issue: 'dead' | 'single_page';
  pages_crawled: number;
  error: string;
}

function ProblemSitesTable({ sites }: { sites: ProblemSite[] }) {
  const downloadCsv = () => {
    const header = 'source_type,source_id,name,site_url,issue,pages_crawled,error';
    const rows = sites.map(s =>
      [s.source_type, s.source_id, `"${s.name}"`, s.site_url, s.issue, s.pages_crawled, `"${s.error}"`].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'problem-sites.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const dead = sites.filter(s => s.issue === 'dead');
  const singlePage = sites.filter(s => s.issue === 'single_page');

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <i className="bi bi-exclamation-diamond" style={{ color: '#f59e0b' }}></i>
          Problem Sites ({sites.length})
        </h2>
        <button
          onClick={downloadCsv}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <i className="bi bi-download mr-1"></i>Download CSV
        </button>
      </div>
      {dead.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium mb-2" style={{ color: '#ef4444' }}>
            Dead Sites ({dead.length})
          </p>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)' }}>
                  <th className="text-left px-3 py-2" style={{ color: 'var(--text-muted)' }}>Name</th>
                  <th className="text-left px-3 py-2" style={{ color: 'var(--text-muted)' }}>Type</th>
                  <th className="text-left px-3 py-2" style={{ color: 'var(--text-muted)' }}>URL</th>
                  <th className="text-left px-3 py-2" style={{ color: 'var(--text-muted)' }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {dead.map((s, i) => (
                  <tr key={i} style={{ background: i % 2 ? 'var(--bg-secondary)' : 'var(--bg-primary)', borderTop: '1px solid var(--border)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{s.name}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{s.source_type}</td>
                    <td className="px-3 py-2">
                      <a href={s.site_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{s.site_url}</a>
                    </td>
                    <td className="px-3 py-2" style={{ color: '#ef4444' }}>{s.error.length > 80 ? s.error.slice(0, 80) + '...' : s.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {singlePage.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: '#f59e0b' }}>
            Single-Page Sites ({singlePage.length})
          </p>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)' }}>
                  <th className="text-left px-3 py-2" style={{ color: 'var(--text-muted)' }}>Name</th>
                  <th className="text-left px-3 py-2" style={{ color: 'var(--text-muted)' }}>Type</th>
                  <th className="text-left px-3 py-2" style={{ color: 'var(--text-muted)' }}>URL</th>
                  <th className="text-left px-3 py-2" style={{ color: 'var(--text-muted)' }}>Pages</th>
                </tr>
              </thead>
              <tbody>
                {singlePage.map((s, i) => (
                  <tr key={i} style={{ background: i % 2 ? 'var(--bg-secondary)' : 'var(--bg-primary)', borderTop: '1px solid var(--border)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{s.name}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{s.source_type}</td>
                    <td className="px-3 py-2">
                      <a href={s.site_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{s.site_url}</a>
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{s.pages_crawled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function OperationsDetail() {
  const { name } = useParams<{ name: string }>();
  const [recentLogs, setRecentLogs] = useState<LogEvent[]>([]);
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [runCount, setRunCount] = useState(0);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [jobSummary, setJobSummary] = useState<JobSummary | null>(null);
  const [liveTask, setLiveTask] = useState<JobTask | null>(null);
  const [jobResults, setJobResults] = useState<JobResult[]>([]);
  const [latestResult, setLatestResult] = useState<JobResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerToast, setTriggerToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, history, jobsResp, resultsResp, latestResp] = await Promise.all([
        getJobDetail(name),
        getJobHistory(),
        getJobs(),
        getJobResults(name, 30).catch(() => ({ job_name: name, results: [], days: 30 })),
        getJobResultLatest(name).catch(() => ({ job_name: name, result: null })),
      ]);
      setRecentLogs(detail.recent_logs);
      const jobHistory = history.history[name];
      if (jobHistory) {
        setRuns(jobHistory.runs);
        setRunCount(jobHistory.run_count);
        setLastMessage(jobHistory.last_message ?? null);
        setJobSummary(jobHistory.job_summary ?? null);
      }
      // Find the most recent live task for this job (skip ARM errors)
      const tasks = (jobsResp.jobs ?? [])
        .filter((t) => {
          const jn = jobNameFromTaskDef(t.task_definition);
          return jn === name && !(t.status === 'STOPPED' && t.exit_code === 255);
        })
        .sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''));
      setLiveTask(tasks[0] ?? null);
      setJobResults(resultsResp.results);
      setLatestResult(latestResp.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const meta = name ? JOB_META[name] : undefined;
  const isTriggerable = name ? TRIGGERABLE_JOBS.includes(name) : false;

  useEffect(() => {
    if (triggerToast) {
      const timer = setTimeout(() => setTriggerToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [triggerToast]);

  const handleTrigger = async () => {
    if (!name) return;
    if (!window.confirm(`Are you sure you want to run "${name}" now?`)) return;
    setTriggerLoading(true);
    try {
      const result = await triggerJob(name);
      setTriggerToast({ type: 'success', message: result.message + (result.task_arn ? ` (${result.task_arn.split('/').pop()})` : '') });
      // Refresh after a short delay to show the new task
      setTimeout(refresh, 3000);
    } catch (e) {
      setTriggerToast({ type: 'error', message: e instanceof Error ? e.message : 'Failed to trigger job' });
    } finally {
      setTriggerLoading(false);
    }
  };

  // Determine current status
  const isRunning = liveTask?.status === 'RUNNING';
  const isStopped = liveTask?.status === 'STOPPED';
  const hasCompleted = isStopped && (liveTask.exit_code === 0 || liveTask.exit_code == null);
  const hasFailed = isStopped && liveTask.exit_code != null && liveTask.exit_code !== 0;

  let statusLabel = 'Unknown';
  let statusColor = '#6b7280';
  let statusBg = '#6b728015';
  if (isRunning) {
    statusLabel = 'Running';
    statusColor = '#3b82f6';
    statusBg = '#3b82f615';
  } else if (hasCompleted) {
    statusLabel = 'Completed';
    statusColor = '#10b981';
    statusBg = '#10b98115';
  } else if (hasFailed) {
    statusLabel = 'Failed';
    statusColor = '#ef4444';
    statusBg = '#ef444415';
  } else if (runCount > 0) {
    statusLabel = 'Idle';
    statusColor = '#10b981';
    statusBg = '#10b98115';
  }

  // Compute last run duration from runs
  const lastRun = runs[0];
  const lastRunDuration = lastRun?.first_event
    ? formatDuration(lastRun.first_event, lastRun.last_event)
    : null;

  // Color log lines by content
  const logLineColor = (msg: string): string => {
    const lower = msg.toLowerCase();
    if (lower.includes('error') || lower.includes('traceback') || lower.includes('exception') || lower.includes('failed'))
      return '#ef4444';
    if (lower.includes('warn'))
      return '#f59e0b';
    if (lower.includes('done') || lower.includes('complete') || lower.includes('success') || lower.includes('finished'))
      return '#10b981';
    return 'var(--text-secondary)';
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/admin/operations"
          className="p-2 rounded-lg"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
        >
          <i className="bi bi-arrow-left text-lg"></i>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {name}
          </h1>
          {meta && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {meta.description}
            </p>
          )}
        </div>
        {isTriggerable && (
          <button
            onClick={handleTrigger}
            disabled={triggerLoading || isRunning}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            style={{
              background: '#059669',
              color: '#fff',
              opacity: triggerLoading || isRunning ? 0.7 : 1,
            }}
          >
            {triggerLoading ? (
              <><i className="bi bi-arrow-clockwise animate-spin"></i> Triggering...</>
            ) : (
              <><i className="bi bi-play-fill"></i> Run Now</>
            )}
          </button>
        )}
        <Link
          to={`/admin/operations/logs?job=${name}`}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            textDecoration: 'none',
          }}
        >
          <i className="bi bi-terminal mr-2"></i>Full Logs
        </Link>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`}></i>
          {' '}Refresh
        </button>
      </div>

      {error && (
        <div
          className="p-4 rounded-lg mb-6 text-sm"
          style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}
        >
          <i className="bi bi-exclamation-triangle mr-2"></i>{error}
        </div>
      )}

      {triggerToast && (
        <div
          className="p-4 rounded-lg mb-6 text-sm"
          style={{
            background: triggerToast.type === 'success' ? '#10b98120' : '#ef444420',
            color: triggerToast.type === 'success' ? '#10b981' : '#ef4444',
            border: `1px solid ${triggerToast.type === 'success' ? '#10b98140' : '#ef444440'}`,
          }}
        >
          <i className={`bi ${triggerToast.type === 'success' ? 'bi-check-circle' : 'bi-exclamation-triangle'} mr-2`}></i>
          {triggerToast.message}
        </div>
      )}

      {loading && !liveTask && runs.length === 0 && (
        <div
          className="p-12 rounded-xl text-center"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <i className="bi bi-arrow-clockwise animate-spin text-2xl mb-3 block" style={{ color: 'var(--text-muted)' }}></i>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading job details...
          </p>
        </div>
      )}

      {/* Status Cards */}
      {(liveTask || runCount > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Status */}
          <div className="p-4 rounded-xl" style={{ background: statusBg, border: `1px solid ${statusColor}30` }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Status</p>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'animate-pulse' : ''}`} style={{ background: statusColor }} />
              <span className="font-bold" style={{ color: statusColor }}>{statusLabel}</span>
            </div>
            {isRunning && liveTask?.started_at && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                for {formatDuration(liveTask.started_at)}
              </p>
            )}
            {hasFailed && (
              <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                Exit code {liveTask?.exit_code}
              </p>
            )}
          </div>

          {/* Last Run */}
          <div className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Last Run</p>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {lastRun ? timeAgo(lastRun.last_event) : '—'}
            </p>
            {lastRun && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {new Date(lastRun.last_event).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Duration */}
          <div className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Duration</p>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {liveTask?.started_at
                ? formatDuration(liveTask.started_at, liveTask.stopped_at)
                : lastRunDuration ?? '—'}
            </p>
            {meta && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                of last run
              </p>
            )}
          </div>

          {/* Runs & Schedule */}
          <div className="p-4 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Schedule</p>
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {runCount} runs
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {meta?.schedule ?? 'Last 30 days'}
            </p>
          </div>
        </div>
      )}

      {/* Last Summary */}
      {(jobSummary || lastMessage) && (
        <div
          className="p-4 rounded-xl mb-6 flex items-start gap-3"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <i className={`bi ${jobSummary ? 'bi-check2-circle' : 'bi-info-circle'} mt-0.5`} style={{ color: jobSummary ? '#10b981' : 'var(--accent)' }}></i>
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Last Output</p>
            {jobSummary ? (
              <>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {jobSummary.description}
                </p>
                {jobSummary.records_processed > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {jobSummary.records_processed.toLocaleString()} records processed
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-primary)', fontFamily: '"SF Mono", "Fira Code", monospace' }}>
                {lastMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Metrics Sparkline Charts */}
      {jobResults.length > 0 && <MetricsCharts results={jobResults} />}

      {/* Sub-steps Timeline */}
      {latestResult?.steps && latestResult.steps.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Sub-steps
          </h2>
          <div className="space-y-2">
            {(latestResult.steps as StepResult[]).map((step, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-lg"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
              >
                {step.status === 'success' ? (
                  <i className="bi bi-check-circle-fill" style={{ color: '#10b981' }}></i>
                ) : step.status === 'failure' ? (
                  <i className="bi bi-x-circle-fill" style={{ color: '#ef4444' }}></i>
                ) : (
                  <i className="bi bi-arrow-clockwise animate-spin" style={{ color: '#3b82f6' }}></i>
                )}
                <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {step.name.replace(/_/g, ' ')}
                </span>
                {step.duration_seconds != null && (
                  <span
                    className="text-sm px-2 py-0.5 rounded"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                  >
                    {formatMetric(step.duration_seconds, 'duration')}
                  </span>
                )}
                {step.error && (
                  <span className="text-xs" style={{ color: '#ef4444' }} title={step.error}>
                    {step.error.length > 60 ? step.error.slice(0, 60) + '...' : step.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Problem Sites (campaign site crawlers) */}
      {latestResult?.metrics && Array.isArray((latestResult.metrics as Record<string, unknown>).problem_sites_data) && (
        <ProblemSitesTable sites={(latestResult.metrics as Record<string, unknown>).problem_sites_data as ProblemSite[]} />
      )}

      {/* Error Viewer */}
      {latestResult?.errors && latestResult.errors.length > 0 && (
        <ErrorViewer errors={latestResult.errors as JobError[]} />
      )}

      {/* Run History */}
      {runs.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Run History
          </h2>
          <div className="space-y-2">
            {runs.map((run, i) => {
              const duration = run.first_event ? formatDuration(run.first_event, run.last_event) : '—';
              const runDate = new Date(run.last_event);
              const isToday = runDate.toDateString() === new Date().toDateString();

              return (
                <div
                  key={run.stream_name}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                  <span className="text-sm font-medium w-8" style={{ color: 'var(--text-muted)' }}>
                    #{i + 1}
                  </span>
                  <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>
                    {isToday ? 'Today' : runDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' '}
                    <span style={{ color: 'var(--text-muted)' }}>
                      {runDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </span>
                  <span
                    className="text-sm font-medium px-2 py-0.5 rounded"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                  >
                    {duration}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {timeAgo(run.last_event)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Logs */}
      {recentLogs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>
              Latest Output
            </h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {recentLogs.length} events (last 24h)
            </span>
          </div>
          <div
            className="rounded-xl overflow-auto max-h-[500px]"
            style={{ background: '#0d1117', border: '1px solid var(--border)' }}
          >
            <pre
              className="p-4 text-xs leading-relaxed"
              style={{
                fontFamily: '"SF Mono", "Fira Code", monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {recentLogs.map((event, i) => {
                if ('error' in event) {
                  return <span key={i} style={{ color: '#ef4444' }}>{(event as unknown as { error: string }).error}{'\n'}</span>;
                }
                return (
                  <span key={i}>
                    <span style={{ color: '#636c76' }}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    {'  '}
                    <span style={{ color: logLineColor(event.message) }}>
                      {event.message}
                    </span>
                    {'\n'}
                  </span>
                );
              })}
            </pre>
          </div>
        </div>
      )}

      {/* No data */}
      {!loading && recentLogs.length === 0 && runs.length === 0 && !liveTask && !error && (
        <div
          className="p-12 rounded-xl text-center"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <i className="bi bi-activity text-4xl mb-3 block" style={{ color: 'var(--text-muted)' }}></i>
          <p className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            No recent activity
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No log events in the last 24 hours for {name}.
          </p>
        </div>
      )}
    </div>
  );
}
