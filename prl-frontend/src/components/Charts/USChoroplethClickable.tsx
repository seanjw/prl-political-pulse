import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as echarts from 'echarts';
import { geoAlbersUsa } from 'd3-geo';

interface StateDataItem {
  name: string;
  value: number;
}

interface USChoroplethClickableProps {
  data: StateDataItem[];
  tooltipTitle?: string;
  height?: number;
  colorScale?: string[];
  onStateClick?: (stateName: string) => void;
  navigateToProfiles?: boolean;
}

// Map full state names to abbreviations
const STATE_ABBREV: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
  'District of Columbia': 'DC', 'Puerto Rico': 'PR'
};

export function USChoroplethClickable({
  data,
  tooltipTitle = 'Value',
  height = 400,
  colorScale = [
    '#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe',
    '#c084fc', '#a855f7', '#9333ea', '#7e22ce', '#581c87'
  ],
  onStateClick,
  navigateToProfiles = true
}: USChoroplethClickableProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  const downloadCSV = useCallback(() => {
    if (!data || data.length === 0) return;

    let csvContent = `State,${tooltipTitle}\n`;
    data.forEach((item) => {
      csvContent += `${item.name},${item.value}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'map-data.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    setShowDropdown(false);
  }, [data, tooltipTitle]);

  const downloadPNG = useCallback(() => {
    if (!chartInstance.current) return;
    const url = chartInstance.current.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff'
    });
    const link = document.createElement('a');
    link.href = url;
    link.download = 'map.png';
    link.click();
    setShowDropdown(false);
  }, []);

  const handleStateClick = useCallback((stateName: string) => {
    if (onStateClick) {
      onStateClick(stateName);
    } else if (navigateToProfiles) {
      const stateAbbrev = STATE_ABBREV[stateName];
      if (stateAbbrev) {
        navigate(`/elites/profiles?state=${stateAbbrev}`);
      }
    }
  }, [onStateClick, navigateToProfiles, navigate]);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    const initChart = async () => {
      try {
        const response = await fetch('/geo/USA.json');
        const usaJson = await response.json();
        echarts.registerMap('USA', usaJson);

        const projection = geoAlbersUsa();

        if (!chartInstance.current) {
          chartInstance.current = echarts.init(chartRef.current, null, {
            useDirtyRect: false
          });
        }

        const adjustHeight = () => {
          if (chartRef.current) {
            const width = chartRef.current.offsetWidth;
            const newHeight = width * 0.65;
            chartRef.current.style.height = `${newHeight}px`;
            chartInstance.current?.resize();
          }
        };

        adjustHeight();

        const values = data.map(item => item.value);
        const rangeVal = Math.max(...values) - Math.min(...values);
        const minValue = Math.min(...values) - (rangeVal * 0.1);
        const maxValue = Math.max(...values) + (rangeVal * 0.1);

        const option: echarts.EChartsOption = {
          tooltip: {
            trigger: 'item',
            showDelay: 0,
            transitionDuration: 0.2,
            formatter: (params: unknown) => {
              const p = params as { name: string; value: number };
              return `<strong>${p.name}</strong><br/>${tooltipTitle}: ${typeof p.value === 'number' ? p.value.toFixed(1) : 'N/A'}%<br/><em style="font-size:11px;color:#666">Click to view legislators</em>`;
            }
          },
          visualMap: {
            show: false,
            min: minValue,
            max: maxValue,
            inRange: { color: colorScale },
            calculable: true
          },
          series: [{
            name: tooltipTitle,
            type: 'map',
            map: 'USA',
            selectedMode: false,
            projection: {
              project: (point: number[]) => projection(point as [number, number]) as [number, number],
              unproject: (point: number[]) => projection.invert?.(point as [number, number]) as [number, number]
            },
            emphasis: {
              itemStyle: {
                areaColor: '#333',
                borderColor: '#fff',
                borderWidth: 2
              },
              label: {
                show: false
              }
            },
            itemStyle: {
              borderColor: 'rgb(200,200,200)',
              borderWidth: 1
            },
            data: data,
            left: 0,
            right: 0,
            top: 20,
            bottom: 0,
          }]
        };

        chartInstance.current.setOption(option);

        // Add click handler
        chartInstance.current.on('click', (params) => {
          if (params.componentType === 'series' && params.name) {
            handleStateClick(params.name);
          }
        });

        // Add cursor pointer on hover
        chartInstance.current.on('mouseover', () => {
          if (chartRef.current) {
            chartRef.current.style.cursor = 'pointer';
          }
        });

        chartInstance.current.on('mouseout', () => {
          if (chartRef.current) {
            chartRef.current.style.cursor = 'default';
          }
        });

        setTimeout(() => {
          chartInstance.current?.resize();
          adjustHeight();
        }, 100);

        const handleResize = () => adjustHeight();
        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
        };

      } catch (error) {
        console.error('Failed to load US map:', error);
      }
    };

    initChart();
  }, [data, tooltipTitle, colorScale, handleStateClick]);

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
    <div style={{ position: 'relative', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
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
