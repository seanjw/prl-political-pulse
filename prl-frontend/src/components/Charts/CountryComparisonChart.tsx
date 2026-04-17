import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface CountryData {
  country: string;
  data: number[];
  color: string;
}

interface CountryComparisonChartProps {
  labels: string[];
  countries: CountryData[];
  title?: string;
  yAxisLabel?: string;
  height?: number;
}

// Default country colors
const COUNTRY_COLORS: Record<string, string> = {
  'United States': '#2563eb',
  'Canada': '#dc2626',
  'United Kingdom': '#10b981',
  'Australia': '#f59e0b',
  'Germany': '#8b5cf6',
  'France': '#ec4899',
};

export function CountryComparisonChart({
  labels,
  countries,
  title,
  yAxisLabel,
  height = 350
}: CountryComparisonChartProps) {
  const data = {
    labels,
    datasets: countries.map(country => ({
      label: country.country,
      data: country.data,
      borderColor: country.color || COUNTRY_COLORS[country.country] || '#6b7280',
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 6,
      borderWidth: 2,
    }))
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'var(--text-secondary)',
          usePointStyle: true,
          padding: 15,
        }
      },
      title: {
        display: !!title,
        text: title,
        color: 'var(--text-primary)',
        font: {
          size: 16,
          weight: 'bold' as const,
        }
      },
      tooltip: {
        backgroundColor: 'var(--bg-secondary)',
        titleColor: 'var(--text-primary)',
        bodyColor: 'var(--text-secondary)',
        borderColor: 'var(--border)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      }
    },
    scales: {
      x: {
        grid: {
          color: 'var(--border)',
        },
        ticks: {
          color: 'var(--text-muted)',
        }
      },
      y: {
        grid: {
          color: 'var(--border)',
        },
        ticks: {
          color: 'var(--text-muted)',
        },
        title: {
          display: !!yAxisLabel,
          text: yAxisLabel,
          color: 'var(--text-secondary)',
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    }
  };

  return (
    <div style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
}
