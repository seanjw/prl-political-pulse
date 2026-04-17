import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TimeSeriesData {
  label: string;
  data: number[];
  color: string;
  fill?: boolean;
}

interface TimeSeriesChartProps {
  labels: string[];
  datasets: TimeSeriesData[];
  title?: string;
  yAxisLabel?: string;
  height?: number;
}

export function TimeSeriesChart({
  labels,
  datasets,
  title,
  yAxisLabel,
  height = 300
}: TimeSeriesChartProps) {
  const data = {
    labels,
    datasets: datasets.map(ds => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.color,
      backgroundColor: ds.fill ? `${ds.color}20` : 'transparent',
      fill: ds.fill || false,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
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
          padding: 20,
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
          maxRotation: 45,
          minRotation: 0,
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
