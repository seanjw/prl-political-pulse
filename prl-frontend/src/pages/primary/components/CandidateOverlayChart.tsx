import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { PRIMARY_CATEGORIES, PRIMARY_CATEGORY_KEYS } from '../../../config/primaryCategories';
import type { PrimaryCandidate } from '../../../types/primary';

interface CandidateOverlayChartProps {
  candidates: PrimaryCandidate[];
  height?: number;
}

const CANDIDATE_COLORS_DEM = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];
const CANDIDATE_COLORS_REP = ['#dc2626', '#ef4444', '#f87171', '#fca5a5'];

export function CandidateOverlayChart({ candidates, height = 400 }: CandidateOverlayChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || candidates.length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const categories = PRIMARY_CATEGORY_KEYS.map((k) => PRIMARY_CATEGORIES[k].label);

    let demIdx = 0;
    let repIdx = 0;

    const series: echarts.BarSeriesOption[] = candidates.slice(0, 8).map((candidate) => {
      const isDem = candidate.party === 'Democrat';
      const color = isDem
        ? CANDIDATE_COLORS_DEM[demIdx++ % CANDIDATE_COLORS_DEM.length]
        : CANDIDATE_COLORS_REP[repIdx++ % CANDIDATE_COLORS_REP.length];
      return {
        name: candidate.name,
        type: 'bar',
        data: PRIMARY_CATEGORY_KEYS.map((k) => Math.round((candidate.rhetoric[k] || 0) * 100)),
        itemStyle: {
          color,
          opacity: 0.85,
          borderRadius: [2, 2, 0, 0],
        },
        emphasis: { itemStyle: { opacity: 1 } },
      };
    });

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: 'transparent',
        textStyle: { color: '#fff', fontSize: 12, fontFamily: "'Source Sans 3', sans-serif" },
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        textStyle: { color: 'var(--text-muted)', fontSize: 11, fontFamily: "'Source Sans 3', sans-serif" },
        pageTextStyle: { color: 'var(--text-muted)' },
        pageIconColor: 'var(--text-muted)',
        pageIconInactiveColor: 'var(--border)',
      },
      grid: { left: 10, right: 10, top: 15, bottom: 50, containLabel: true },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          color: 'var(--text-muted)',
          fontSize: 10,
          rotate: 35,
          interval: 0,
          fontFamily: "'Source Sans 3', sans-serif",
        },
        axisLine: { lineStyle: { color: 'var(--border)' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: '{value}%',
          color: 'var(--text-muted)',
          fontSize: 10,
          fontFamily: "'Source Sans 3', sans-serif",
        },
        splitLine: { lineStyle: { color: 'var(--border)', type: 'dashed' } },
        axisLine: { show: false },
      },
      series,
    };

    chartInstance.current.setOption(option, true);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [candidates]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  if (candidates.length === 0) {
    return (
      <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
        No candidates to compare.
      </div>
    );
  }

  return <div ref={chartRef} style={{ width: '100%', height }} />;
}
