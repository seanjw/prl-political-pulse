import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface DistributionChartProps {
  labels: string[];
  data: number[];
  title?: string;
  color?: string;
  height?: number;
}

export function DistributionChart({
  labels,
  data,
  title,
  color = '#2563eb',
  height = 200
}: DistributionChartProps) {
  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: color,
        borderRadius: 4,
        barThickness: 30,
      }
    ]
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: !!title,
        text: title,
        color: 'var(--text-primary)',
        font: {
          size: 14,
          weight: 'bold' as const,
        },
        align: 'start' as const,
      },
      tooltip: {
        backgroundColor: 'var(--bg-secondary)',
        titleColor: 'var(--text-primary)',
        bodyColor: 'var(--text-secondary)',
        borderColor: 'var(--border)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context: { parsed: { x: number | null } }) => `${context.parsed.x ?? 0}%`
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'var(--border)',
        },
        ticks: {
          color: 'var(--text-muted)',
          callback: (value: string | number) => `${value}%`
        },
        max: 100,
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          color: 'var(--text-secondary)',
        }
      }
    }
  };

  return (
    <div style={{ height }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
