import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import type { TimelineDataPoint } from '../../types/event';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  granularity: 'year' | 'month';
}

function CustomTooltip({ active, payload, label, granularity }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const displayLabel = granularity === 'month'
      ? new Date(label + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      : label;

    return (
      <div className="violence-map-tooltip">
        <div className="font-medium mb-1" style={{ color: 'var(--violence-text-primary)' }}>
          {displayLabel}
        </div>
        <div className="text-sm" style={{ color: '#f97316' }}>
          {payload[0]?.value} incidents
        </div>
        <div className="text-sm" style={{ color: '#3b82f6' }}>
          {payload[1]?.value} fatalities
        </div>
      </div>
    );
  }
  return null;
}

interface TimelineProps {
  yearlyData: TimelineDataPoint[];
  monthlyData: TimelineDataPoint[];
}

export function Timeline({ yearlyData, monthlyData }: TimelineProps) {
  const [granularity, setGranularity] = useState<'year' | 'month'>('month');

  const data = granularity === 'year' ? yearlyData : monthlyData;

  // Calculate year range to determine tick interval
  const yearRange = (() => {
    if (data.length === 0) return { min: 0, max: 0, span: 0 };
    const years = data.map(d => {
      const year = granularity === 'month' ? parseInt(d.date.split('-')[0]) : parseInt(d.date);
      return year;
    });
    const min = Math.min(...years);
    const max = Math.max(...years);
    return { min, max, span: max - min + 1 };
  })();

  // Show every year if <= 15 years, otherwise every 5 years
  const yearInterval = yearRange.span <= 15 ? 1 : 5;

  const formatXAxis = (value: string) => {
    if (granularity === 'month') {
      const [year, month] = value.split('-');
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      // Show year for January, and only if it matches the interval
      if (monthNum === 1 && yearNum % yearInterval === 0) {
        return year;
      }
      return '';
    }
    // Yearly view
    const yearNum = parseInt(value);
    if (yearNum % yearInterval === 0) {
      return value;
    }
    return '';
  };

  return (
    <div className="violence-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--violence-text-muted)' }}>
          {granularity === 'year' ? 'Annual' : 'Monthly'} trend
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setGranularity('year')}
            className="text-xs px-3 py-1 rounded transition-colors"
            style={{
              background: granularity === 'year' ? 'var(--violence-bg-tertiary)' : 'transparent',
              color: granularity === 'year' ? 'var(--violence-text-primary)' : 'var(--violence-text-muted)',
              border: '1px solid ' + (granularity === 'year' ? 'var(--violence-border-light)' : 'transparent')
            }}
          >
            Yearly
          </button>
          <button
            onClick={() => setGranularity('month')}
            className="text-xs px-3 py-1 rounded transition-colors"
            style={{
              background: granularity === 'month' ? 'var(--violence-bg-tertiary)' : 'transparent',
              color: granularity === 'month' ? 'var(--violence-text-primary)' : 'var(--violence-text-muted)',
              border: '1px solid ' + (granularity === 'month' ? 'var(--violence-border-light)' : 'transparent')
            }}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradientCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradientKilled" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--violence-border)"
              strokeOpacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              stroke="var(--violence-text-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: 'var(--violence-border)' }}
              interval={0}
              tick={{ fill: 'var(--violence-text-muted)' }}
            />
            <YAxis
              stroke="var(--violence-text-muted)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={55}
              tick={{ fill: 'var(--violence-text-muted)' }}
              tickFormatter={(value) => value.toLocaleString()}
              label={{
                value: 'Number of',
                angle: -90,
                position: 'insideLeft',
                offset: 0,
                style: { fill: 'var(--violence-text-muted)', fontSize: 10, textAnchor: 'middle' }
              }}
            />
            <Tooltip content={<CustomTooltip granularity={granularity} />} />
            <Area
              type="monotone"
              dataKey="count"
              name="Incidents"
              stroke="#f97316"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#gradientCount)"
            />
            <Area
              type="monotone"
              dataKey="killed"
              name="Fatalities"
              stroke="#3b82f6"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#gradientKilled)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-6 mt-3 pt-3" style={{ borderTop: '1px solid var(--violence-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5" style={{ background: '#f97316' }} />
          <span className="text-xs" style={{ color: 'var(--violence-text-muted)' }}>Incidents</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5" style={{ background: '#3b82f6' }} />
          <span className="text-xs" style={{ color: 'var(--violence-text-muted)' }}>Fatalities</span>
        </div>
      </div>
    </div>
  );
}
