import { useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as echarts from 'echarts';
import { PRIMARY_CATEGORIES, PRIMARY_CATEGORY_KEYS } from '../../../config/primaryCategories';
import type { PrimaryCandidate, PrimaryRace } from '../../../types/primary';

interface MiniRaceComparisonProps {
  currentCandidate: PrimaryCandidate;
  race: PrimaryRace;
  raceCandidates: PrimaryCandidate[];
}

export function MiniRaceComparison({ currentCandidate, race, raceCandidates }: MiniRaceComparisonProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const displayCandidates = useMemo(() => {
    const withData = raceCandidates.filter((c) => c.rhetoric_data_available);
    const currentHasData = currentCandidate.rhetoric_data_available;
    const others = withData
      .filter((c) => c.candidate_id !== currentCandidate.candidate_id)
      .slice(0, 4);
    return currentHasData ? [currentCandidate, ...others] : others;
  }, [raceCandidates, currentCandidate]);

  useEffect(() => {
    if (!chartRef.current || displayCandidates.length < 2) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const categories = PRIMARY_CATEGORY_KEYS.map((k) => PRIMARY_CATEGORIES[k].label);

    const series: echarts.BarSeriesOption[] = displayCandidates.map((c, idx) => {
      const isCurrentCandidate = c.candidate_id === currentCandidate.candidate_id;
      const partyColor = c.party === 'Democrat' ? '#2563eb' : '#dc2626';
      return {
        name: c.name,
        type: 'bar',
        data: PRIMARY_CATEGORY_KEYS.map((k) => Math.round((c.rhetoric[k] || 0) * 100)),
        itemStyle: {
          color: isCurrentCandidate ? '#f59e0b' : partyColor,
          opacity: isCurrentCandidate ? 1 : 0.35,
          borderRadius: [2, 2, 0, 0],
        },
        emphasis: { itemStyle: { opacity: 1 } },
        z: isCurrentCandidate ? 10 : idx,
      };
    });

    const option: echarts.EChartsOption = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: {
        bottom: 0,
        textStyle: { color: 'var(--text-muted)', fontSize: 10 },
        pageTextStyle: { color: 'var(--text-muted)' },
      },
      grid: { left: 10, right: 10, top: 10, bottom: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: 'var(--text-muted)', fontSize: 9, rotate: 40, interval: 0 },
        axisLine: { lineStyle: { color: 'var(--border)' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: '{value}%', color: 'var(--text-muted)', fontSize: 10 },
        splitLine: { lineStyle: { color: 'var(--border)' } },
      },
      series,
    };

    chartInstance.current.setOption(option, true);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [displayCandidates, currentCandidate.candidate_id]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  if (raceCandidates.length < 2) return null;

  return (
    <div style={{ border: '1px solid var(--border)' }}>
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h4
          className="text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--text-muted)' }}
        >
          In This Race
        </h4>
        <Link
          to={`/primary/race/${race.race_id}`}
          className="text-[10px] font-semibold hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Full race &rarr;
        </Link>
      </div>
      <div className="px-3 py-1.5 text-xs" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>
        {race.display_name} &middot; {raceCandidates.length} candidates
      </div>
      <div className="p-3">
        <div ref={chartRef} style={{ width: '100%', height: 220 }} />
      </div>
    </div>
  );
}
