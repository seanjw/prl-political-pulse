/** Format a metric value based on its type. */
export function formatMetric(value: number | null | undefined, format: string): string {
  if (value == null) return '—';

  switch (format) {
    case 'number':
      return value.toLocaleString();

    case 'bytes': {
      if (value < 1024) return `${value} B`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
      if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
      return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }

    case 'currency':
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    case 'duration': {
      if (value < 60) return `${Math.round(value)}s`;
      const minutes = Math.floor(value / 60);
      const seconds = Math.round(value % 60);
      if (minutes < 60) return `${minutes}m ${seconds}s`;
      const hours = Math.floor(minutes / 60);
      return `${hours}h ${minutes % 60}m`;
    }

    case 'percent':
      return `${value.toFixed(1)}%`;

    default:
      return String(value);
  }
}
