import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FILE_PATHS } from './publishToS3';

describe('publishToS3', () => {
  describe('FILE_PATHS', () => {
    it('has correct media mentions path', () => {
      expect(FILE_PATHS.mediaMentions).toBe('data/mediaMentions.json');
    });

    it('has correct team path', () => {
      expect(FILE_PATHS.team).toBe('data/team.json');
    });

    it('has correct profile path', () => {
      expect(FILE_PATHS.profile).toBe('data/westwood-publications.json');
    });

    it('has correct reports path', () => {
      expect(FILE_PATHS.reports).toBe('news/index.json');
    });
  });

  describe('publishToS3 function', () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      vi.stubEnv('VITE_ADMIN_API_URL', 'https://test-api.example.com');
      sessionStorage.setItem('admin-password', 'test-password');
      vi.resetModules();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.unstubAllEnvs();
    });

    it('returns success result on successful response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Published!', timestamp: '2024-01-01T12:00:00Z' }),
      }) as unknown as typeof fetch;

      const { publishToS3 } = await import('./publishToS3');
      const result = await publishToS3('test.json', { data: 'test' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Published!');
      expect(result.timestamp).toBe('2024-01-01T12:00:00Z');
    });

    it('returns error result on failed response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Access denied' }),
      }) as unknown as typeof fetch;

      const { publishToS3 } = await import('./publishToS3');
      const result = await publishToS3('test.json', { data: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access denied');
    });

    it('handles network errors', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure')) as unknown as typeof fetch;

      const { publishToS3 } = await import('./publishToS3');
      const result = await publishToS3('test.json', { data: 'test' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Network error');
      expect(result.error).toBe('Network failure');
    });

    it('includes password in request body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Success' }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const { publishToS3 } = await import('./publishToS3');
      await publishToS3('data/test.json', { items: [1, 2, 3] });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/save'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Check the body contains expected fields
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body).toHaveProperty('filePath', 'data/test.json');
      expect(body).toHaveProperty('content');
      expect(body).toHaveProperty('password');
    });
  });

  describe('uploadFileToS3 function', () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      vi.stubEnv('VITE_ADMIN_API_URL', 'https://test-api.example.com');
      sessionStorage.setItem('admin-password', 'test-password');
      vi.resetModules();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.unstubAllEnvs();
    });

    const createMockFile = (name: string, content: string, type: string): File => {
      return new File([content], name, { type });
    };

    it('returns success with URL on successful upload', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://s3.amazonaws.com/bucket/test.pdf' }),
      }) as unknown as typeof fetch;

      const { uploadFileToS3 } = await import('./publishToS3');
      const file = createMockFile('test.pdf', 'content', 'application/pdf');
      const result = await uploadFileToS3(file, 'uploads/test.pdf');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://s3.amazonaws.com/bucket/test.pdf');
    });

    it('returns error on failed upload', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'File too large' }),
      }) as unknown as typeof fetch;

      const { uploadFileToS3 } = await import('./publishToS3');
      const file = createMockFile('test.pdf', 'content', 'application/pdf');
      const result = await uploadFileToS3(file, 'uploads/test.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toBe('File too large');
    });

    it('handles network errors', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused')) as unknown as typeof fetch;

      const { uploadFileToS3 } = await import('./publishToS3');
      const file = createMockFile('test.pdf', 'content', 'application/pdf');
      const result = await uploadFileToS3(file, 'uploads/test.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('sends file as base64', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://s3.amazonaws.com/bucket/test.pdf' }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const { uploadFileToS3 } = await import('./publishToS3');
      const file = createMockFile('test.pdf', 'test content', 'application/pdf');
      await uploadFileToS3(file, 'uploads/test.pdf');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/upload'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Check the body contains expected fields
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body).toHaveProperty('filePath', 'uploads/test.pdf');
      expect(body).toHaveProperty('fileData');
      expect(body).toHaveProperty('contentType', 'application/pdf');
      expect(body).toHaveProperty('password');
    });
  });
});
