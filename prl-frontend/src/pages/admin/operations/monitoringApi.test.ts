import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('monitoringApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.setItem('admin-password', 'test-pass');
  });

  it('sends x-admin-password header on requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });
    globalThis.fetch = mockFetch;

    const { getSystemStatus } = await import('./monitoringApi');
    await getSystemStatus();

    expect(mockFetch).toHaveBeenCalledWith(
      '/monitoring/status',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-admin-password': 'test-pass',
        }),
      }),
    );
  });

  it('throws on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });
    globalThis.fetch = mockFetch;

    const { getSystemStatus } = await import('./monitoringApi');
    await expect(getSystemStatus()).rejects.toThrow('500');
  });

  it('clears session and reloads on 401', async () => {
    sessionStorage.setItem('admin-password', 'test-pass');
    sessionStorage.setItem('admin-authenticated', 'true');

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });
    globalThis.fetch = mockFetch;

    const { getSystemStatus } = await import('./monitoringApi');
    await expect(getSystemStatus()).rejects.toThrow('Unauthorized');
    expect(sessionStorage.getItem('admin-password')).toBeNull();
    expect(sessionStorage.getItem('admin-authenticated')).toBeNull();
    expect(reloadMock).toHaveBeenCalled();
  });

  it('getJobLogs builds query string correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events: [], next_token: null, job_name: 'test' }),
    });
    globalThis.fetch = mockFetch;

    const { getJobLogs } = await import('./monitoringApi');
    await getJobLogs('floor-ingest', { search: 'ERROR', limit: 50 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/monitoring/status/jobs/floor-ingest/logs');
    expect(url).toContain('search=ERROR');
    expect(url).toContain('limit=50');
  });

  it('updateAlertConfig sends POST with body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'ok', enabled: true }),
    });
    globalThis.fetch = mockFetch;

    const { updateAlertConfig } = await import('./monitoringApi');
    await updateAlertConfig({
      critical_jobs: ['floor-ingest'],
      alert_emails: ['test@example.com'],
      enabled: true,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/monitoring/status/alerts/config',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('floor-ingest'),
      }),
    );
  });

  it('getJobResultsSummary fetches /results/summary', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ summary: {} }),
    });
    globalThis.fetch = mockFetch;

    const { getJobResultsSummary } = await import('./monitoringApi');
    const result = await getJobResultsSummary();

    expect(mockFetch).toHaveBeenCalledWith(
      '/monitoring/results/summary',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-admin-password': 'test-pass',
        }),
      }),
    );
    expect(result).toEqual({ summary: {} });
  });

  it('getJobResults fetches with days parameter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ job_name: 'floor-ingest', results: [], days: 14 }),
    });
    globalThis.fetch = mockFetch;

    const { getJobResults } = await import('./monitoringApi');
    await getJobResults('floor-ingest', 14);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/monitoring/results/floor-ingest');
    expect(url).toContain('days=14');
  });

  it('getJobResultLatest fetches /results/{name}/latest', async () => {
    const mockResult = { id: 1, status: 'success', metrics: {} };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ job_name: 'floor-ingest', result: mockResult }),
    });
    globalThis.fetch = mockFetch;

    const { getJobResultLatest } = await import('./monitoringApi');
    const result = await getJobResultLatest('floor-ingest');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('/monitoring/results/floor-ingest/latest');
    expect(result.result).toEqual(mockResult);
  });

  it('getJobResults encodes job name', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ job_name: 'rhetoric-public-s3', results: [], days: 30 }),
    });
    globalThis.fetch = mockFetch;

    const { getJobResults } = await import('./monitoringApi');
    await getJobResults('rhetoric-public-s3');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('rhetoric-public-s3');
  });
});
