/** Health status indicator */
export type HealthStatus = 'ok' | 'degraded' | 'error' | 'unknown' | 'idle' | 'not_found';

/** Overall system status from /status */
export interface SystemStatus {
  status: HealthStatus;
  timestamp: string;
  jobs: {
    status: HealthStatus;
    running?: number;
    recent_failures?: number;
    detail?: string;
  };
  apis: {
    status: HealthStatus;
    functions?: Record<string, ApiStatus>;
    detail?: string;
  };
  database: {
    status: HealthStatus;
    detail?: string;
  };
}

export interface ApiStatus {
  status: string;
  errors_1h?: number;
  invocations_1h?: number;
  detail?: string;
}

/** ECS task from /status/jobs */
export interface JobTask {
  task_arn: string;
  task_definition: string;
  status: string;
  started_at: string | null;
  stopped_at: string | null;
  exit_code: number | null;
  stop_reason: string | null;
}

/** Job run from history log streams */
export interface JobRun {
  stream_name: string;
  first_event: string | null;
  last_event: string;
}

export interface JobSummary {
  records_processed: number;
  description: string;
  [key: string]: unknown;
}

export interface JobHistory {
  run_count: number;
  runs: JobRun[];
  last_message?: string | null;
  job_summary?: JobSummary | null;
  error?: string;
}

/** /status/jobs/history response */
export interface JobHistoryResponse {
  history: Record<string, JobHistory>;
  period_days: number;
}

/** Log event from /status/jobs/{name}/logs */
export interface LogEvent {
  timestamp: string;
  message: string;
  log_stream?: string;
}

export interface LogsResponse {
  events: LogEvent[];
  next_token: string | null;
  job_name: string;
  error?: string;
}

/** API metrics from /status/api */
export interface ApiMetricDatapoint {
  timestamp: string;
  sum: number | null;
  average: number | null;
}

export interface ApiFunctionMetrics {
  status: string;
  function_name?: string;
  metrics: {
    invocations?: ApiMetricDatapoint[];
    errors?: ApiMetricDatapoint[];
    duration?: ApiMetricDatapoint[];
  };
}

export interface ApiMetricsResponse {
  api_metrics: Record<string, ApiFunctionMetrics>;
}

/** Database health from /status/db */
export interface DbHealthResponse {
  status: HealthStatus;
  detail?: string;
  tables: Record<string, { row_count?: number; error?: string }>;
  timestamp?: string;
}

/** Alert config from /status/alerts/config */
export interface AlertConfig {
  configId: string;
  critical_jobs: string[];
  alert_emails: string[];
  enabled: boolean;
  updated_at?: string;
}

/** All known batch job names */
export const BATCH_JOBS = [
  'floor-ingest', 'twitter-ingest', 'twitter-media-ingest',
  'twitter-media-annotate', 'rhetoric-classify', 'rhetoric-profile',
  'rhetoric-public-s3', 'ideology-update', 'efficacy-update',
  'attendance-update', 'money-update', 'federal-update',
  'twitter-ids-update', 'state-sync', 'state-update',
  'pulse-elites-update', 'statements-ingest', 'survey-upload',
  'toplines-generate', 'regenerate-data',
  'challenger-sync', 'challenger-twitter-ingest', 'challenger-rhetoric-classify',
] as const;

export type BatchJobName = typeof BATCH_JOBS[number];

/** Jobs that can be triggered on-demand from the admin console */
export const TRIGGERABLE_JOBS: readonly string[] = [
  'toplines-generate',
  'regenerate-data',
  'rhetoric-public-s3',
  'survey-upload',
] as const;

/** Headline metric definition */
export interface HeadlineMetric {
  key: string;
  label: string;
  format: 'number' | 'bytes' | 'currency' | 'duration' | 'percent';
  value: number | null;
}

/** Sub-step result from a job run */
export interface StepResult {
  name: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  status: 'success' | 'failure' | 'running';
  metrics: Record<string, unknown>;
  error: string | null;
}

/** Error captured during a job run */
export interface JobError {
  message: string;
  traceback: string | null;
  step: string | null;
  timestamp: string;
}

/** A single job result row from operations.job_results */
export interface JobResult {
  id: number;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  status: 'running' | 'success' | 'failure' | 'partial';
  exit_code?: number | null;
  records_processed: number;
  error_count: number;
  errors?: JobError[] | null;
  metrics: Record<string, number | string | boolean> | null;
  headline_metrics: HeadlineMetric[] | null;
  steps?: StepResult[] | null;
}

/** Response from /results/summary */
export interface JobResultsSummary {
  summary: Record<string, {
    started_at: string | null;
    completed_at: string | null;
    duration_seconds: number | null;
    status: string;
    records_processed: number;
    error_count: number;
    headline_metrics: HeadlineMetric[] | null;
    metrics: Record<string, number | string | boolean> | null;
  }>;
}

/** Response from /results/{job_name} */
export interface JobResultsResponse {
  job_name: string;
  results: JobResult[];
  days: number;
}

/** Response from /results/{job_name}/latest */
export interface JobResultLatestResponse {
  job_name: string;
  result: JobResult | null;
}

/** Aggregated download statistics from CloudFront logs via Athena */
export interface DownloadStats {
  as_of: string;
  window_days: number;
  totals: {
    total_downloads: number;
    unique_ips: number;
    total_bytes: number;
  };
  by_file: Array<{
    uri: string;
    downloads: number;
    bytes: number;
  }>;
  by_month: Array<{
    month: string;
    downloads: number;
  }>;
  by_referrer: Array<{
    referrer: string;
    downloads: number;
  }>;
  by_country: Array<{
    country: string;
    downloads: number;
  }>;
}
