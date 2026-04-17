import { useMemo } from 'react';
import type { PoliticalViolenceEvent, FilterState, StateData, TimelineDataPoint } from '../types/event';

export function useFilteredData(events: PoliticalViolenceEvent[], filters: FilterState) {
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Filter by year range
      if (event.year < filters.yearRange[0] || event.year > filters.yearRange[1]) {
        return false;
      }

      // Filter by prl_meta
      if (filters.prl_meta.length > 0 && !filters.prl_meta.includes(event.prl_meta)) {
        return false;
      }

      // Filter by sex
      if (filters.sex.length > 0 && !filters.sex.includes(event.sex)) {
        return false;
      }

      // Filter by trans
      if (filters.trans !== null) {
        const isTrans = event.trans === 1;
        if (filters.trans !== isTrans) return false;
      }

      // Filter by race
      if (filters.race.length > 0 && !filters.race.includes(event.race)) {
        return false;
      }

      // Filter by mass casualty (total_killed > 2)
      if (filters.massCasualty !== null) {
        const isMassCasualty = event.total_killed > 2;
        if (filters.massCasualty !== isMassCasualty) return false;
      }

      // Filter by attack type
      if (filters.attackType.length > 0 && !filters.attackType.includes(event.attack_type)) {
        return false;
      }

      // Filter by target (use first item if comma-separated)
      if (filters.target.length > 0) {
        const eventTarget = event.target?.split(',')[0]?.trim();
        if (!eventTarget || !filters.target.includes(eventTarget)) {
          return false;
        }
      }

      return true;
    });
  }, [events, filters]);

  const stateData = useMemo((): StateData[] => {
    const stateMap = new Map<string, StateData>();

    filteredEvents.forEach(event => {
      const state = event.state.split(',')[0].trim();
      const existing = stateMap.get(state);
      if (existing) {
        existing.count++;
        existing.killed += event.total_killed;
      } else {
        stateMap.set(state, {
          name: state,
          count: 1,
          killed: event.total_killed
        });
      }
    });

    return Array.from(stateMap.values());
  }, [filteredEvents]);

  const timelineData = useMemo((): { yearly: TimelineDataPoint[], monthly: TimelineDataPoint[] } => {
    // Yearly aggregation
    const yearMap = new Map<number, { count: number; killed: number }>();
    // Monthly aggregation
    const monthMap = new Map<string, { count: number; killed: number }>();

    filteredEvents.forEach(event => {
      // Yearly
      const existing = yearMap.get(event.year);
      if (existing) {
        existing.count++;
        existing.killed += event.total_killed;
      } else {
        yearMap.set(event.year, { count: 1, killed: event.total_killed });
      }

      // Monthly
      const monthKey = `${event.year}-${String(event.month).padStart(2, '0')}`;
      const existingMonth = monthMap.get(monthKey);
      if (existingMonth) {
        existingMonth.count++;
        existingMonth.killed += event.total_killed;
      } else {
        monthMap.set(monthKey, { count: 1, killed: event.total_killed });
      }
    });

    // Get year range from filters or data
    const years = filteredEvents.map(e => e.year);
    const minYear = years.length > 0 ? Math.min(...years) : 1970;
    const maxYear = years.length > 0 ? Math.max(...years) : 2023;

    // Fill in missing years
    for (let year = minYear; year <= maxYear; year++) {
      if (!yearMap.has(year)) {
        yearMap.set(year, { count: 0, killed: 0 });
      }
    }

    // Fill in all months for the year range
    for (let year = minYear; year <= maxYear; year++) {
      for (let month = 1; month <= 12; month++) {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, { count: 0, killed: 0 });
        }
      }
    }

    const yearly = Array.from(yearMap.entries())
      .map(([year, data]) => ({
        date: String(year),
        count: data.count,
        killed: data.killed
      }))
      .sort((a, b) => parseInt(a.date) - parseInt(b.date));

    const monthly = Array.from(monthMap.entries())
      .map(([date, data]) => ({
        date,
        count: data.count,
        killed: data.killed
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { yearly, monthly };
  }, [filteredEvents]);

  const stats = useMemo(() => {
    const totalKilled = filteredEvents.reduce((sum, e) => sum + e.total_killed, 0);
    const topState = stateData.reduce((max, s) => s.count > max.count ? s : max, { name: 'N/A', count: 0, killed: 0 });
    const years = filteredEvents.map(e => e.year);
    const minYear = years.length > 0 ? Math.min(...years) : 0;
    const maxYear = years.length > 0 ? Math.max(...years) : 0;

    // Find the most recent event
    const lastEvent = filteredEvents.length > 0
      ? filteredEvents.reduce((latest, e) => {
          const latestDate = new Date(latest.year, latest.month - 1, latest.day);
          const currentDate = new Date(e.year, e.month - 1, e.day);
          return currentDate > latestDate ? e : latest;
        })
      : null;

    const formatLastEvent = (event: typeof lastEvent) => {
      if (!event) return 'N/A';
      const date = new Date(event.year, event.month - 1, event.day);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return {
      totalEvents: filteredEvents.length,
      totalKilled,
      topState: topState.name,
      topStateCount: topState.count,
      dateRange: years.length > 0 ? `${minYear} - ${maxYear}` : 'N/A',
      lastEvent: formatLastEvent(lastEvent),
      lastEventLocation: lastEvent ? `${lastEvent.city}, ${lastEvent.state}` : 'N/A'
    };
  }, [filteredEvents, stateData]);

  const maxKilled = useMemo(() => {
    return Math.max(...filteredEvents.map(e => e.total_killed), 1);
  }, [filteredEvents]);

  return {
    filteredEvents,
    stateData,
    timelineData,
    stats,
    maxKilled
  };
}
