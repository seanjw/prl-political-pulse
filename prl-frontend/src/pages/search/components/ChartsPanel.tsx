import { useRef, useState, useEffect, useCallback, forwardRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { Plugin } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { HistogramDataPoint, PartyTotals } from '../types';
import { PARTY_COLORS_DARK } from '../config';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ChartsPanelProps {
  histogramData: HistogramDataPoint[];
  partyTotals: PartyTotals | null;
  onDateRangeSelect?: (start: string, end: string) => void;
  onPartySelect?: (party: string) => void;
  currentStartDate?: string;
  currentEndDate?: string;
  searchTerm?: string;
}

export function ChartsPanel({ histogramData, partyTotals, onDateRangeSelect, onPartySelect, currentStartDate, currentEndDate, searchTerm }: ChartsPanelProps) {
  const histogramRef = useRef<ChartJS<'bar'>>(null);

  if (histogramData.length === 0 && !partyTotals) {
    return null;
  }

  // Download histogram as PNG
  const handleDownloadPng = () => {
    const chart = histogramRef.current;
    if (!chart) return;

    const link = document.createElement('a');
    link.download = `histogram-${searchTerm || 'search'}-${new Date().toISOString().split('T')[0]}.png`;
    link.href = chart.toBase64Image('image/png', 1);
    link.click();
  };

  // Generate title based on search term
  const histogramTitle = searchTerm
    ? `Occurrences of "${searchTerm}" Over Time`
    : 'Language Usage By Party Over Time';

  return (
    <div className="card charts-panel rounded-4 shadow-sm p-1 mb-3">
      <div className="card-body">
        {/* Histogram section */}
        {histogramData.length > 0 && (
          <div className="histogram-section">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">{histogramTitle}</h6>
              <div className="d-flex align-items-center gap-2">
                <small className="text-muted">Click and drag to select date range</small>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleDownloadPng}
                  title="Download as PNG"
                >
                  <i className="bi bi-download"></i>
                </button>
              </div>
            </div>
            <div className="histogram-canvas-container">
              <HistogramChart
                ref={histogramRef}
                data={histogramData}
                onDateRangeSelect={onDateRangeSelect}
                currentStartDate={currentStartDate}
                currentEndDate={currentEndDate}
              />
            </div>
          </div>
        )}

        {/* Party share section */}
        {partyTotals && (
          <div className="party-share-section mt-4">
            <h6 className="mb-2">Share By Party</h6>
            <div className="party-share-bar-container rounded-bar-container">
              <PartyShareChart totals={partyTotals} onPartySelect={onPartySelect} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface HistogramChartProps {
  data: HistogramDataPoint[];
  onDateRangeSelect?: (start: string, end: string) => void;
  currentStartDate?: string;
  currentEndDate?: string;
}

// Format month from "2017-07" to "Jul. 2017"
const MONTH_ABBREV = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-');
  const monthIndex = parseInt(monthNum, 10) - 1;
  return `${MONTH_ABBREV[monthIndex]} ${year}`;
}

// Get the month string (YYYY-MM) from a date string (YYYY-MM-DD)
function getMonthFromDate(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.substring(0, 7);
}

// Get the date range for a month
function getMonthDateRange(month: string): { start: string; end: string } {
  const [year, monthNum] = month.split('-');
  const startDate = `${year}-${monthNum}-01`;
  const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
  const endDate = `${year}-${monthNum}-${String(lastDay).padStart(2, '0')}`;
  return { start: startDate, end: endDate };
}

// Drag state interface
interface DragState {
  isDragging: boolean;
  dragStartIndex: number | null;
  dragEndIndex: number | null;
}

const HistogramChart = forwardRef<ChartJS<'bar'>, HistogramChartProps>(
  function HistogramChart({ data, onDateRangeSelect, currentStartDate, currentEndDate }, forwardedRef) {
  const internalRef = useRef<ChartJS<'bar'>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragStartIndex: null,
    dragEndIndex: null,
  });

  // Callback ref to sync forwarded ref with internal ref
  // react-chartjs-2 can return undefined, so handle that case
  const setChartRef = useCallback((chart: ChartJS<'bar'> | null | undefined) => {
    internalRef.current = chart ?? null;
    if (forwardedRef) {
      if (typeof forwardedRef === 'function') {
        forwardedRef(chart ?? null);
      } else {
        forwardedRef.current = chart ?? null;
      }
    }
  }, [forwardedRef]);

  // Use ref to store drag state for plugin access (avoids closure issues)
  const dragStateRef = useRef<DragState>(dragState);
  dragStateRef.current = dragState;

  // Keep raw month values for handlers
  const rawMonths = data.map(d => d.month);
  // Format labels for display
  const labels = rawMonths.map(formatMonthLabel);
  const demData = data.map(d => d.Democrat);
  const repData = data.map(d => d.Republican);
  const indData = data.map(d => d.Independent);

  // Calculate current selection indices from dates
  const currentStartMonth = getMonthFromDate(currentStartDate || '');
  const currentEndMonth = getMonthFromDate(currentEndDate || '');
  const currentStartIndex = rawMonths.indexOf(currentStartMonth);
  const currentEndIndex = rawMonths.indexOf(currentEndMonth);

  // Get bar index from mouse event
  const getBarIndexFromEvent = useCallback((event: MouseEvent): number | null => {
    const chart = internalRef.current;
    if (!chart) return null;

    const rect = chart.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;

    const xScale = chart.scales.x;
    if (!xScale) return null;

    // Check if x is within the chart area
    if (x < xScale.left || x > xScale.right) return null;

    // Calculate which bar we're over
    const barWidth = (xScale.right - xScale.left) / rawMonths.length;
    const index = Math.floor((x - xScale.left) / barWidth);

    return index >= 0 && index < rawMonths.length ? index : null;
  }, [rawMonths.length]);

  // Mouse event handlers
  const handleMouseDown = useCallback((event: MouseEvent) => {
    const index = getBarIndexFromEvent(event);
    if (index !== null) {
      setDragState({
        isDragging: true,
        dragStartIndex: index,
        dragEndIndex: index,
      });
    }
  }, [getBarIndexFromEvent]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    setDragState(prev => {
      if (!prev.isDragging) return prev;
      const index = getBarIndexFromEvent(event);
      if (index !== null && index !== prev.dragEndIndex) {
        return { ...prev, dragEndIndex: index };
      }
      return prev;
    });
  }, [getBarIndexFromEvent]);

  const handleMouseUp = useCallback(() => {
    setDragState(prev => {
      if (!prev.isDragging || prev.dragStartIndex === null || prev.dragEndIndex === null) {
        return { isDragging: false, dragStartIndex: null, dragEndIndex: null };
      }

      // Calculate the date range
      const startIdx = Math.min(prev.dragStartIndex, prev.dragEndIndex);
      const endIdx = Math.max(prev.dragStartIndex, prev.dragEndIndex);

      const startMonth = rawMonths[startIdx];
      const endMonth = rawMonths[endIdx];

      if (startMonth && endMonth && onDateRangeSelect) {
        const startRange = getMonthDateRange(startMonth);
        const endRange = getMonthDateRange(endMonth);
        onDateRangeSelect(startRange.start, endRange.end);
      }

      return { isDragging: false, dragStartIndex: null, dragEndIndex: null };
    });
  }, [rawMonths, onDateRangeSelect]);

  const handleMouseLeave = useCallback(() => {
    setDragState(prev => {
      if (prev.isDragging) {
        return { isDragging: false, dragStartIndex: null, dragEndIndex: null };
      }
      return prev;
    });
  }, []);

  // Attach mouse event listeners
  useEffect(() => {
    const canvas = internalRef.current?.canvas;
    if (!canvas) return;

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // Set cursor style
    // eslint-disable-next-line react-hooks/immutability
    canvas.style.cursor = 'crosshair';

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave]);

  // Update chart when drag state changes to show highlight
  useEffect(() => {
    if (internalRef.current) {
      internalRef.current.update('none'); // 'none' prevents animation
    }
  }, [dragState]);

  // Create highlight plugin
  const highlightPlugin: Plugin<'bar'> = {
    id: 'rangeHighlight',
    beforeDraw: (chart) => {
      const ctx = chart.ctx;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;

      if (!xScale || !yScale) return;

      const barWidth = (xScale.right - xScale.left) / rawMonths.length;

      // Draw current selection highlight (lighter)
      if (currentStartIndex >= 0 && currentEndIndex >= 0) {
        const selStartIdx = Math.min(currentStartIndex, currentEndIndex);
        const selEndIdx = Math.max(currentStartIndex, currentEndIndex);

        const x1 = xScale.left + selStartIdx * barWidth;
        const x2 = xScale.left + (selEndIdx + 1) * barWidth;

        ctx.save();
        ctx.fillStyle = 'rgba(100, 149, 237, 0.15)';
        ctx.fillRect(x1, yScale.top, x2 - x1, yScale.bottom - yScale.top);
        ctx.restore();
      }

      // Draw drag highlight with vertical bars
      const currentDragState = dragStateRef.current;
      if (currentDragState.isDragging && currentDragState.dragStartIndex !== null && currentDragState.dragEndIndex !== null) {
        const dragStartIdx = Math.min(currentDragState.dragStartIndex, currentDragState.dragEndIndex);
        const dragEndIdx = Math.max(currentDragState.dragStartIndex, currentDragState.dragEndIndex);

        // Calculate positions for the vertical bars
        const startBarX = xScale.left + currentDragState.dragStartIndex * barWidth + barWidth / 2;
        const endBarX = xScale.left + currentDragState.dragEndIndex * barWidth + barWidth / 2;

        const x1 = xScale.left + dragStartIdx * barWidth;
        const x2 = xScale.left + (dragEndIdx + 1) * barWidth;

        ctx.save();

        // Dim the areas outside the selection
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        // Left side (before selection)
        if (x1 > xScale.left) {
          ctx.fillRect(xScale.left, yScale.top, x1 - xScale.left, yScale.bottom - yScale.top);
        }
        // Right side (after selection)
        if (x2 < xScale.right) {
          ctx.fillRect(x2, yScale.top, xScale.right - x2, yScale.bottom - yScale.top);
        }

        // Highlight the selected area
        ctx.fillStyle = 'rgba(100, 149, 237, 0.2)';
        ctx.fillRect(x1, yScale.top, x2 - x1, yScale.bottom - yScale.top);

        // Draw fixed vertical bar at start position
        ctx.strokeStyle = 'rgba(13, 110, 253, 1)';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(startBarX, yScale.top);
        ctx.lineTo(startBarX, yScale.bottom);
        ctx.stroke();

        // Draw moving vertical bar at current drag position
        ctx.strokeStyle = 'rgba(13, 110, 253, 0.8)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]); // Dashed line for the moving bar
        ctx.beginPath();
        ctx.moveTo(endBarX, yScale.top);
        ctx.lineTo(endBarX, yScale.bottom);
        ctx.stroke();

        ctx.restore();
      }
    },
  };

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Democrat',
        data: demData,
        backgroundColor: PARTY_COLORS_DARK.Democrat,
        borderColor: PARTY_COLORS_DARK.Democrat,
        borderWidth: 0,
      },
      {
        label: 'Republican',
        data: repData,
        backgroundColor: PARTY_COLORS_DARK.Republican,
        borderColor: PARTY_COLORS_DARK.Republican,
        borderWidth: 0,
      },
      {
        label: 'Independent',
        data: indData,
        backgroundColor: PARTY_COLORS_DARK.Independent,
        borderColor: PARTY_COLORS_DARK.Independent,
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false,
        },
      },
      y: {
        stacked: true,
        grid: {
          color: 'rgba(0,0,0,0.08)',
        },
      },
    },
  };

  return (
    <div ref={containerRef} style={{ height: '100%' }}>
      <Bar ref={setChartRef} data={chartData} options={options} plugins={[highlightPlugin]} />
    </div>
  );
});

