import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { JobResult } from './types';
import { formatMetric } from './formatMetric';

interface MetricsChartsProps {
  results: JobResult[];
}

/** Sparkline grid showing numeric metrics over time. */
export function MetricsCharts({ results }: MetricsChartsProps) {
  if (results.length === 0) return null;

  // Collect all numeric metric keys across all results
  const metricKeys = new Set<string>();
  for (const r of results) {
    if (r.metrics) {
      for (const [k, v] of Object.entries(r.metrics)) {
        if (typeof v === 'number') metricKeys.add(k);
      }
    }
  }
  // Also include records_processed and duration_seconds
  metricKeys.add('records_processed');
  metricKeys.add('duration_seconds');

  if (metricKeys.size === 0) return null;

  // Build chart data (chronological order)
  const sorted = [...results].reverse();
  const chartData = sorted.map((r) => {
    const point: Record<string, unknown> = {
      date: r.started_at ? new Date(r.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
    };
    if (r.metrics) {
      for (const k of metricKeys) {
        if (k === 'records_processed') {
          point[k] = r.records_processed;
        } else if (k === 'duration_seconds') {
          point[k] = r.duration_seconds;
        } else {
          point[k] = (r.metrics as Record<string, unknown>)[k] ?? null;
        }
      }
    }
    return point;
  });

  // Determine format for each metric key from headline_metrics
  const formatMap: Record<string, string> = { duration_seconds: 'duration', records_processed: 'number' };
  for (const r of results) {
    if (r.headline_metrics) {
      for (const h of r.headline_metrics) {
        formatMap[h.key] = h.format;
      }
    }
  }

  // Format label
  const labelForKey = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const keys = Array.from(metricKeys);

  return (
    <div className="mb-6">
      <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        Metrics Trends
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {keys.map((key) => {
          const fmt = formatMap[key] || 'number';
          // Check if any data points have this metric
          const hasData = chartData.some((d) => d[key] != null && d[key] !== 0);
          if (!hasData && key !== 'records_processed' && key !== 'duration_seconds') return null;

          return (
            <div
              key={key}
              className="p-4 rounded-xl"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                {labelForKey(key)}
              </p>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={chartData}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number | undefined) => [formatMetric(value ?? null, fmt), labelForKey(key)]}
                    labelStyle={{ color: 'var(--text-muted)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey={key}
                    stroke="var(--accent, #3b82f6)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}
