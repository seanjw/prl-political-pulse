import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

interface Tab {
  key: string;
  label: string;
  color?: string;
}

interface TabsProps {
  tabs: Tab[];
  children: ReactNode[];
  defaultTab?: number;
  size?: 'normal' | 'small';
  urlKey?: string;
}

function getHashParams(): Record<string, string> {
  const hash = window.location.hash.slice(1);
  if (!hash) return {};
  const params: Record<string, string> = {};
  hash.split('&').forEach(part => {
    const [key, value] = part.split('=');
    if (key && value) {
      params[key] = value;
    }
  });
  return params;
}

function setHashParams(params: Record<string, string>) {
  const hash = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  window.history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname);
}

export function Tabs({ tabs, children, defaultTab = 0, size = 'normal', urlKey }: TabsProps) {
  const getInitialTab = useCallback(() => {
    if (!urlKey) return defaultTab;
    const params = getHashParams();
    const tabKey = params[urlKey];
    if (tabKey) {
      const index = tabs.findIndex(t => t.key === tabKey);
      if (index >= 0) return index;
    }
    return defaultTab;
  }, [urlKey, defaultTab, tabs]);

  const [activeTab, setActiveTab] = useState(getInitialTab);

  const handleTabClick = (index: number) => {
    setActiveTab(index);
    if (urlKey) {
      const params = getHashParams();
      params[urlKey] = tabs[index].key;
      setHashParams(params);
    }
  };

  // Listen for hash changes (back/forward navigation)
  useEffect(() => {
    if (!urlKey) return;

    const handleHashChange = () => {
      const params = getHashParams();
      const tabKey = params[urlKey];
      if (tabKey) {
        const index = tabs.findIndex(t => t.key === tabKey);
        if (index >= 0) setActiveTab(index);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [urlKey, tabs]);

  const isSmall = size === 'small';

  return (
    <div>
      {/* Tab Headers */}
      <div
        className="flex flex-wrap"
        style={{
          borderBottom: '2px solid var(--border)',
          marginBottom: 0,
          gap: isSmall ? '0' : undefined
        }}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(index)}
            className={`transition-all relative ${isSmall ? 'px-4 py-3 text-sm font-medium' : 'px-6 py-4 font-semibold text-lg'}`}
            style={{
              color: activeTab === index ? (tab.color || 'var(--text-primary)') : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              marginBottom: '-2px',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
            {/* Active indicator */}
            {activeTab === index && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: isSmall ? '2px' : '3px',
                  background: tab.color || '#2563eb',
                  borderRadius: '3px 3px 0 0'
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content Card */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderTop: 'none',
          borderRadius: '0 0 16px 16px',
          padding: isSmall ? '1.5rem' : '2rem',
          minHeight: isSmall ? '200px' : '400px'
        }}
      >
        {children[activeTab]}
      </div>
    </div>
  );
}

interface TabPanelProps {
  children: ReactNode;
}

export function TabPanel({ children }: TabPanelProps) {
  return <div>{children}</div>;
}