interface PartyShareChartProps {
  totals: PartyTotals;
  onPartySelect?: (party: string) => void;
}

function PartyShareChart({ totals, onPartySelect }: PartyShareChartProps) {
  const total = totals.Democrat + totals.Republican + totals.Independent;
  if (total === 0) return null;

  const demPercent = (totals.Democrat / total) * 100;
  const repPercent = (totals.Republican / total) * 100;
  const indPercent = (totals.Independent / total) * 100;

  const labelStyle: React.CSSProperties = {
    color: 'white',
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: '0 6px',
    lineHeight: '20px',
  };

  return (
    <div className="d-flex w-100 h-100" style={{ borderRadius: '6px', overflow: 'hidden' }}>
      {demPercent > 0 && (
        <div
          style={{
            width: `${demPercent}%`,
            backgroundColor: PARTY_COLORS_DARK.Democrat,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: demPercent > 10 ? 'center' : 'flex-start',
            cursor: onPartySelect ? 'pointer' : 'default',
          }}
          title={`Democrat: ${demPercent.toFixed(1)}%`}
          onClick={() => onPartySelect?.('Democrat')}
        >
          {demPercent > 5 && (
            <span style={labelStyle}>
              {demPercent > 15 ? `D ${demPercent.toFixed(0)}%` : `${demPercent.toFixed(0)}%`}
            </span>
          )}
        </div>
      )}
      {repPercent > 0 && (
        <div
          style={{
            width: `${repPercent}%`,
            backgroundColor: PARTY_COLORS_DARK.Republican,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: repPercent > 10 ? 'center' : 'flex-start',
            cursor: onPartySelect ? 'pointer' : 'default',
          }}
          title={`Republican: ${repPercent.toFixed(1)}%`}
          onClick={() => onPartySelect?.('Republican')}
        >
          {repPercent > 5 && (
            <span style={labelStyle}>
              {repPercent > 15 ? `R ${repPercent.toFixed(0)}%` : `${repPercent.toFixed(0)}%`}
            </span>
          )}
        </div>
      )}
      {indPercent > 0 && (
        <div
          style={{
            width: `${indPercent}%`,
            backgroundColor: PARTY_COLORS_DARK.Independent,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: indPercent > 10 ? 'center' : 'flex-start',
            cursor: onPartySelect ? 'pointer' : 'default',
          }}
          title={`Independent: ${indPercent.toFixed(1)}%`}
          onClick={() => onPartySelect?.('Independent')}
        >
          {indPercent > 5 && (
            <span style={labelStyle}>
              {indPercent > 15 ? `I ${indPercent.toFixed(0)}%` : `${indPercent.toFixed(0)}%`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
