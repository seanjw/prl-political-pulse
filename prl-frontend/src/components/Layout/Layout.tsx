import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { StatsBar, type StatsVariant } from './StatsBar';
import { Footer } from './Footer';

interface LayoutProps {
  children: ReactNode;
}

function getStatsVariant(pathname: string): StatsVariant | null {
  // Home page
  if (pathname === '/') return 'home';

  // Citizens dashboards
  if (pathname === '/citizens' || pathname === '/citizens/values') return 'citizens';

  // International/Global dashboard
  if (pathname === '/citizens/international') return 'global';

  // Elites dashboard (includes all elites sub-routes)
  if (pathname.startsWith('/elites')) return 'elites';

  // All other pages don't show StatsBar
  return null;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const statsVariant = getStatsVariant(location.pathname);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      <Header />
      {statsVariant && <StatsBar variant={statsVariant} />}
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
