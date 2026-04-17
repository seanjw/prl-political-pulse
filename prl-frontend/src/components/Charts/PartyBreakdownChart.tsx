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

interface PartyBreakdownChartProps {
  labels: string[];
  democratData: number[];
  republicanData: number[];
  title?: string;
  horizontal?: boolean;
  height?: number;
}

// Party colors from config
const COLORS = {
  democrat: '#1874CD',
  republican: '#CD2626',
};

export function PartyBreakdownChart({
  labels,
  democratData,
  republicanData,
  title,
  horizontal = false,
  height = 300
}: PartyBreakdownChartProps) {
  const data = {
    labels,
    datasets: [
      {
        label: 'Democrats',
        data: democratData,
        backgroundColor: COLORS.democrat,
        borderRadius: 4,
      },
      {
        label: 'Republicans',
        data: republicanData,
        backgroundColor: COLORS.republican,
        borderRadius: 4,
      }
    ]
  };

  const options = {
    indexAxis: horizontal ? 'y' as const : 'x' as const,
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
        }
      },
      y: {
        grid: {
          color: 'var(--border)',
        },
        ticks: {
          color: 'var(--text-muted)',
        }
      }
    }
  };

  return (
    <div style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  );
}
