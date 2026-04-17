import type { SurveyUploadType, SurveyValidationResult } from '../../../types/admin';

// Filename validation patterns for each survey type
const FILENAME_PATTERNS = {
  // dart0051_w7-clean_2024_label.csv
  labelled: /^dart0051_w(\d+)-clean_(\d{4})_label\.csv$/i,
  // dart0051_w7-clean_2024.csv
  unlabelled: /^dart0051_w(\d+)-clean_(\d{4})\.csv$/i,
  // DART0055_W7.zip or DART0055_Wave_7.zip
  international: /^DART0055_(W|Wave_)(\d+)\.zip$/i,
};

/**
 * Validate a survey filename and extract metadata
 */
export function validateFilename(filename: string): SurveyValidationResult {
  // Try labelled pattern first
  const labelledMatch = filename.match(FILENAME_PATTERNS.labelled);
  if (labelledMatch) {
    return {
      isValid: true,
      uploadType: 'labelled',
      waveNumber: parseInt(labelledMatch[1], 10),
      year: parseInt(labelledMatch[2], 10),
    };
  }

  // Try unlabelled pattern
  const unlabelledMatch = filename.match(FILENAME_PATTERNS.unlabelled);
  if (unlabelledMatch) {
    return {
      isValid: true,
      uploadType: 'unlabelled',
      waveNumber: parseInt(unlabelledMatch[1], 10),
      year: parseInt(unlabelledMatch[2], 10),
    };
  }

  // Try international pattern
  const internationalMatch = filename.match(FILENAME_PATTERNS.international);
  if (internationalMatch) {
    return {
      isValid: true,
      uploadType: 'international',
      waveNumber: parseInt(internationalMatch[2], 10),
    };
  }

  // No pattern matched
  return {
    isValid: false,
    error: getValidationError(filename),
  };
}

/**
 * Generate a helpful error message based on the filename
 */
function getValidationError(filename: string): string {
  const lowerFilename = filename.toLowerCase();

  if (lowerFilename.endsWith('.csv')) {
    if (lowerFilename.includes('_label')) {
      return 'Labelled file should match pattern: dart0051_wN-clean_YYYY_label.csv';
    }
    return 'CSV file should match pattern: dart0051_wN-clean_YYYY.csv or dart0051_wN-clean_YYYY_label.csv';
  }

  if (lowerFilename.endsWith('.zip')) {
    return 'ZIP file should match pattern: DART0055_WN.zip or DART0055_Wave_N.zip';
  }

  return 'Invalid file type. Expected .csv for labelled/unlabelled surveys or .zip for international surveys.';
}

/**
 * Validate a file for survey upload
 */
export function validateSurveyFile(
  file: File,
  expectedType?: SurveyUploadType
): SurveyValidationResult {
  // Validate file size (max 500MB)
  const maxSize = 500 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (500MB)`,
    };
  }

  // For labelled/unlabelled, accept any CSV file
  if (expectedType === 'labelled' || expectedType === 'unlabelled') {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return {
        isValid: false,
        error: 'Expected a .csv file',
      };
    }
    // Try to extract metadata from filename if it matches the pattern
    const result = validateFilename(file.name);
    return {
      isValid: true,
      uploadType: expectedType,
      waveNumber: result.isValid ? result.waveNumber : undefined,
      year: result.isValid ? result.year : undefined,
    };
  }

  // For international, keep strict filename validation
  const result = validateFilename(file.name);

  if (!result.isValid) {
    return result;
  }

  if (expectedType && result.uploadType !== expectedType) {
    return {
      isValid: false,
      error: `Expected ${expectedType} file but got ${result.uploadType} file pattern`,
    };
  }

  return result;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get expected filename pattern for a survey type
 */
export function getExpectedPattern(uploadType: SurveyUploadType): string {
  switch (uploadType) {
    case 'labelled':
      return 'Any .csv file';
    case 'unlabelled':
      return 'Any .csv file';
    case 'international':
      return 'DART0055_WN.zip or DART0055_Wave_N.zip';
  }
}

/**
 * Get description for a survey type
 */
export function getSurveyTypeDescription(uploadType: SurveyUploadType): string {
  switch (uploadType) {
    case 'labelled':
      return 'Labelled survey data with variable labels';
    case 'unlabelled':
      return 'Unlabelled raw survey data';
    case 'international':
      return 'International survey data package';
  }
}
