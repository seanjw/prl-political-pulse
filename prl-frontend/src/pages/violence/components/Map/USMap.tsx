import { useState, useMemo, useEffect, useRef, type MouseEvent } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup
} from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import type { PoliticalViolenceEvent, StateData } from '../../types/event';
import { getMarkerRadius, STATE_NAME_MAP, STATE_CENTERS } from '../../utils/mapUtils';

const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

interface USMapProps {
  events: PoliticalViolenceEvent[];
  stateData: StateData[];
  maxKilled: number;
  onEventClick: (event: PoliticalViolenceEvent) => void;
}

const DEFAULT_CENTER: [number, number] = [-96, 38];
const DEFAULT_ZOOM = 1;

export function USMap({ events, stateData, maxKilled, onEventClick }: USMapProps) {
  const [hoveredEvent, setHoveredEvent] = useState<PoliticalViolenceEvent | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [showMethodsModal, setShowMethodsModal] = useState(false);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMethodsModal(false);
    };
    if (showMethodsModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [showMethodsModal]);

  // Animation state - track year, month, and elapsed time
  const [currentDate, setCurrentDate] = useState<{ year: number; month: number; elapsedMs: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);

  // Get year range from events
  const yearRange = useMemo(() => {
    const years = events.map(e => e.year);
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [events]);

  const msPerYear = 3000; // 3 seconds per year for timeline playback

  const startAnimation = () => {
    if (isAnimating) {
      // Stop animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setIsAnimating(false);
      setCurrentDate(null);
      return;
    }

    setIsAnimating(true);
    setCurrentDate({ year: yearRange.min, month: 1, elapsedMs: 0 });
    const startTime = Date.now();
    const msPerMonth = msPerYear / 12;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const totalMonthsElapsed = Math.floor(elapsed / msPerMonth);
      const yearsElapsed = Math.floor(totalMonthsElapsed / 12);
      const monthInYear = (totalMonthsElapsed % 12) + 1;
      const newYear = yearRange.min + yearsElapsed;

      if (newYear <= yearRange.max) {
        setCurrentDate({ year: newYear, month: monthInYear, elapsedMs: elapsed });
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentDate(null);
        setIsAnimating(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Filter out events outside US projection bounds and sort by date
  const validEvents = useMemo(() => {
    const filtered = events.filter(e => {
      if (typeof e.latitude !== 'number' || typeof e.longitude !== 'number' ||
          isNaN(e.latitude) || isNaN(e.longitude)) return false;

      const isContiguousUS = e.latitude >= 24 && e.latitude <= 50 && e.longitude >= -125 && e.longitude <= -66;
      const isAlaska = e.latitude >= 51 && e.latitude <= 72 && e.longitude >= -180 && e.longitude <= -129;
      const isHawaii = e.latitude >= 18 && e.latitude <= 23 && e.longitude >= -161 && e.longitude <= -154;

      return isContiguousUS || isAlaska || isHawaii;
    });

    // Sort by date (earliest first)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.year, a.month - 1, a.day).getTime();
      const dateB = new Date(b.year, b.month - 1, b.day).getTime();
      return dateA - dateB;
    });
  }, [events]);

  const stateCountMap = useMemo(() => {
    const map = new Map<string, number>();
    stateData.forEach(s => {
      const abbr = STATE_NAME_MAP[s.name];
      if (abbr) map.set(abbr, s.count);
      map.set(s.name, s.count);
    });
    return map;
  }, [stateData]);

  const maxStateCount = useMemo(() => Math.max(...stateData.map(s => s.count), 1), [stateData]);

  const colorScale = useMemo(() => {
    return scaleLinear<string>()
      .domain([0, maxStateCount])
      .range(['rgba(88, 28, 135, 0.1)', 'rgba(147, 51, 234, 0.7)']);
  }, [maxStateCount]);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const getStateCount = (geo: { properties: { name: string } }): number => {
    return stateCountMap.get(geo.properties.name) || 0;
  };

  const handleStateClick = (stateName: string) => {
    const stateConfig = STATE_CENTERS[stateName];
    if (stateConfig) {
      if (selectedState === stateName) {
        // If clicking the same state, zoom out
        setSelectedState(null);
        setCenter(DEFAULT_CENTER);
        setZoom(DEFAULT_ZOOM);
      } else {
        setSelectedState(stateName);
        setCenter(stateConfig.center);
        setZoom(stateConfig.zoom);
      }
    }
  };

  const handleResetView = () => {
    setSelectedState(null);
    setCenter(DEFAULT_CENTER);
    setZoom(DEFAULT_ZOOM);
  };

  return (
    <div className="violence-card relative overflow-hidden h-full">
      <div className="h-full" onMouseMove={handleMouseMove} style={{ overflow: 'hidden' }}>
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 1100 }}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup center={center} zoom={zoom}>
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const count = getStateCount(geo);
                  const isHovered = hoveredState === geo.properties.name;
                  const isSelected = selectedState === geo.properties.name;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isSelected ? 'rgba(147, 51, 234, 0.5)' : colorScale(count)}
                      stroke={isSelected ? 'rgba(147, 51, 234, 0.8)' : 'var(--violence-map-stroke)'}
                      strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none', cursor: 'pointer', fill: 'rgba(147, 51, 234, 0.4)' },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={() => setHoveredState(geo.properties.name)}
                      onMouseLeave={() => setHoveredState(null)}
                      onClick={() => handleStateClick(geo.properties.name)}
                    />
                  );
                })
              }
            </Geographies>

            {validEvents.map((event) => {
              // Calculate visibility and animation state based on current date
              const eventYear = event.year;
              const eventMonth = event.month;
              const baseRadius = getMarkerRadius(event.total_killed, maxKilled);

              let opacity = 0.8;
              let radiusMultiplier = 1;
              let colorProgress = 1; // 0 = red, 1 = orange

              if (currentDate !== null) {
                // Calculate when this event appears in ms from animation start
                const eventMonthsFromStart = (eventYear - yearRange.min) * 12 + (eventMonth - 1);
                const eventAppearMs = eventMonthsFromStart * (msPerYear / 12);
                const msSinceAppear = currentDate.elapsedMs - eventAppearMs;

                if (msSinceAppear < 0) {
                  // Event hasn't happened yet - invisible
                  opacity = 0;
                  radiusMultiplier = 0;
                  colorProgress = 0;
                } else if (msSinceAppear <= 1000) {
                  // First 1 second - grow from 0 to 2x, stay red
                  opacity = 1;
                  radiusMultiplier = (msSinceAppear / 1000) * 2;
                  colorProgress = 0;
                } else if (msSinceAppear <= 2000) {
                  // Next 1 second - shrink from 2x to 1x, red to orange
                  opacity = 1;
                  const shrinkProgress = (msSinceAppear - 1000) / 1000;
                  radiusMultiplier = 2 - shrinkProgress;
                  colorProgress = shrinkProgress;
                } else {
                  // Event settled - final size and color
                  opacity = 0.8;
                  radiusMultiplier = 1;
                  colorProgress = 1;
                }
              }

              const displayRadius = baseRadius * radiusMultiplier;

              // Interpolate color from red (#ff0000) to orange (#f97316)
              const r = Math.round(255 - (255 - 249) * colorProgress);
              const g = Math.round(0 + (115 - 0) * colorProgress);
              const b = Math.round(0 + (22 - 0) * colorProgress);
              const fillColor = `rgb(${r}, ${g}, ${b})`;

              // Don't render if not visible
              if (opacity === 0) return null;

              return (
                <Marker
                  key={event.rowid}
                  coordinates={[event.longitude, event.latitude]}
                  onClick={() => onEventClick(event)}
                  onMouseEnter={() => setHoveredEvent(event)}
                  onMouseLeave={() => setHoveredEvent(null)}
                >
                  <circle
                    r={displayRadius}
                    fill={fillColor}
                    fillOpacity={opacity}
                    stroke="var(--violence-bg-primary)"
                    strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                  />
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Play Button and Year Tracker */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        {currentDate !== null && (
          <div
            className="text-2xl font-bold tabular-nums"
            style={{ color: 'var(--violence-text-primary)', fontFamily: 'Source Sans 3, sans-serif' }}
          >
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][currentDate.month - 1]} {currentDate.year}
          </div>
        )}
        <button
          onClick={startAnimation}
          className="flex items-center justify-center w-10 h-10 rounded-full transition-all hover:scale-110"
          style={{
            background: isAnimating ? 'var(--violence-accent)' : 'var(--violence-bg-tertiary)',
            border: '1px solid var(--violence-border)',
            color: isAnimating ? 'white' : 'var(--violence-text-primary)'
          }}
          title={isAnimating ? 'Stop animation' : 'Play timeline animation'}
        >
          {isAnimating ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* Tooltip */}
      {(hoveredEvent || hoveredState) && (
        <div
          className="violence-map-tooltip fixed z-50 pointer-events-none"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y + 12 }}
        >
          {hoveredEvent ? (
            <>
              <div className="font-medium" style={{ color: 'var(--violence-text-primary)' }}>
                {hoveredEvent.city}, {hoveredEvent.state}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--violence-text-muted)' }}>
                {hoveredEvent.year} · {hoveredEvent.attack_type}
              </div>
              {hoveredEvent.total_killed > 0 && (
                <div className="text-xs mt-1" style={{ color: 'var(--violence-accent)' }}>
                  {hoveredEvent.total_killed} fatalities
                </div>
              )}
            </>
          ) : (
            <>
              <div className="font-medium" style={{ color: 'var(--violence-text-primary)' }}>
                {hoveredState}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--violence-text-muted)' }}>
                {stateCountMap.get(hoveredState!) || 0} incidents
              </div>
            </>
          )}
        </div>
      )}

      {/* Reset View Button */}
      {selectedState && (
        <button
          onClick={handleResetView}
          className="absolute top-4 right-4 px-4 py-2 rounded text-sm font-medium transition-colors hover:bg-[var(--violence-border-light)]"
          style={{
            background: 'var(--violence-bg-tertiary)',
            border: '1px solid var(--violence-border)',
            color: 'var(--violence-text-primary)'
          }}
        >
          Reset View
        </button>
      )}

      {/* Selected State Label */}
      {selectedState && (
        <div
          className="absolute top-4 left-4 px-4 py-2 rounded text-sm"
          style={{
            background: 'rgba(147, 51, 234, 0.2)',
            border: '1px solid rgba(147, 51, 234, 0.5)',
            color: 'var(--violence-text-primary)'
          }}
        >
          <span style={{ color: 'var(--violence-text-muted)' }}>Viewing:</span> {selectedState}
        </div>
      )}

      {/* Legend */}
      <div
        className="absolute bottom-4 left-4 p-3 rounded text-xs"
        style={{ background: 'var(--violence-bg-secondary)', border: '1px solid var(--violence-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
      >
        <div className="mb-2" style={{ color: 'var(--violence-text-muted)' }}>Number of Incidents</div>
        <div className="flex items-center gap-1">
          <div className="w-16 h-2 rounded" style={{ background: 'linear-gradient(to right, rgba(88, 28, 135, 0.1), rgba(147, 51, 234, 0.7))' }} />
        </div>
        <div className="flex justify-between mt-1" style={{ color: 'var(--violence-text-muted)' }}>
          <span>Low</span>
          <span>High</span>
        </div>
        <div className="mt-3 pt-2" style={{ borderTop: '1px solid var(--violence-border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: '#f97316', opacity: 0.8 }} />
            <span style={{ color: 'var(--violence-text-muted)' }}>Individual incident</span>
          </div>
          <div className="mt-1" style={{ color: 'var(--violence-text-muted)' }}>Size = fatalities</div>
        </div>
      </div>

      {/* Methods and Data Link */}
      <button
        onClick={() => setShowMethodsModal(true)}
        className="absolute bottom-4 right-4 text-sm font-bold px-3 py-1.5 rounded transition-colors hover:underline"
        style={{ color: 'var(--violence-text-muted)' }}
      >
        Methods &amp; Data
      </button>

      {/* Methods Modal */}
      {showMethodsModal && (
        <>
          <div
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0, 0, 0, 0.6)' }}
            onClick={() => setShowMethodsModal(false)}
          />
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-lg shadow-xl"
            style={{ background: 'var(--violence-bg-secondary)', border: '1px solid var(--violence-border)' }}
          >
            <div className="sticky top-0 flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--violence-border)', background: 'var(--violence-bg-secondary)' }}>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--violence-text-primary)' }}>Methods &amp; Data</h2>
              <button
                onClick={() => setShowMethodsModal(false)}
                className="p-1 rounded hover:bg-[var(--violence-bg-tertiary)] transition-colors"
                style={{ color: 'var(--violence-text-muted)' }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6 text-sm" style={{ color: 'var(--violence-text-secondary)' }}>
              <section>
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--violence-text-primary)' }}>Maintained By</h3>
                <ul className="space-y-1">
                  <li><strong style={{ color: 'var(--violence-text-primary)' }}>Ellie Mitchell</strong> (Dartmouth)</li>
                  <li><strong style={{ color: 'var(--violence-text-primary)' }}>Derek Holliday</strong> (GWU)</li>
                  <li><strong style={{ color: 'var(--violence-text-primary)' }}>Sean J. Westwood</strong> (Dartmouth)</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--violence-text-primary)' }}>Data</h3>
                <p className="leading-relaxed mb-2">
                  Download the raw data file:
                </p>
                <a
                  href="/violence/events.json"
                  download="political_violence_events.json"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded transition-colors"
                  style={{ background: 'var(--violence-bg-tertiary)', color: 'var(--violence-text-primary)', border: '1px solid var(--violence-border)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Raw Data (JSON)
                </a>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--violence-text-primary)' }}>Data Sources</h3>
                <p className="leading-relaxed">
                  Data were obtained from the Global Terrorism Database (1970-2020) and the Prosecution Project (2020-present).
                  These sources were supplemented with additional high-profile recent acts of political violence that have not
                  yet resulted in prosecution (due to their recency).
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--violence-text-primary)' }}>Criteria for Event Inclusion</h3>
                <p className="leading-relaxed mb-3">
                  The dataset is limited to acts that took place within the United States and were perpetrated by U.S. nationals.
                  I followed the following rules to consolidate events:
                </p>
                <ul className="list-disc pl-5 space-y-2 mb-4">
                  <li>Multiple acts of violence committed by the same individual on the same day are included in one row. That row contains all relevant information for every event occurring that day.</li>
                  <li>If an individual commits two different types of crimes on the same day, these are coded as two distinct rows.</li>
                  <li>Serial incidents committed by the same individual on different days are coded as separate events.</li>
                </ul>
                <p className="leading-relaxed mb-3">
                  Only acts that meet our definition of violence are included in the dataset. This includes:
                </p>
                <ul className="list-disc pl-5 space-y-1 mb-4">
                  <li>Serious violent acts, such as assassinations and physical assaults</li>
                  <li>Less severe violent acts, such as pepper spraying or biting</li>
                  <li>Arson, which is considered a violent act</li>
                  <li>Threatening behavior involving a dangerous weapon</li>
                </ul>
                <p className="leading-relaxed mb-3">The following are <strong>not</strong> considered violence in this dataset:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Verbal or written threats</li>
                  <li>Plots that were disrupted before violent action could occur</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--violence-text-primary)' }}>Categorization of Political Violence</h3>
                <p className="leading-relaxed mb-3">
                  We used the following categorization to classify if something was specifically political violence:
                </p>
                <p className="leading-relaxed mb-3">
                  For each act of violence, coders answered the question: <em>"Is this action explicitly motivated by a politician, party, policy, or institution?"</em>
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm" style={{ border: '1px solid var(--violence-border)' }}>
                    <thead>
                      <tr style={{ background: 'var(--violence-bg-tertiary)' }}>
                        <th className="text-left p-2 font-medium" style={{ borderBottom: '1px solid var(--violence-border)', color: 'var(--violence-text-primary)' }}>Category</th>
                        <th className="text-left p-2 font-medium" style={{ borderBottom: '1px solid var(--violence-border)', color: 'var(--violence-text-primary)' }}>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2" style={{ borderBottom: '1px solid var(--violence-border)' }}>Politician/Party</td>
                        <td className="p-2" style={{ borderBottom: '1px solid var(--violence-border)' }}>Action explicitly motivated by politician or party</td>
                      </tr>
                      <tr>
                        <td className="p-2" style={{ borderBottom: '1px solid var(--violence-border)' }}>Government Policy</td>
                        <td className="p-2" style={{ borderBottom: '1px solid var(--violence-border)' }}>Action explicitly motivated by government policy</td>
                      </tr>
                      <tr>
                        <td className="p-2" style={{ borderBottom: '1px solid var(--violence-border)' }}>Government Agency</td>
                        <td className="p-2" style={{ borderBottom: '1px solid var(--violence-border)' }}>Action explicitly motivated by government democratic institutions/processes</td>
                      </tr>
                      <tr>
                        <td className="p-2">Unclear</td>
                        <td className="p-2">Cases where the motivation is unclear, inconclusive suggestion of partisan views, or non-political violence</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--violence-text-primary)' }}>Coding Guidelines</h3>
                <p className="leading-relaxed mb-3">
                  The coding schemes are meant to be strict tests of motivations. If a motivation is inconclusive, unclear,
                  or ambiguous, then it is not interpreted to fit a category.
                </p>
                <p className="leading-relaxed mb-3">
                  We are primarily interested in the <strong>motivation</strong> for violence. Who the victim is, where the act was committed,
                  and who the assailant might be are not conclusive evidence of motivation. Consider these examples:
                </p>
                <ul className="list-disc pl-5 space-y-2 mb-3 italic" style={{ color: 'var(--violence-text-muted)' }}>
                  <li>"A rock was thrown through a window of an abortion clinic in Houston, TX."</li>
                  <li>"A man who frequented right wing websites stabbed a man in the street."</li>
                </ul>
                <p className="leading-relaxed">
                  In both cases, while there is some partisan information available it is not sufficient to consider the violence
                  political. The first example is likely a protest of abortion policies, but this has to be inferred and is not
                  directly stated. Note that something being political is not sufficient to belong to a category; the motivation
                  must map cleanly on to Democratic/Republican divisions or be because of a specific government policy.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--violence-text-primary)' }}>Variables</h3>
                <p className="leading-relaxed">
                  All variables follow Global Terrorism Database instructions (found at{' '}
                  <a
                    href="https://www.start.umd.edu/sites/default/files/2024-10/Codebook.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-80"
                    style={{ color: 'var(--violence-accent)' }}
                  >
                    GTD Codebook
                  </a>
                  ), except for the <code className="px-1 py-0.5 rounded" style={{ background: 'var(--violence-bg-tertiary)' }}>prl_meta</code> variable,
                  which is coded as the output from the categorization above.
                </p>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
