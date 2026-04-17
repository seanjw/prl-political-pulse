import { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import { useTheme } from '../../hooks/useTheme';

interface LineChartData {
  dates: string[];
  dems?: number[];
  reps?: number[];
  inds?: number[];
  values?: number[];
}

interface EChartsLineChartProps {
  data: LineChartData;
  height?: number;
  yAxisName?: string;
  yAxisMin?: number;
  yAxisMax?: number;
  yAxisLabels?: Record<number, string>;
  singleLine?: boolean;
  singleLineColor?: string;
  singleLineName?: string;
}

export function EChartsLineChart({
  data,
  height = 300,
  yAxisName,
  yAxisMin,
  yAxisMax,
  yAxisLabels,
  singleLine = false,
  singleLineColor = '#2563eb',
  singleLineName = 'Value'
}: EChartsLineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const { isDarkMode } = useTheme();

  // Theme-aware colors
  const textColor = isDarkMode ? '#e5e5e5' : '#333';
  const axisLineColor = isDarkMode ? '#555' : '#ccc';

  const downloadCSV = useCallback(() => {
    if (!data || !data.dates) return;

    let csvContent = 'Date';
    if (singleLine && data.values) {
      csvContent += `,${singleLineName}\n`;
      data.dates.forEach((date, i) => {
        csvContent += `${date},${data.values![i]}\n`;
      });
    } else {
      if (data.dems) csvContent += ',Democrats';
      if (data.reps) csvContent += ',Republicans';
      if (data.inds) csvContent += ',Independents';
      csvContent += '\n';

      data.dates.forEach((date, i) => {
        csvContent += date;
        if (data.dems) csvContent += `,${data.dems[i]}`;
        if (data.reps) csvContent += `,${data.reps[i]}`;
        if (data.inds) csvContent += `,${data.inds[i]}`;
        csvContent += '\n';
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'chart-data.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    setShowDropdown(false);
  }, [data, singleLine, singleLineName]);

  const downloadPNG = useCallback(() => {
    if (!chartInstance.current) return;
    const url = chartInstance.current.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff'
    });
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chart.png';
    link.click();
    setShowDropdown(false);
  }, []);

  useEffect(() => {
    if (!chartRef.current || !data) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // Build series array
    const seriesData: echarts.SeriesOption[] = [];

    // Custom formatter to show only the y-value (not the date)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const endLabelFormatter = (params: any) => {
      const value = Array.isArray(params.value) ? params.value[1] : params.value;
      return typeof value === 'number' ? value.toFixed(1) : String(value);
    };

    if (singleLine && data.values) {
      // Sort data by date to ensure endLabel appears at the rightmost point
      const sortedData = data.dates
        .map((date, index) => [date, data.values![index]] as [string, number])
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

      seriesData.push({
        data: sortedData,
        name: singleLineName,
        type: 'line',
        itemStyle: { color: singleLineColor },
        showSymbol: false,
        endLabel: {
          show: true,
          formatter: endLabelFormatter
        },
        labelLayout: { moveOverlap: 'shiftY' },
        emphasis: { focus: 'series' }
      });
    } else {
      if (data.dems) {
        seriesData.push({
          data: data.dates.map((date, index) => [date, data.dems![index]]),
          name: 'Democrats',
          type: 'line',
          itemStyle: { color: '#1874CD' },
          showSymbol: false,
          endLabel: {
            show: true,
            formatter: endLabelFormatter
          },
          labelLayout: { moveOverlap: 'shiftY' },
          emphasis: { focus: 'series' }
        });
      }
      if (data.reps) {
        seriesData.push({
          data: data.dates.map((date, index) => [date, data.reps![index]]),
          name: 'Republicans',
          type: 'line',
          itemStyle: { color: '#CD2626' },
          showSymbol: false,
          endLabel: {
            show: true,
            formatter: endLabelFormatter
          },
          labelLayout: { moveOverlap: 'shiftY' },
          emphasis: { focus: 'series' }
        });
      }
      if (data.inds) {
        seriesData.push({
          data: data.dates.map((date, index) => [date, data.inds![index]]),
          name: 'Independents',
          type: 'line',
          itemStyle: { color: '#6E6E6E' },
          showSymbol: false,
          endLabel: {
            show: true,
            formatter: endLabelFormatter
          },
          labelLayout: { moveOverlap: 'shiftY' },
          emphasis: { focus: 'series' }
        });
      }
    }

    const option: echarts.EChartsOption = {
      xAxis: {
        type: 'time',
        axisLabel: {
          hideOverlap: true,
          color: textColor
        },
        axisLine: { lineStyle: { color: axisLineColor } }
      },
      yAxis: {
        type: 'value',
        name: yAxisName,
        nameLocation: 'middle',
        nameTextStyle: {
          fontSize: 14,
          color: textColor,
          align: 'center',
          verticalAlign: 'middle'
        },
        nameRotate: 90,
        nameGap: yAxisLabels ? 80 : 40,
        min: yAxisMin ?? (yAxisLabels ? Math.min(...Object.keys(yAxisLabels).map(Number)) : undefined),
        max: yAxisMax ?? (yAxisLabels ? Math.max(...Object.keys(yAxisLabels).map(Number)) : undefined),
        interval: yAxisLabels ? 1 : undefined,
        axisLabel: yAxisLabels ? {
          formatter: (value: number) => yAxisLabels[value] || String(value),
          color: textColor
        } : { color: textColor },
        axisLine: { lineStyle: { color: axisLineColor } },
        splitLine: { lineStyle: { color: axisLineColor } }
      },
      grid: {
        containLabel: true,
        top: 20,
        bottom: 40,
        left: '10%',
        right: '10%'
      },
      tooltip: {
        trigger: 'axis',
        show: true,
        axisPointer: {
          type: 'line',
        }
      },
      legend: {
        bottom: 0,
        left: 'center',
        textStyle: { color: textColor }
      },
      series: seriesData
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data, yAxisName, yAxisMin, yAxisMax, yAxisLabels, singleLine, singleLineColor, singleLineName, textColor, axisLineColor]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false);
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdown]);

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
