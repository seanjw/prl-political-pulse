import type {
  SystemStatus,
  JobHistoryResponse,
  LogsResponse,
  ApiMetricsResponse,
  DbHealthResponse,
  AlertConfig,
  JobResultsSummary,
  JobResultsResponse,
  JobResultLatestResponse,
  DownloadStats,
} from './types';
import { getAdminPassword, handleUnauthorized } from '../utils/adminAuth';

const MONITORING_API_BASE = import.meta.env.DEV
  ? '/monitoring'
  : import.meta.env.VITE_MONITORING_API_URL;

async function monitoringFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${MONITORING_API_BASE}${path}`;
  const headers: Record<string, string> = {
    'x-admin-password': getAdminPassword(),
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Monitoring API error ${response.status}: ${body}`);
  }
  return response.json();
}

/** Get overall system status */
export function getSystemStatus(): Promise<SystemStatus> {
  return monitoringFetch('/status');
}

/** Get current ECS tasks */
export function getJobs(): Promise<{ jobs: import('./types').JobTask[] }> {
  return monitoringFetch('/status/jobs');
}

/** Get 30-day job run history */
export function getJobHistory(): Promise<JobHistoryResponse> {
  return monitoringFetch('/status/jobs/history');
}

/** Get detail for a specific job */
export function getJobDetail(name: string): Promise<{ job_name: string; recent_logs: import('./types').LogEvent[] }> {
  return monitoringFetch(`/status/jobs/${encodeURIComponent(name)}`);
}

/** Get paginated logs for a job */
export function getJobLogs(
  name: string,
  params: {
    search?: string;
    start_time?: string;
    end_time?: string;
    next_token?: string;
    limit?: number;
  } = {},
): Promise<LogsResponse> {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.start_time) searchParams.set('start_time', params.start_time);
  if (params.end_time) searchParams.set('end_time', params.end_time);
  if (params.next_token) searchParams.set('next_token', params.next_token);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  const qs = searchParams.toString();
  return monitoringFetch(`/status/jobs/${encodeURIComponent(name)}/logs${qs ? `?${qs}` : ''}`);
}

/** Get API metrics for all Lambda functions */
export function getApiMetrics(): Promise<ApiMetricsResponse> {
  return monitoringFetch('/status/api');
}

/** Get database health */
export function getDbHealth(): Promise<DbHealthResponse> {
  return monitoringFetch('/status/db');
}

/** Get alert configuration */
export function getAlertConfig(): Promise<AlertConfig> {
  return monitoringFetch('/status/alerts/config');
}

/** Update alert configuration */
export function updateAlertConfig(config: Partial<AlertConfig>): Promise<{ message: string; enabled: boolean }> {
  return monitoringFetch('/status/alerts/config', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

/** Send a test alert */
export function sendTestAlert(): Promise<{ message: string }> {
  return monitoringFetch('/status/alerts/test', {
    method: 'POST',
  });
}

/** Get latest headline metrics for all jobs */
export function getJobResultsSummary(): Promise<JobResultsSummary> {
  return monitoringFetch('/results/summary');
}

/** Get job results history for sparkline charts */
export function getJobResults(jobName: string, days = 30): Promise<JobResultsResponse> {
  return monitoringFetch(`/results/${encodeURIComponent(jobName)}?days=${days}`);
}

/** Get most recent result with full metrics, steps, errors */
export function getJobResultLatest(jobName: string): Promise<JobResultLatestResponse> {
  return monitoringFetch(`/results/${encodeURIComponent(jobName)}/latest`);
}

/** Trigger an on-demand job */
export function triggerJob(jobName: string): Promise<{ message: string; task_arn: string | null }> {
  return monitoringFetch(`/jobs/${encodeURIComponent(jobName)}/trigger`, { method: 'POST' });
}

/** Get the latest download stats aggregation */
export function getDownloadStats(): Promise<DownloadStats> {
  return monitoringFetch('/downloads/stats');
}

/** Trigger synchronous regeneration of download stats */
export function refreshDownloadStats(): Promise<{ ok: boolean; as_of: string | null }> {
  return monitoringFetch('/downloads/refresh', { method: 'POST' });
}
