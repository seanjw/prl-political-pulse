import type { SurveyConfig, SurveyUploadType } from '../../../types/admin';

import { getAdminPassword, handleUnauthorized } from './adminAuth';

const API_URL = import.meta.env.VITE_ADMIN_API_URL;

export type ProcessingAction = 'process_us' | 'process_international' | 'process_all';

export interface JobStatus {
  jobId: string;
  s3Key?: string;
  uploadType?: string;
  status: 'pending' | 'ingesting' | 'processing' | 'completed' | 'failed';
  createdAt?: string;
  updatedAt?: string;
  rowsIngested?: number;
  errorMessage?: string;
}

export interface TriggerResult {
  success: boolean;
  message?: string;
  trackingId?: string;
  error?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  message?: string;
  error?: string;
  s3Key?: string;
}

/**
 * Fetch survey API config from admin Lambda.
 * Note: baseUrl is overridden with API_URL since all survey routes
 * are now consolidated into the admin Lambda.
 */
export async function getSurveyConfig(): Promise<{ success: true; config: SurveyConfig } | { success: false; error: string }> {
  if (!API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(`${API_URL}/get-survey-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: getAdminPassword(),
      }),
    });

    if (response.status === 401) {
      handleUnauthorized();
      return { success: false, error: 'Session expired' };
    }

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to fetch survey config',
      };
    }

    return {
      success: true,
      config: {
        apiKey: result.apiKey,
        // Use admin API URL directly — all survey routes are on the same Lambda
        baseUrl: API_URL,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get a presigned URL from the survey upload API
 */
export async function getPresignedUrl(
  config: SurveyConfig,
  filename: string,
  uploadType: SurveyUploadType
): Promise<{ success: true; presignedUrl: string; s3Key: string } | { success: false; error: string }> {
  try {
    const response = await fetch(`${config.baseUrl}/get-presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({
        filename,
        uploadType,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || result.message || 'Failed to get presigned URL',
      };
    }

    return {
      success: true,
      presignedUrl: result.presignedUrl || result.url,
      s3Key: result.s3Key,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Upload file to presigned URL with progress tracking
 */
export async function uploadToPresignedUrl(
  presignedUrl: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ success: true, message: 'Upload completed successfully' });
      } else {
        resolve({ success: false, error: `Upload failed with status ${xhr.status}` });
      }
    });

    xhr.addEventListener('error', () => {
      resolve({ success: false, error: 'Network error during upload' });
    });

    xhr.addEventListener('abort', () => {
      resolve({ success: false, error: 'Upload aborted' });
    });

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

/**
 * Complete upload flow: get config, get presigned URL, upload file
 */
export async function uploadSurveyFile(
  file: File,
  uploadType: SurveyUploadType,
  onProgress?: (progress: UploadProgress) => void,
  onStatusChange?: (status: string) => void
): Promise<UploadResult> {
  try {
    // Step 1: Get survey config
    onStatusChange?.('Fetching upload configuration...');
    const configResult = await getSurveyConfig();
    if (!configResult.success) {
      return { success: false, error: configResult.error };
    }

    // Step 2: Get presigned URL
    onStatusChange?.('Requesting upload URL...');
    const urlResult = await getPresignedUrl(configResult.config, file.name, uploadType);
    if (!urlResult.success) {
      return { success: false, error: urlResult.error };
    }

    // Step 3: Upload file
    onStatusChange?.('Uploading file...');
    const uploadResult = await uploadToPresignedUrl(urlResult.presignedUrl, file, onProgress);

    if (!uploadResult.success) {
      return uploadResult;
    }

    // Step 4: Trigger ingestion into database
    onStatusChange?.('Triggering data ingestion...');
    const ingestResult = await triggerIngestion(urlResult.s3Key);
    if (!ingestResult.success) {
      return {
        success: true,
        message: `Upload complete, but ingestion failed: ${ingestResult.error}. Use "Run Analytics" to retry.`,
        s3Key: urlResult.s3Key,
      };
    }

    onStatusChange?.('Upload complete! Ingestion started.');
    return { success: true, message: 'Upload complete! Data ingestion started.', s3Key: urlResult.s3Key };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during upload',
    };
  }
}

/**
 * Trigger ingestion for an uploaded S3 file (ingests CSV + runs analytics)
 */
export async function triggerIngestion(s3Key: string): Promise<TriggerResult> {
  try {
    const configResult = await getSurveyConfig();
    if (!configResult.success) {
      return { success: false, error: configResult.error };
    }

    const response = await fetch(`${configResult.config.baseUrl}/trigger-processing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': configResult.config.apiKey,
      },
      body: JSON.stringify({ s3Key }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || result.message || 'Failed to trigger ingestion',
      };
    }

    return {
      success: true,
      message: result.message,
      trackingId: result.trackingId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Trigger analytics processing (without ingestion)
 */
export async function triggerProcessing(
  action: ProcessingAction = 'process_all'
): Promise<TriggerResult> {
  try {
    const configResult = await getSurveyConfig();
    if (!configResult.success) {
      return { success: false, error: configResult.error };
    }

    const response = await fetch(`${configResult.config.baseUrl}/trigger-processing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': configResult.config.apiKey,
      },
      body: JSON.stringify({ action }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || result.message || 'Failed to trigger processing',
      };
    }

    return {
      success: true,
      message: result.message,
      trackingId: result.trackingId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Get job status by ID
 */
export async function getJobStatus(jobId: string): Promise<{ success: true; job: JobStatus } | { success: false; error: string }> {
  try {
    // Step 1: Get survey config
    const configResult = await getSurveyConfig();
    if (!configResult.success) {
      return { success: false, error: configResult.error };
    }

    // Step 2: Get job status
    const response = await fetch(`${configResult.config.baseUrl}/job-status/${jobId}`, {
      method: 'GET',
      headers: {
        'x-api-key': configResult.config.apiKey,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error || result.message || 'Failed to get job status',
      };
    }

    return {
      success: true,
      job: result as JobStatus,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
