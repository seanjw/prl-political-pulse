import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { useTheme } from '../../hooks/useTheme';

interface PartyLineChartProps {
  dates: string[];
  parties: string[];
  partyData: Record<string, (number | null)[]>;
  partyColors: Record<string, string>;
  height?: number;
  yAxisName?: string;
  yAxisMin?: number;
  yAxisMax?: number;
}

export function PartyLineChart({
  dates,
  parties,
  partyData,
  partyColors,
  height = 300,
  yAxisName = '% Supporting',
  yAxisMin = 0,
  yAxisMax,
}: PartyLineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const { isDarkMode } = useTheme();

  const textColor = isDarkMode ? '#e5e5e5' : '#333';
  const axisLineColor = isDarkMode ? '#555' : '#ccc';

  useEffect(() => {
    if (!chartRef.current || !dates || dates.length === 0) return;

    // Initialize or get chart instance
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // Build series for each party
    const series = parties.map(party => ({
      name: party,
      type: 'line' as const,
      data: partyData[party] || [],
      smooth: false,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        width: 2,
        color: partyColors[party] || '#666',
      },
      itemStyle: {
        color: partyColors[party] || '#666',
      },
      connectNulls: true,
    }));

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDarkMode ? '#333' : '#fff',
        borderColor: isDarkMode ? '#555' : '#ccc',
        textStyle: { color: textColor },
        formatter: (params: unknown) => {
          const items = params as Array<{ seriesName: string; value: number | null; color: string; axisValue: string }>;
          let result = `<strong>${items[0]?.axisValue}</strong><br/>`;
          items.forEach(item => {
            if (item.value !== null && item.value !== undefined) {
              result += `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.color};margin-right:5px;"></span>${item.seriesName}: ${item.value}%<br/>`;
            }
          });
          return result;
        },
      },
      legend: {
        data: parties,
        bottom: 0,
        textStyle: { color: textColor, fontSize: 12 },
        itemWidth: 20,
        itemHeight: 10,
      },
      grid: {
        top: 20,
        right: 20,
        bottom: 50,
        left: 50,
        containLabel: false,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: axisLineColor } },
        axisLabel: { color: textColor, fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: yAxisName,
        nameLocation: 'middle',
        nameGap: 35,
        nameTextStyle: { color: textColor, fontSize: 12 },
        min: yAxisMin,
        max: yAxisMax,
        axisLine: { show: false },
        axisLabel: { color: textColor, fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: axisLineColor, type: 'dashed' } },
      },
      series,
    };

    chartInstance.current.setOption(option, true);

    // Cleanup
    return () => {
      // Don't dispose here - just clear
    };
  }, [dates, parties, partyData, partyColors, isDarkMode, textColor, axisLineColor, yAxisName, yAxisMin, yAxisMax]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  if (!dates || dates.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No data available
      </div>
    );
  }

  return <div ref={chartRef} style={{ width: '100%', height }} />;
}
