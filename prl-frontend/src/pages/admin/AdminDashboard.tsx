import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { MediaMention, Report, PoliticalViolenceEvent } from '../../types/admin';
import { useAdminToast } from './context/AdminToastContext';

interface Stats {
  mediaMentions: number;
  reports: number;
  violenceEvents: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ mediaMentions: 0, reports: 0, violenceEvents: 0 });
  const [loading, setLoading] = useState(true);
  const { showError } = useAdminToast();

  useEffect(() => {
    async function loadStats() {
      try {
        const [mediaMentionsRes, reportsRes, violenceRes] = await Promise.all([
          fetch('/data/mediaMentions.json'),
          fetch('/news/index.json'),
          import('../../pages/violence/data/events.json'),
        ]);

        const mediaMentions: MediaMention[] = await mediaMentionsRes.json();
        const reportsData: { articles: Report[] } = await reportsRes.json();
        const violenceEvents: PoliticalViolenceEvent[] = violenceRes.default as PoliticalViolenceEvent[];

        setStats({
          mediaMentions: mediaMentions.length,
          reports: reportsData.articles.length,
          violenceEvents: violenceEvents.length,
        });
      } catch (error) {
        showError('Failed to load dashboard stats', error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [showError]);

  const cards = [
    {
      title: 'Media Mentions',
      count: stats.mediaMentions,
      icon: 'bi-newspaper',
      color: '#3b82f6',
      link: '/admin/media',
    },
    {
      title: 'Reports',
      count: stats.reports,
      icon: 'bi-file-text',
      color: '#10b981',
      link: '/admin/reports',
    },
    {
      title: 'Violence Events',
      count: stats.violenceEvents,
      icon: 'bi-exclamation-triangle',
      color: '#ef4444',
      link: '/admin/violence',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Admin Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Manage content for America's Political Pulse
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 rounded-xl animate-pulse"
              style={{ background: 'var(--bg-secondary)', height: '120px' }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card) => (
            <Link
              key={card.title}
              to={card.link}
              className="p-6 rounded-xl transition-all hover:scale-[1.02]"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <i
                  className={`bi ${card.icon} text-2xl`}
                  style={{ color: card.color }}
                ></i>
                <span
                  className="text-3xl font-bold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {card.count}
                </span>
              </div>
              <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {card.title}
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Click to manage
              </p>
            </Link>
          ))}
        </div>
      )}

      <div
        className="mt-8 p-6 rounded-xl"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          How to Use
        </h2>
        <ol className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <li className="flex gap-3">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              1
            </span>
            <span>Select a content type from the sidebar to add, edit, or delete items</span>
          </li>
          <li className="flex gap-3">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              2
            </span>
            <span>Make your changes using the forms provided</span>
          </li>
          <li className="flex gap-3">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              3
            </span>
            <span>Click "Export" to download updated JSON files</span>
          </li>
          <li className="flex gap-3">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              4
            </span>
            <span>Replace the files in the repository and redeploy</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
