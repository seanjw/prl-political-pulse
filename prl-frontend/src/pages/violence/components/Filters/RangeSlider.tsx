import { useRef, useCallback } from 'react';

interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}

export function RangeSlider({ min, max, value, onChange }: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const getPercent = (val: number) => ((val - min) / (max - min)) * 100;

  const getValueFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current) return min;
    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(min + percent * (max - min));
  }, [min, max]);

  const handleMouseDown = (thumb: 'start' | 'end') => (e: React.MouseEvent) => {
    e.preventDefault();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newValue = getValueFromPosition(moveEvent.clientX);
      if (thumb === 'start') {
        onChange([Math.min(newValue, value[1]), value[1]]);
      } else {
        onChange([value[0], Math.max(newValue, value[0])]);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Generate ticks every 10 years
  const ticks: number[] = [];
  const startTick = Math.ceil(min / 10) * 10;
  for (let tick = startTick; tick <= max; tick += 10) {
    ticks.push(tick);
  }

  return (
    <div className="pt-1 pb-4">
      {/* Track container */}
      <div
        ref={trackRef}
        className="relative h-1 rounded cursor-pointer"
        style={{ background: 'var(--violence-border)' }}
        onClick={(e) => {
          const clickValue = getValueFromPosition(e.clientX);
          // Move the closest thumb
          const distToStart = Math.abs(clickValue - value[0]);
          const distToEnd = Math.abs(clickValue - value[1]);
          if (distToStart < distToEnd) {
            onChange([Math.min(clickValue, value[1]), value[1]]);
          } else {
            onChange([value[0], Math.max(clickValue, value[0])]);
          }
        }}
      >
        {/* Selected range highlight */}
        <div
          className="absolute h-full rounded"
          style={{
            left: `${getPercent(value[0])}%`,
            width: `${getPercent(value[1]) - getPercent(value[0])}%`,
            background: '#f97316'
          }}
        />

        {/* Start thumb */}
        <div
          className="absolute w-4 h-4 rounded-full cursor-grab active:cursor-grabbing"
          style={{
            left: `${getPercent(value[0])}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#f97316',
            border: '2px solid var(--violence-bg-secondary)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
          }}
          onMouseDown={handleMouseDown('start')}
        />

        {/* End thumb */}
        <div
          className="absolute w-4 h-4 rounded-full cursor-grab active:cursor-grabbing"
          style={{
            left: `${getPercent(value[1])}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#f97316',
            border: '2px solid var(--violence-bg-secondary)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
          }}
          onMouseDown={handleMouseDown('end')}
        />
      </div>

      {/* Tick marks */}
      <div className="relative mt-2" style={{ height: '20px' }}>
        {ticks.map(tick => (
          <div
            key={tick}
            className="absolute flex flex-col items-center"
            style={{
              left: `${getPercent(tick)}%`,
              transform: 'translateX(-50%)'
            }}
          >
            <div
              className="w-px h-2"
              style={{ background: 'var(--violence-border-light)' }}
            />
            <span
              className="text-xs mt-0.5"
              style={{ color: 'var(--violence-text-muted)', fontSize: '10px' }}
            >
              {tick}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
