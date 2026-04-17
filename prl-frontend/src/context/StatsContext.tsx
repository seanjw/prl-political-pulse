/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useStats } from '../hooks/useStats';
import type { Stats } from '../hooks/useStats';

interface StatsContextType {
  stats: Stats;
  loading: boolean;
  error: string | null;
}

const StatsContext = createContext<StatsContextType | null>(null);

export function StatsProvider({ children }: { children: ReactNode }) {
  const { stats, loading, error } = useStats();

  return (
    <StatsContext.Provider value={{ stats, loading, error }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useStatsContext() {
  const context = useContext(StatsContext);
  if (!context) {
    throw new Error('useStatsContext must be used within a StatsProvider');
  }
  return context;
}
