import { Link, useLocation } from 'react-router-dom';
import { useAdminLogout } from './AdminGuard';

const navItems = [
  { path: '/admin', label: 'Operations', icon: 'bi-activity', exact: true },
  { path: '/admin/operations/logs', label: 'Logs', icon: 'bi-terminal' },
  { path: '/admin/operations/alerts', label: 'Alerts', icon: 'bi-bell' },
  { path: '/admin/media', label: 'Media Mentions', icon: 'bi-newspaper' },
  { path: '/admin/reports', label: 'Reports', icon: 'bi-file-text' },
  { path: '/admin/surveys', label: 'Survey Upload', icon: 'bi-cloud-upload' },
  { path: '/admin/press-urls', label: 'Press URLs', icon: 'bi-link-45deg' },
  { path: '/admin/state-legislators', label: 'State Legislators', icon: 'bi-building' },
  { path: '/admin/primaries', label: 'Primary Winners', icon: 'bi-trophy' },
  { path: '/admin/violence', label: 'Violence Events', icon: 'bi-exclamation-triangle' },
  { path: '/admin/team', label: 'Team', icon: 'bi-people' },
  { path: '/admin/profile', label: 'Profile', icon: 'bi-person' },
  { path: '/admin/logs', label: 'Error Log', icon: 'bi-bug' },
];

export function AdminSidebar() {
  const location = useLocation();
  const logout = useAdminLogout();

  return (
    <aside
      className="w-64 min-h-screen p-4 flex flex-col"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      <div className="mb-8">
        <Link to="/" className="flex items-center gap-2" style={{ textDecoration: 'none' }}>
          <img src="/img/logo-w-text-white.png" alt="Logo" className="h-8" />
        </Link>
        <p className="text-xs mt-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Admin Panel
        </p>
      </div>

      <nav className="flex-1">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = 'exact' in item && item.exact
              ? location.pathname === item.path || location.pathname.startsWith('/admin/operations/job/')
              : location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
                  style={{
                    background: isActive ? 'var(--accent)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    textDecoration: 'none',
                  }}
                >
                  <i className={`bi ${item.icon}`}></i>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-2"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
        >
          <i className="bi bi-arrow-left"></i>
          Back to Site
        </Link>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left"
          style={{ color: 'var(--text-secondary)' }}
        >
          <i className="bi bi-box-arrow-right"></i>
          Logout
        </button>
      </div>
    </aside>
  );
}
