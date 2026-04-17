import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

interface GaugeChartProps {
  value: number;
  maxValue?: number;
  label: string;
  change?: number;
  color?: string;
  size?: 'small' | 'medium' | 'large';
  invertChangeColor?: boolean;
  horizontal?: boolean;
}

export function GaugeChart({
  value,
  maxValue = 100,
  label,
  change,
  color = '#2563eb',
  size = 'medium',
  invertChangeColor = false,
  horizontal = false
}: GaugeChartProps) {
  const percentage = (value / maxValue) * 100;

  const sizeClasses = {
    small: 'w-24 h-24',
    medium: 'w-32 h-32',
    large: 'w-28 h-28'
  };

  const positiveColor = invertChangeColor ? '#ef4444' : '#10b981';
  const negativeColor = invertChangeColor ? '#10b981' : '#ef4444';
  const changeColor = change && change > 0 ? positiveColor : change && change < 0 ? negativeColor : 'var(--text-muted)';
  const changeSymbol = change && change > 0 ? '+' : '';

  if (horizontal) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className={sizeClasses[size]} style={{ flexShrink: 0 }}>
          <CircularProgressbar
            value={percentage}
            text={`${value}%`}
            styles={buildStyles({
              textSize: '1.25rem',
              pathColor: color,
              textColor: 'var(--text-primary)',
              trailColor: 'var(--border)',
              pathTransitionDuration: 0.5,
            })}
          />
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
          {change !== undefined && (
            <div style={{ fontSize: '0.8rem', color: changeColor, fontWeight: 500 }}>
              {changeSymbol}{change.toFixed(1)}% from last month
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="gauge-chart-container">
      <div className={sizeClasses[size]}>
        <CircularProgressbar
          value={percentage}
          text={`${value}%`}
          styles={buildStyles({
            textSize: '1.25rem',
            pathColor: color,
            textColor: 'var(--text-primary)',
            trailColor: 'var(--border)',
            pathTransitionDuration: 0.5,
          })}
        />
      </div>
      <div className="gauge-chart-label">{label}</div>
      {change !== undefined && (
        <div className="gauge-chart-change" style={{ color: changeColor }}>
          {changeSymbol}{change.toFixed(1)}% from last month
        </div>
      )}
    </div>
  );
}
