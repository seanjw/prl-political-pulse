import { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import { PARTY_COLORS } from '../../config/elitesCategories';

interface PartyData {
  Democrat: number;
  Republican: number;
  Independent?: number;
}

interface ElitesPartyChartProps {
  data: PartyData;
  title?: string;
  height?: number;
}

export function ElitesPartyChart({
  data,
  title = 'Party Breakdown',
  height = 200
}: ElitesPartyChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const downloadCSV = useCallback(() => {
    let csvContent = 'Party,Percentage\n';
    csvContent += `Democrat,${data.Democrat}\n`;
    csvContent += `Republican,${data.Republican}\n`;
    if (data.Independent !== undefined) {
      csvContent += `Independent,${data.Independent}\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'party-breakdown.csv';
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
    link.download = 'party-chart.png';
    link.click();
    setShowDropdown(false);
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const categories = ['Democrat', 'Republican'];
    const values = [data.Democrat, data.Republican];
    const colors = [PARTY_COLORS.Democrat, PARTY_COLORS.Republican];

    if (data.Independent !== undefined && data.Independent > 0) {
      categories.push('Independent');
      values.push(data.Independent);
      colors.push(PARTY_COLORS.Independent);
    }

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const p = (params as { name: string; value: number }[])[0];
          return `${p.name}: ${p.value}%`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          color: 'var(--text-secondary)'
        },
        axisLine: {
          lineStyle: { color: 'var(--border)' }
        }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: '{value}%',
          color: 'var(--text-secondary)'
        },
        splitLine: {
          lineStyle: { color: 'var(--border)', opacity: 0.5 }
        }
      },
      series: [{
        name: title,
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: { color: colors[i] }
        })),
        barWidth: '50%',
        label: {
          show: true,
          position: 'top',
          formatter: '{c}%',
          color: 'var(--text-primary)',
          fontWeight: 'bold'
        }
      }]
    };

    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data, title]);

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
              onClick={(e) => { e.stopPropagation(); downloadCSV(); }}
              style={{
                width: '100%', padding: '8px 12px', border: 'none',
                background: 'transparent', cursor: 'pointer', textAlign: 'left',
                fontSize: '13px', color: 'var(--text-primary)'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Data (.csv)
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); downloadPNG(); }}
              style={{
                width: '100%', padding: '8px 12px', border: 'none',
                background: 'transparent', cursor: 'pointer', textAlign: 'left',
                fontSize: '13px', color: 'var(--text-primary)'
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
