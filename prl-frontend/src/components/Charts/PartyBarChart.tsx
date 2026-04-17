import { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import { useTheme } from '../../hooks/useTheme';

interface PartyBarChartProps {
  parties: string[];
  values: number[];
  partyColors: Record<string, string>;
  height?: number;
  xAxisName?: string;
  xAxisMax?: number;
  title?: string;
}

export function PartyBarChart({
  parties,
  values,
  partyColors,
  height = 280,
  xAxisName = '% Supporting',
  xAxisMax = 100,
  title = 'party-data',
}: PartyBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const { isDarkMode } = useTheme();

  const downloadCSV = useCallback(() => {
    if (!parties || parties.length === 0) return;

    let csvContent = 'Party,Value\n';
    parties.forEach((party, i) => {
      csvContent += `${party},${values[i]}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setShowDropdown(false);
  }, [parties, values, title]);

  const downloadPNG = useCallback(() => {
    if (!chartInstance.current) return;
    const url = chartInstance.current.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff'
    });
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.png`;
    link.click();
    setShowDropdown(false);
  }, [title]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false);
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdown]);

  const textColor = isDarkMode ? '#e5e5e5' : '#333';
  const axisLineColor = isDarkMode ? '#555' : '#ccc';

  useEffect(() => {
    if (!chartRef.current || !parties || parties.length === 0) return;

    // Initialize or get chart instance
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // Reverse arrays so largest sample size is at top
    const reversedParties = [...parties].reverse();
    const reversedValues = [...values].reverse();

    // Get colors for each party
    const barColors = reversedParties.map(party => partyColors[party] || '#666');

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: isDarkMode ? '#333' : '#fff',
        borderColor: isDarkMode ? '#555' : '#ccc',
        textStyle: { color: textColor },
        formatter: (params: unknown) => {
          const items = params as Array<{ name: string; value: number; color: string }>;
          const item = items[0];
          if (item && item.value !== null && item.value !== undefined) {
            return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.color};margin-right:5px;"></span>${item.name}: ${item.value}%`;
          }
          return '';
        },
      },
      grid: {
        top: 10,
        right: 20,
        bottom: 30,
        left: 10,
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: xAxisName,
        nameLocation: 'middle',
        nameGap: 20,
        nameTextStyle: { color: textColor, fontSize: 11 },
        min: 0,
        max: xAxisMax,
        axisLine: { lineStyle: { color: axisLineColor } },
        axisLabel: { color: textColor, fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { color: axisLineColor, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: reversedParties,
        axisLine: { show: false },
        axisLabel: { color: textColor, fontSize: 11 },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: reversedValues.map((value, index) => ({
            value,
            itemStyle: { color: barColors[index] },
          })),
          barWidth: '60%',
          label: {
            show: true,
            position: 'right',
            formatter: '{c}%',
            color: textColor,
            fontSize: 10,
          },
        },
      ],
    };

    chartInstance.current.setOption(option, true);

    return () => {
      // Don't dispose here - just clear
    };
  }, [parties, values, partyColors, isDarkMode, textColor, axisLineColor, xAxisName, xAxisMax]);

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

  if (!parties || parties.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No data available
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Download Dropdown Button */}
      <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 10 }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {showDropdown && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              minWidth: '120px'
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadCSV();
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                color: 'var(--text-primary)'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Data (.csv)
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadPNG();
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                color: 'var(--text-primary)'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Plot (.png)
            </button>
          </div>
        )}
      </div>
      <div ref={chartRef} style={{ width: '100%', height }} />
    </div>
  );
}
