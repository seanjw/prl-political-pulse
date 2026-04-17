import { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import { useTheme } from '../../hooks/useTheme';

interface DistributionBarChartProps {
  data: {
    categories: string[];
    all?: number[];
    dems?: number[];
    reps?: number[];
    inds?: number[];
  };
  height?: number;
  showLegend?: boolean;
  title?: string;
}

export function DistributionBarChart({
  data,
  height = 300,
  showLegend = true,
  title
}: DistributionBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const { isDarkMode } = useTheme();

  // Theme-aware colors
  const textColor = isDarkMode ? '#e5e5e5' : '#333';
  const axisLineColor = isDarkMode ? '#555' : '#ccc';

  const downloadCSV = useCallback(() => {
    if (!data || !data.categories) return;

    let csvContent = 'Response';
    if (data.all) csvContent += ',All';
    if (data.dems) csvContent += ',Democrats';
    if (data.reps) csvContent += ',Republicans';
    if (data.inds) csvContent += ',Independents';
    csvContent += '\n';

    data.categories.forEach((cat, i) => {
      csvContent += cat;
      if (data.all) csvContent += `,${data.all[i]}`;
      if (data.dems) csvContent += `,${data.dems[i]}`;
      if (data.reps) csvContent += `,${data.reps[i]}`;
      if (data.inds) csvContent += `,${data.inds[i]}`;
      csvContent += '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'distribution-data.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    setShowDropdown(false);
  }, [data]);

  const downloadPNG = useCallback(() => {
    if (!chartInstance.current) return;
    const url = chartInstance.current.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff'
    });
    const link = document.createElement('a');
    link.href = url;
    link.download = 'distribution-chart.png';
    link.click();
    setShowDropdown(false);
  }, []);

  useEffect(() => {
    if (!chartRef.current || !data) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const series: echarts.SeriesOption[] = [];

    if (data.dems) {
      series.push({
        name: 'Democrats',
        type: 'bar',
        data: data.dems,
        itemStyle: { color: '#1874CD' }
      });
    }
    if (data.inds) {
      series.push({
        name: 'Independents',
        type: 'bar',
        data: data.inds,
        itemStyle: { color: '#6E6E6E' }
      });
    }
    if (data.reps) {
      series.push({
        name: 'Republicans',
        type: 'bar',
        data: data.reps,
        itemStyle: { color: '#CD2626' }
      });
    }
    if (data.all && !data.dems && !data.reps) {
      series.push({
        name: 'All',
        type: 'bar',
        data: data.all,
        itemStyle: { color: '#2563eb' }
      });
    }

    const option: echarts.EChartsOption = {
      title: title ? {
        text: title,
        left: 'center',
        textStyle: { fontSize: 14, color: textColor }
      } : undefined,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      legend: showLegend ? {
        bottom: 0,
        left: 'center',
        textStyle: { color: textColor }
      } : undefined,
      grid: {
        left: '3%',
        right: '4%',
        bottom: showLegend ? 40 : 20,
        top: title ? 40 : 20,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.categories,
        axisLabel: {
          interval: 0,
          rotate: data.categories.length > 4 ? 30 : 0,
          fontSize: 11,
          color: textColor
        },
        axisLine: { lineStyle: { color: axisLineColor } }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          formatter: '{value}%',
          color: textColor
        },
        axisLine: { lineStyle: { color: axisLineColor } },
        splitLine: { lineStyle: { color: axisLineColor } }
      },
      series
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data, showLegend, title, textColor, axisLineColor]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false);
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdown]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
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
