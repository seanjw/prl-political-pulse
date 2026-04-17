import { Outlet } from 'react-router-dom';
import { AdminGuard } from './components/AdminGuard';
import { AdminSidebar } from './components/AdminSidebar';
import { AdminToast } from './components/AdminToast';
import { AdminToastProvider } from './context/AdminToastContext';
import { usePageTitle } from '../../hooks/usePageTitle';

export function Admin() {
  usePageTitle('Admin');

  return (
    <AdminToastProvider>
      <AdminGuard>
        <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
          <AdminSidebar />
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
        <AdminToast />
      </AdminGuard>
    </AdminToastProvider>
  );
}
