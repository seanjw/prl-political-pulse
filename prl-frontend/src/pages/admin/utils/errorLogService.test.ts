import { describe, it, expect, beforeEach } from 'vitest';
import {
  getErrorLog,
  addErrorLog,
  clearErrorLog,
  exportErrorLog,
  type ErrorLogEntry,
} from './errorLogService';

describe('errorLogService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getErrorLog', () => {
    it('returns empty array when no logs exist', () => {
      const logs = getErrorLog();
      expect(logs).toEqual([]);
    });

    it('returns stored logs', () => {
      const testEntry: ErrorLogEntry = {
        id: 'test-1',
        timestamp: '2024-01-01T00:00:00.000Z',
        level: 'error',
        message: 'Test error',
        source: '/admin',
      };
      localStorage.setItem('admin-error-log', JSON.stringify([testEntry]));

      const logs = getErrorLog();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual(testEntry);
    });

    it('returns empty array on invalid JSON', () => {
      localStorage.setItem('admin-error-log', 'invalid json');
      const logs = getErrorLog();
      expect(logs).toEqual([]);
    });
  });

  describe('addErrorLog', () => {
    it('adds a new error log entry', () => {
      const entry = addErrorLog({
        level: 'error',
        message: 'Test error',
        source: '/admin/test',
      });

      expect(entry.id).toMatch(/^err-\d+-[a-z0-9]+$/);
      expect(entry.timestamp).toBeDefined();
      expect(entry.level).toBe('error');
      expect(entry.message).toBe('Test error');
      expect(entry.source).toBe('/admin/test');

      const logs = getErrorLog();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual(entry);
    });

    it('adds entry with all optional fields', () => {
      const entry = addErrorLog({
        level: 'warning',
        message: 'Test warning',
        details: 'Some details',
        stack: 'Error stack trace',
        source: '/admin/test',
        action: 'publish',
      });

      expect(entry.level).toBe('warning');
      expect(entry.details).toBe('Some details');
      expect(entry.stack).toBe('Error stack trace');
      expect(entry.action).toBe('publish');
    });

    it('adds new entries at the beginning (most recent first)', () => {
      addErrorLog({ level: 'error', message: 'First', source: '/admin' });
      addErrorLog({ level: 'error', message: 'Second', source: '/admin' });
      addErrorLog({ level: 'error', message: 'Third', source: '/admin' });

      const logs = getErrorLog();
      expect(logs[0].message).toBe('Third');
      expect(logs[1].message).toBe('Second');
      expect(logs[2].message).toBe('First');
    });

    it('enforces maximum 100 entries (FIFO)', () => {
      // Add 105 entries
      for (let i = 0; i < 105; i++) {
        addErrorLog({
          level: 'error',
          message: `Error ${i}`,
          source: '/admin',
        });
      }

      const logs = getErrorLog();
      expect(logs).toHaveLength(100);
      // Most recent should be Error 104
      expect(logs[0].message).toBe('Error 104');
      // Oldest should be Error 5 (0-4 were removed)
      expect(logs[99].message).toBe('Error 5');
    });

    it('generates unique IDs for each entry', () => {
      const entry1 = addErrorLog({ level: 'error', message: 'Error 1', source: '/admin' });
      const entry2 = addErrorLog({ level: 'error', message: 'Error 2', source: '/admin' });

      expect(entry1.id).not.toBe(entry2.id);
    });
  });

  describe('clearErrorLog', () => {
    it('removes all error logs', () => {
      addErrorLog({ level: 'error', message: 'Test 1', source: '/admin' });
      addErrorLog({ level: 'error', message: 'Test 2', source: '/admin' });

      expect(getErrorLog()).toHaveLength(2);

      clearErrorLog();

      expect(getErrorLog()).toHaveLength(0);
    });

    it('handles clearing when no logs exist', () => {
      clearErrorLog();
      expect(getErrorLog()).toHaveLength(0);
    });
  });

  describe('exportErrorLog', () => {
    it('exports logs as formatted JSON string', () => {
      addErrorLog({ level: 'error', message: 'Test error', source: '/admin' });

      const exported = exportErrorLog();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].message).toBe('Test error');
    });

    it('exports empty array when no logs', () => {
      const exported = exportErrorLog();
      expect(exported).toBe('[]');
    });

    it('exports with proper formatting (indentation)', () => {
      addErrorLog({ level: 'error', message: 'Test', source: '/admin' });

      const exported = exportErrorLog();
      // Should have newlines from JSON.stringify with 2-space indentation
      expect(exported).toContain('\n');
      expect(exported).toContain('  ');
    });
  });

  describe('error levels', () => {
    it('supports error level', () => {
      const entry = addErrorLog({ level: 'error', message: 'Error', source: '/admin' });
      expect(entry.level).toBe('error');
    });

    it('supports warning level', () => {
      const entry = addErrorLog({ level: 'warning', message: 'Warning', source: '/admin' });
      expect(entry.level).toBe('warning');
    });
  });

  describe('timestamp generation', () => {
    it('generates ISO timestamp', () => {
      const entry = addErrorLog({ level: 'error', message: 'Test', source: '/admin' });

      // Should be a valid ISO date string
      const date = new Date(entry.timestamp);
      expect(date.toISOString()).toBe(entry.timestamp);
    });
  });
});
