import { useState, useMemo } from 'react';
import { USMap } from './components/Map/USMap';
import { Timeline } from './components/Charts/Timeline';
import { FilterPanel } from './components/Filters/FilterPanel';
import { DetailPanel } from './components/Details/DetailPanel';
import { useFilteredData } from './hooks/useFilteredData';
import type { PoliticalViolenceEvent, FilterState } from './types/event';
import eventsData from './data/events.json';
import './violence.css';
import { usePageTitle } from '../../hooks/usePageTitle';

export function Violence() {
  usePageTitle('American Political Violence');
  const [selectedEvent, setSelectedEvent] = useState<PoliticalViolenceEvent | null>(null);
  const events = eventsData as PoliticalViolenceEvent[];

  const { minYear, maxYear } = useMemo(() => {
    const years = events.map(e => e.year);
    return { minYear: Math.min(...years), maxYear: Math.max(...years) };
  }, [events]);

  const [filters, setFilters] = useState<FilterState>({
    prl_meta: [],
    sex: [],
    trans: null,
    race: [],
    yearRange: [minYear, maxYear],
    massCasualty: null,
    attackType: [],
    target: []
  });

  const uniqueRaces = useMemo(() => {
    const races = new Set(events.map(e => e.race).filter(r => r && r.trim()));
    return Array.from(races).sort();
  }, [events]);

  const uniqueAttackTypes = useMemo(() => {
    const types = new Set(events.map(e => e.attack_type).filter(t => t && t.trim()));
    return Array.from(types).sort();
  }, [events]);

  const uniqueTargets = useMemo(() => {
    const targets = new Set(events.map(e => e.target?.split(',')[0]?.trim()).filter(t => t && t.trim()));
    return Array.from(targets).sort();
  }, [events]);

  const { filteredEvents, stateData, timelineData, stats, maxKilled } = useFilteredData(events, filters);

  return (
    <div className="violence-dashboard">
      {/* Stats Bar */}
      <div className="border-b" style={{ borderColor: '#444444', background: '#2d2d2d' }}>
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 md:gap-8">
            <div>
              <div className="text-xl md:text-2xl font-light" style={{ color: '#ffffff' }}>{stats.totalEvents.toLocaleString()}</div>
              <div className="text-[10px] md:text-xs font-medium uppercase tracking-wide" style={{ color: '#a3a3a3' }}>Total Incidents</div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-light" style={{ color: '#ffffff' }}>{stats.totalKilled.toLocaleString()}</div>
              <div className="text-[10px] md:text-xs font-medium uppercase tracking-wide" style={{ color: '#a3a3a3' }}>Fatalities</div>
            </div>
            <div className="hidden sm:block">
              <div className="text-xl md:text-2xl font-light" style={{ color: '#ffffff' }}>{stats.topState}</div>
              <div className="text-[10px] md:text-xs font-medium uppercase tracking-wide" style={{ color: '#a3a3a3' }}>Most Affected State</div>
            </div>
            <div className="hidden md:block">
              <div className="text-xl md:text-2xl font-light" style={{ color: '#ffffff' }}>{stats.dateRange}</div>
              <div className="text-[10px] md:text-xs font-medium uppercase tracking-wide" style={{ color: '#a3a3a3' }}>Time Period</div>
            </div>
            <div className="hidden md:block">
              <div className="text-lg md:text-xl font-light" style={{ color: '#ffffff' }}>{stats.lastEvent}</div>
              <div className="text-[10px] md:text-xs font-medium uppercase tracking-wide" style={{ color: '#a3a3a3' }}>Last Incident</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-4">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Sidebar - Filters */}
          <aside className="lg:col-span-3">
            <FilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              uniqueRaces={uniqueRaces}
              uniqueAttackTypes={uniqueAttackTypes}
              uniqueTargets={uniqueTargets}
              minYear={minYear}
              maxYear={maxYear}
              events={filteredEvents}
            />
          </aside>

          {/* Main Area */}
          <div className="lg:col-span-9 flex flex-col gap-4" style={{ height: 'calc(100vh - 320px)', minHeight: '600px' }}>
            {/* Map */}
            <section className="flex-1 flex flex-col min-h-0" style={{ minHeight: '250px' }}>
              <div className="violence-section-header">Geographic Distribution</div>
              <div className="flex-1 min-h-0 h-full">
                <USMap
                  events={filteredEvents}
                  stateData={stateData}
                  maxKilled={maxKilled}
                  onEventClick={setSelectedEvent}
                />
              </div>
            </section>

            {/* Timeline */}
            <section className="flex-shrink-0" style={{ height: '320px', minHeight: '320px' }}>
              <div className="violence-section-header">Incidents Over Time</div>
              <Timeline
                yearlyData={timelineData.yearly}
                monthlyData={timelineData.monthly}
              />
            </section>
          </div>
        </div>
      </main>

      {/* Detail Panel */}
      {selectedEvent && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0, 0, 0, 0.6)' }}
            onClick={() => setSelectedEvent(null)}
          />
          <DetailPanel
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        </>
      )}
    </div>
  );
}
