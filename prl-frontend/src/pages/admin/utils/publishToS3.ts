import { getAdminPassword, handleUnauthorized } from './adminAuth';

const API_URL = import.meta.env.VITE_ADMIN_API_URL;

export interface PublishResult {
  success: boolean;
  message: string;
  timestamp?: string;
  error?: string;
}

export async function publishToS3(filePath: string, content: unknown): Promise<PublishResult> {
  if (!API_URL) {
    return { success: false, message: 'API URL not configured', error: 'Missing VITE_ADMIN_API_URL' };
  }

  try {
    const response = await fetch(`${API_URL}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: getAdminPassword(),
        filePath,
        content,
      }),
    });

    if (response.status === 401) {
      handleUnauthorized();
      return { success: false, message: 'Unauthorized', error: 'Session expired' };
    }

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: result.error || 'Failed to publish',
        error: result.error,
      };
    }

    return {
      success: true,
      message: result.message || 'Published successfully',
      timestamp: result.timestamp,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Network error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// File path mappings for each admin section
export const FILE_PATHS = {
  mediaMentions: 'data/mediaMentions.json',
  team: 'data/team.json',
  profile: 'data/westwood-publications.json',
  reports: 'news/index.json',
} as const;

export interface FileUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function uploadFileToS3(file: File, destinationPath: string): Promise<FileUploadResult> {
  if (!API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    // Convert file to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: getAdminPassword(),
        filePath: destinationPath,
        fileData: base64,
        contentType: file.type,
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
        error: result.error || 'Failed to upload file',
      };
    }

    return {
      success: true,
      url: result.url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
