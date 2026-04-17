import { describe, it, expect } from 'vitest';
import { formatMetric } from './formatMetric';

describe('formatMetric', () => {
  describe('number format', () => {
    it('formats integers with locale separators', () => {
      expect(formatMetric(1234567, 'number')).toBe('1,234,567');
    });

    it('formats zero', () => {
      expect(formatMetric(0, 'number')).toBe('0');
    });

    it('returns dash for null', () => {
      expect(formatMetric(null, 'number')).toBe('—');
    });

    it('returns dash for undefined', () => {
      expect(formatMetric(undefined, 'number')).toBe('—');
    });
  });

  describe('bytes format', () => {
    it('formats bytes', () => {
      expect(formatMetric(500, 'bytes')).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatMetric(2048, 'bytes')).toBe('2.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatMetric(5 * 1024 * 1024, 'bytes')).toBe('5.0 MB');
    });

    it('formats gigabytes', () => {
      expect(formatMetric(2.5 * 1024 * 1024 * 1024, 'bytes')).toBe('2.50 GB');
    });
  });

  describe('currency format', () => {
    it('formats with dollar sign and two decimals', () => {
      const result = formatMetric(1234.5, 'currency');
      expect(result).toContain('$');
      expect(result).toContain('1,234.50');
    });

    it('formats zero', () => {
      expect(formatMetric(0, 'currency')).toBe('$0.00');
    });
  });

  describe('duration format', () => {
    it('formats seconds', () => {
      expect(formatMetric(45, 'duration')).toBe('45s');
    });

    it('formats minutes and seconds', () => {
      expect(formatMetric(150, 'duration')).toBe('2m 30s');
    });

    it('formats hours and minutes', () => {
      expect(formatMetric(3661, 'duration')).toBe('1h 1m');
    });
  });

  describe('percent format', () => {
    it('formats with one decimal and percent sign', () => {
      expect(formatMetric(75.5, 'percent')).toBe('75.5%');
    });

    it('formats zero', () => {
      expect(formatMetric(0, 'percent')).toBe('0.0%');
    });
  });

  describe('unknown format', () => {
    it('converts to string', () => {
      expect(formatMetric(42, 'unknown')).toBe('42');
    });
  });
});
