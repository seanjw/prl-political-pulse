import { describe, it, expect } from 'vitest';
import {
  validateFilename,
  validateSurveyFile,
  formatFileSize,
  getExpectedPattern,
  getSurveyTypeDescription,
} from './surveyValidation';

describe('surveyValidation', () => {
  describe('validateFilename', () => {
    describe('labelled files', () => {
      it('validates correct labelled filename', () => {
        const result = validateFilename('dart0051_w7-clean_2024_label.csv');
        expect(result.isValid).toBe(true);
        expect(result.uploadType).toBe('labelled');
        expect(result.waveNumber).toBe(7);
        expect(result.year).toBe(2024);
      });

      it('validates labelled filename with different wave number', () => {
        const result = validateFilename('dart0051_w12-clean_2023_label.csv');
        expect(result.isValid).toBe(true);
        expect(result.uploadType).toBe('labelled');
        expect(result.waveNumber).toBe(12);
        expect(result.year).toBe(2023);
      });

      it('validates labelled filename case-insensitively', () => {
        const result = validateFilename('DART0051_W7-CLEAN_2024_LABEL.CSV');
        expect(result.isValid).toBe(true);
        expect(result.uploadType).toBe('labelled');
      });
    });

    describe('unlabelled files', () => {
      it('validates correct unlabelled filename', () => {
        const result = validateFilename('dart0051_w7-clean_2024.csv');
        expect(result.isValid).toBe(true);
        expect(result.uploadType).toBe('unlabelled');
        expect(result.waveNumber).toBe(7);
        expect(result.year).toBe(2024);
      });

      it('validates unlabelled filename with different wave', () => {
        const result = validateFilename('dart0051_w9-clean_2025.csv');
        expect(result.isValid).toBe(true);
        expect(result.uploadType).toBe('unlabelled');
        expect(result.waveNumber).toBe(9);
        expect(result.year).toBe(2025);
      });
    });

    describe('international files', () => {
      it('validates international filename with W prefix', () => {
        const result = validateFilename('DART0055_W7.zip');
        expect(result.isValid).toBe(true);
        expect(result.uploadType).toBe('international');
        expect(result.waveNumber).toBe(7);
        expect(result.year).toBeUndefined();
      });

      it('validates international filename with Wave_ prefix', () => {
        const result = validateFilename('DART0055_Wave_7.zip');
        expect(result.isValid).toBe(true);
        expect(result.uploadType).toBe('international');
        expect(result.waveNumber).toBe(7);
      });

      it('validates international filename case-insensitively', () => {
        const result = validateFilename('dart0055_w10.zip');
        expect(result.isValid).toBe(true);
        expect(result.uploadType).toBe('international');
        expect(result.waveNumber).toBe(10);
      });
    });

    describe('invalid files', () => {
      it('rejects incorrect labelled filename pattern', () => {
        const result = validateFilename('dart0051_w7_2024_label.csv');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('dart0051_wN-clean_YYYY_label.csv');
      });

      it('rejects random CSV file', () => {
        const result = validateFilename('my_data.csv');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('CSV file should match pattern');
      });

      it('rejects random ZIP file', () => {
        const result = validateFilename('archive.zip');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('ZIP file should match pattern');
      });

      it('rejects unsupported file types', () => {
        const result = validateFilename('data.xlsx');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid file type');
      });

      it('rejects wrong DART number', () => {
        const result = validateFilename('dart0052_w7-clean_2024.csv');
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('validateSurveyFile', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const createMockFile = (name: string, _size: number): File => {
      return new File([''], name, { type: 'text/csv' }) as File & { size: number };
    };

    it('validates a correct labelled file', () => {
      const file = createMockFile('dart0051_w7-clean_2024_label.csv', 1024);
      Object.defineProperty(file, 'size', { value: 1024 });

      const result = validateSurveyFile(file);
      expect(result.isValid).toBe(true);
      expect(result.uploadType).toBe('labelled');
    });

    it('validates when expected type matches', () => {
      const file = createMockFile('dart0051_w7-clean_2024_label.csv', 1024);
      Object.defineProperty(file, 'size', { value: 1024 });

      const result = validateSurveyFile(file, 'labelled');
      expect(result.isValid).toBe(true);
    });

    it('accepts labelled file when unlabelled type is expected (any CSV accepted)', () => {
      const file = createMockFile('dart0051_w7-clean_2024_label.csv', 1024);
      Object.defineProperty(file, 'size', { value: 1024 });

      const result = validateSurveyFile(file, 'unlabelled');
      expect(result.isValid).toBe(true);
      expect(result.uploadType).toBe('unlabelled');
    });

    it('rejects files over 500MB', () => {
      const file = createMockFile('dart0051_w7-clean_2024_label.csv', 600 * 1024 * 1024);
      Object.defineProperty(file, 'size', { value: 600 * 1024 * 1024 });

      const result = validateSurveyFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size');
    });

    it('accepts files under 500MB', () => {
      const file = createMockFile('dart0051_w7-clean_2024_label.csv', 400 * 1024 * 1024);
      Object.defineProperty(file, 'size', { value: 400 * 1024 * 1024 });

      const result = validateSurveyFile(file);
      expect(result.isValid).toBe(true);
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(2048)).toBe('2.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });

    it('formats gigabytes', () => {
      expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.0 GB');
    });

    it('formats fractional values', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('getExpectedPattern', () => {
    it('returns pattern for labelled', () => {
      expect(getExpectedPattern('labelled')).toBe('Any .csv file');
    });

    it('returns pattern for unlabelled', () => {
      expect(getExpectedPattern('unlabelled')).toBe('Any .csv file');
    });

    it('returns pattern for international', () => {
      expect(getExpectedPattern('international')).toBe('DART0055_WN.zip or DART0055_Wave_N.zip');
    });
  });

  describe('getSurveyTypeDescription', () => {
    it('returns description for labelled', () => {
      expect(getSurveyTypeDescription('labelled')).toBe('Labelled survey data with variable labels');
    });

    it('returns description for unlabelled', () => {
      expect(getSurveyTypeDescription('unlabelled')).toBe('Unlabelled raw survey data');
    });

    it('returns description for international', () => {
      expect(getSurveyTypeDescription('international')).toBe('International survey data package');
    });
  });
});
