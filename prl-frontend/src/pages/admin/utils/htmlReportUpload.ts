import { uploadFileToS3 } from './publishToS3';

import { getAdminPassword, handleUnauthorized } from './adminAuth';

const API_URL = import.meta.env.VITE_ADMIN_API_URL;

export interface HtmlUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface HtmlUploadResult {
  success: boolean;
  message?: string;
  error?: string;
  imageCount?: number;
}

/**
 * Convert a data URI to a File object
 */
function dataUriToFile(dataUri: string, filename: string): File {
  const [header, base64Data] = dataUri.split(',');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

/**
 * Get file extension from a MIME type
 */
function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  };
  return map[mime] || 'png';
}

/**
 * Extract base64 images from HTML, upload each to S3, and rewrite src attributes.
 */
export async function extractAndUploadImages(
  htmlText: string,
  slug: string,
  onProgress?: (status: string) => void
): Promise<{ cleanedHtml: string; imageCount: number }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const images = doc.querySelectorAll('img[src^="data:"]');

  let imageCount = 0;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const dataUri = img.getAttribute('src');
    if (!dataUri) continue;

    const mimeMatch = dataUri.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const ext = extFromMime(mime);
    const filename = `fig-${i + 1}.${ext}`;
    const s3Path = `news/html/${slug}/images/${filename}`;

    onProgress?.(`Uploading image ${i + 1}/${images.length}...`);

    const file = dataUriToFile(dataUri, filename);
    const result = await uploadFileToS3(file, s3Path);

    if (result.success) {
      img.setAttribute('src', `/${s3Path}`);
      imageCount++;
    } else {
      console.error(`Failed to upload image ${filename}:`, result.error);
    }
  }

  // Reconstruct the full HTML document
  const cleanedHtml = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  return { cleanedHtml, imageCount };
}

/**
 * Get a presigned URL for uploading an HTML report
 */
export async function getReportPresignedUrl(
  slug: string
): Promise<{ success: true; presignedUrl: string; s3Key: string } | { success: false; error: string }> {
  if (!API_URL) {
    return { success: false, error: 'API URL not configured' };
  }

  try {
    const response = await fetch(`${API_URL}/get-report-presigned-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: getAdminPassword(), slug }),
    });

    if (response.status === 401) {
      handleUnauthorized();
      return { success: false, error: 'Session expired' };
    }

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to get presigned URL' };
    }

    return {
      success: true,
      presignedUrl: result.presignedUrl,
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
 * Upload cleaned HTML to S3 via presigned URL with progress tracking
 */
function uploadHtmlToPresignedUrl(
  presignedUrl: string,
  htmlContent: string,
  onProgress?: (progress: HtmlUploadProgress) => void
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const blob = new Blob([htmlContent], { type: 'text/html' });

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
        resolve({ success: true });
      } else {
        resolve({ success: false, error: `Upload failed with status ${xhr.status}` });
      }
    });

    xhr.addEventListener('error', () => {
      resolve({ success: false, error: 'Network error during upload' });
    });

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', 'text/html');
    xhr.send(blob);
  });
}

/**
 * Full HTML report upload flow:
 * 1. Read HTML file as text
 * 2. Extract base64 images and upload each to S3
 * 3. Get presigned URL for HTML
 * 4. Upload cleaned HTML via presigned URL
 */
export async function uploadHtmlReport(
  file: File,
  slug: string,
  onProgress?: (progress: HtmlUploadProgress) => void,
  onStatusChange?: (status: string) => void
): Promise<HtmlUploadResult> {
  try {
    // Step 1: Read HTML file
    onStatusChange?.('Reading HTML file...');
    const htmlText = await file.text();

    // Step 2: Extract and upload images
    onStatusChange?.('Extracting images...');
    const { cleanedHtml, imageCount } = await extractAndUploadImages(htmlText, slug, onStatusChange);

    // Step 3: Get presigned URL for HTML
    onStatusChange?.('Requesting upload URL...');
    const urlResult = await getReportPresignedUrl(slug);
    if (!urlResult.success) {
      return { success: false, error: urlResult.error };
    }

    // Step 4: Upload cleaned HTML
    onStatusChange?.('Uploading HTML report...');
    const uploadResult = await uploadHtmlToPresignedUrl(urlResult.presignedUrl, cleanedHtml, onProgress);

    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error };
    }

    onStatusChange?.('Upload complete!');
    return {
      success: true,
      message: `HTML report uploaded${imageCount > 0 ? ` with ${imageCount} images` : ''}`,
      imageCount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during upload',
    };
  }
}
