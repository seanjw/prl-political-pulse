import { useState, useEffect, useCallback } from 'react';
import {
  getErrorLog,
  clearErrorLog,
  exportErrorLog,
  type ErrorLogEntry,
} from './utils/errorLogService';

type FilterLevel = 'all' | 'error' | 'warning';

export function ErrorLogAdmin() {
  const [logs, setLogs] = useState<ErrorLogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const refreshLogs = useCallback(() => {
    setLogs(getErrorLog());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshLogs();
  }, [refreshLogs]);

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all error logs? This cannot be undone.')) {
      clearErrorLog();
      setLogs([]);
      setExpandedIds(new Set());
    }
  };

  const handleExport = () => {
    const json = exportErrorLog();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-log-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
    const matchesSearch =
      !searchTerm ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.source && log.source.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesLevel && matchesSearch;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Error Log
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {logs.length} {logs.length === 1 ? 'entry' : 'entries'} total
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={refreshLogs}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <i className="bi bi-arrow-clockwise mr-2"></i>Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={logs.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              opacity: logs.length === 0 ? 0.5 : 1,
            }}
          >
            <i className="bi bi-download mr-2"></i>Export JSON
          </button>
          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: '#ef4444',
              color: '#fff',
              opacity: logs.length === 0 ? 0.5 : 1,
            }}
          >
            <i className="bi bi-trash mr-2"></i>Clear All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by message, details, or source..."
            className="w-full px-4 py-2 rounded-lg"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value as FilterLevel)}
          className="px-4 py-2 rounded-lg"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="all">All Levels</option>
          <option value="error">Errors Only</option>
          <option value="warning">Warnings Only</option>
        </select>
      </div>

      {/* Log Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="w-6 flex-shrink-0"></div>
          <div className="w-40 flex-shrink-0 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Time
          </div>
          <div className="w-20 flex-shrink-0 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Level
          </div>
          <div className="flex-1 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Message
          </div>
          <div className="w-32 flex-shrink-0 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Source
          </div>
        </div>

        {/* Rows */}
        {filteredLogs.length === 0 ? (
          <div className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
            <i className="bi bi-check-circle text-4xl mb-3 block" style={{ color: '#10b981' }}></i>
            <p className="text-lg font-medium mb-1">No errors logged</p>
            <p className="text-sm">
              {logs.length === 0
                ? 'When errors occur in the admin panel, they will appear here.'
                : 'No entries match your current filters.'}
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedIds.has(log.id);
            const hasDetails = log.details || log.stack || log.action;

            return (
              <div key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 ${hasDetails ? 'cursor-pointer hover:opacity-80' : ''}`}
                  onClick={() => hasDetails && toggleExpanded(log.id)}
                >
                  <div className="w-6 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {hasDetails && (
                      <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                    )}
                  </div>
                  <div
                    className="w-40 flex-shrink-0 text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {formatTimestamp(log.timestamp)}
                  </div>
                  <div className="w-20 flex-shrink-0">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium uppercase"
                      style={{
                        background: log.level === 'error' ? '#ef444420' : '#f59e0b20',
                        color: log.level === 'error' ? '#ef4444' : '#f59e0b',
                      }}
                    >
                      {log.level}
                    </span>
                  </div>
                  <div
                    className="flex-1 text-sm truncate"
                    style={{ color: 'var(--text-primary)' }}
                    title={log.message}
                  >
                    {log.message}
                  </div>
                  <div
                    className="w-32 flex-shrink-0 text-sm truncate"
                    style={{ color: 'var(--text-muted)' }}
                    title={log.source}
                  >
                    {log.source}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && hasDetails && (
                  <div
                    className="px-4 py-3 ml-6"
                    style={{
                      background: 'var(--bg-tertiary)',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    {log.action && (
                      <div className="mb-2">
                        <span
                          className="text-xs font-medium uppercase"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Action:
                        </span>
                        <span className="ml-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {log.action}
                        </span>
                      </div>
                    )}
                    {log.details && (
                      <div className="mb-2">
                        <span
                          className="text-xs font-medium uppercase"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Details:
                        </span>
                        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {log.details}
                        </p>
                      </div>
                    )}
                    {log.stack && (
                      <div>
                        <span
                          className="text-xs font-medium uppercase"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Stack Trace:
                        </span>
                        <pre
                          className="mt-1 p-2 rounded text-xs overflow-x-auto"
                          style={{
                            background: 'var(--bg-primary)',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {log.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
