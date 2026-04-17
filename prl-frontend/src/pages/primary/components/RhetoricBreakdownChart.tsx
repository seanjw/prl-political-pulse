import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { PRIMARY_CATEGORIES, PRIMARY_CATEGORY_KEYS } from '../../../config/primaryCategories';

interface RhetoricBreakdownChartProps {
  rhetoric: Record<string, number>;
  height?: number;
}

export function RhetoricBreakdownChart({ rhetoric, height = 300 }: RhetoricBreakdownChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const keys = [...PRIMARY_CATEGORY_KEYS].reverse();
    const categories = keys.map((k) => PRIMARY_CATEGORIES[k].label);
    const values = keys.map((k) => Math.round((rhetoric[k] || 0) * 100));
    const colors = keys.map((k) => PRIMARY_CATEGORIES[k].color);

    const option: echarts.EChartsOption = {
      grid: { left: 120, right: 60, top: 15, bottom: 15 },
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: { formatter: '{value}%', color: 'var(--text-muted)', fontSize: 10 },
        splitLine: { lineStyle: { color: 'var(--border)', type: 'dashed' } },
        axisLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: 'var(--text-secondary)', fontSize: 11, fontFamily: "'Source Sans 3', sans-serif" },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [{
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: { color: colors[i], borderRadius: [0, 3, 3, 0] },
        })),
        barWidth: 14,
        label: {
          show: true,
          position: 'right',
          formatter: '{c}%',
          fontSize: 11,
          fontWeight: 600,
          fontFamily: "'Source Sans 3', sans-serif",
          color: 'var(--text-muted)',
        },
      }],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const p = (params as Array<{ name: string; value: number }>)[0];
          return `<strong>${p.name}</strong><br/>${p.value}%`;
        },
      },
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [rhetoric]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  return <div ref={chartRef} style={{ width: '100%', height }} />;
}
