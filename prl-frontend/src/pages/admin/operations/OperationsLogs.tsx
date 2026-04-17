import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getJobLogs } from './monitoringApi';
import { BATCH_JOBS } from './types';
import type { LogEvent } from './types';

const ALL_JOBS = '__all__';

export function OperationsLogs() {
  const [searchParams] = useSearchParams();
  const initialJob = searchParams.get('job') || ALL_JOBS;

  const [selectedJob, setSelectedJob] = useState(initialJob);
  const [searchText, setSearchText] = useState('');
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchLogs = useCallback(async (job: string, search: string, append = false, token?: string | null) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setEvents([]);
      setNextToken(null);
    }
    setError(null);

    try {
      if (job === ALL_JOBS) {
        // Fetch from all jobs in parallel
        const results = await Promise.all(
          BATCH_JOBS.map((jobName) =>
            getJobLogs(jobName, {
              search: search || undefined,
              limit: 50,
            }).then((r) => ({
              ...r,
              events: r.events.map((e) => ({
                ...e,
                log_stream: jobName,
              })),
            })).catch(() => ({ events: [] as LogEvent[], next_token: null, job_name: jobName }))
          )
        );

        // Merge and sort by timestamp descending
        const allEvents = results.flatMap((r) => r.events);
        allEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        if (append) {
          setEvents((prev) => [...prev, ...allEvents]);
        } else {
          setEvents(allEvents);
        }
        setNextToken(null); // No pagination for "all" mode
      } else {
        const result = await getJobLogs(job, {
          search: search || undefined,
          next_token: append ? (token ?? undefined) : undefined,
          limit: 200,
        });

        if (result.error) {
          setError(result.error);
        }

        // Tag events with job name
        const taggedEvents = result.events.map((e) => ({
          ...e,
          log_stream: e.log_stream || job,
        }));

        if (append) {
          setEvents((prev) => [...prev, ...taggedEvents]);
        } else {
          setEvents(taggedEvents);
        }
        setNextToken(result.next_token);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load logs on mount and when job changes
  useEffect(() => {
    setSearchText('');
    fetchLogs(selectedJob, '');
  }, [selectedJob, fetchLogs]);

  // Debounced search filter
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchLogs(selectedJob, searchText);
    }, 400);
    return () => clearTimeout(searchTimeout.current);
  }, [searchText, selectedJob, fetchLogs]);

  const handleLoadMore = () => {
    if (nextToken) fetchLogs(selectedJob, searchText, true, nextToken);
  };

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  /** Extract short service name from log_stream like "floor-ingest/Container-floor-ingest/abc123" */
  const extractServiceName = (logStream?: string): string => {
    if (!logStream) return '—';
    // If it's just the job name (from our tagging), return it
    if (BATCH_JOBS.includes(logStream as typeof BATCH_JOBS[number])) return logStream;
    // Extract from log stream format: "job-name/Container-job-name/taskid"
    const parts = logStream.split('/');
    return parts[0] || logStream;
  };

  const highlightSearch = (text: string) => {
    if (!searchText) return text;
    const parts = text.split(new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === searchText.toLowerCase() ? (
        <mark key={i} style={{ background: '#f59e0b60', color: 'inherit', borderRadius: '2px' }}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const showServiceColumn = selectedJob === ALL_JOBS;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Log Viewer
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Browse and search batch job logs
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={selectedJob}
          onChange={(e) => setSelectedJob(e.target.value)}
          className="px-4 py-2 rounded-lg text-sm"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <option value={ALL_JOBS}>All Jobs</option>
          {BATCH_JOBS.map((job) => (
            <option key={job} value={job}>{job}</option>
          ))}
        </select>

        <div className="flex-1 min-w-[200px] relative">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Filter logs..."
            className="w-full px-4 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {loading && searchText && (
            <i className="bi bi-arrow-clockwise animate-spin absolute right-3 top-2.5" style={{ color: 'var(--text-muted)' }}></i>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-4 rounded-lg mb-6 text-sm"
          style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}
        >
          <i className="bi bi-exclamation-triangle mr-2"></i>{error}
        </div>
      )}

      {/* Loading skeleton on initial load */}
      {loading && events.length === 0 && !error && (
        <div
          className="p-12 rounded-xl text-center"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <i className="bi bi-arrow-clockwise animate-spin text-2xl mb-3 block" style={{ color: 'var(--text-muted)' }}></i>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading logs{selectedJob !== ALL_JOBS ? ` for ${selectedJob}` : ''}...
          </p>
        </div>
      )}

      {/* No results */}
      {events.length === 0 && !loading && !error && (
        <div
          className="p-12 rounded-xl text-center"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <i className="bi bi-terminal text-4xl mb-3 block" style={{ color: 'var(--text-muted)' }}></i>
          <p className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            No logs found
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {searchText ? 'Try a different search term.' : 'No log events in the last 24 hours.'}
          </p>
        </div>
      )}

      {events.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {events.length} events loaded
              {loading && <i className="bi bi-arrow-clockwise animate-spin ml-2"></i>}
            </span>
          </div>

          <div
            className="rounded-xl overflow-auto max-h-[600px]"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <table className="w-full text-xs" style={{ fontFamily: '"SF Mono", "Fira Code", monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-3 py-2 sticky top-0" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', width: '180px' }}>
                    Timestamp
                  </th>
                  {showServiceColumn && (
                    <th className="text-left px-3 py-2 sticky top-0" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', width: '160px' }}>
                      Service
                    </th>
                  )}
                  <th className="text-left px-3 py-2 sticky top-0" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                    Message
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td
                      className="px-3 py-1.5 whitespace-nowrap align-top"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {formatTimestamp(event.timestamp)}
                    </td>
                    {showServiceColumn && (
                      <td
                        className="px-3 py-1.5 whitespace-nowrap align-top"
                        style={{ color: 'var(--accent)' }}
                      >
                        {extractServiceName(event.log_stream)}
                      </td>
                    )}
                    <td
                      className="px-3 py-1.5"
                      style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {highlightSearch(event.message)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load More */}
          {nextToken && (
            <div className="mt-4 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  opacity: loadingMore ? 0.7 : 1,
                }}
              >
                {loadingMore ? (
                  <><i className="bi bi-arrow-clockwise animate-spin mr-2"></i>Loading...</>
                ) : (
                  <><i className="bi bi-plus-circle mr-2"></i>Load More</>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
