import { useState, useCallback, useEffect, useRef } from 'react';
import type { SurveyUploadType, RecentSurveyUpload } from '../../types/admin';
import { validateSurveyFile, formatFileSize, getExpectedPattern, getSurveyTypeDescription } from './utils/surveyValidation';
import { uploadSurveyFile, triggerProcessing, getJobStatus, type UploadProgress, type ProcessingAction, type JobStatus } from './utils/surveyUpload';
import { useAdminToast } from './context/AdminToastContext';

const STORAGE_KEY = 'admin-survey-uploads';
const MAX_RECENT_UPLOADS = 10;

const UPLOAD_TYPES: { value: SurveyUploadType; label: string }[] = [
  { value: 'labelled', label: 'Labelled Survey' },
  { value: 'unlabelled', label: 'Unlabelled Survey' },
  { value: 'international', label: 'International Survey' },
];

export function SurveyAdmin() {
  const [selectedType, setSelectedType] = useState<SurveyUploadType>('labelled');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationInfo, setValidationInfo] = useState<{ waveNumber?: number; year?: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [recentUploads, setRecentUploads] = useState<RecentSurveyUpload[]>([]);
  const { showError, showSuccess } = useAdminToast();

  // Processing state
  const [processingAction, setProcessingAction] = useState<ProcessingAction>('process_all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load recent uploads from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRecentUploads(JSON.parse(stored));
      } catch (error) {
        showError('Failed to load recent uploads history', error);
      }
    }
  }, [showError]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Poll job status - can be used when we have a jobId from S3 trigger
  const startPollingJobStatus = (jobId: string) => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const pollStatus = async () => {
      const result = await getJobStatus(jobId);
      if (result.success) {
        setJobStatus(result.job);
        // Stop polling if job is completed or failed
        if (result.job.status === 'completed' || result.job.status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setIsProcessing(false);
          if (result.job.status === 'completed') {
            const successMsg = `Processing completed! ${result.job.rowsIngested || 0} rows processed.`;
            setProcessingResult({ type: 'success', message: successMsg });
            showSuccess(successMsg);
          } else {
            const errorMsg = result.job.errorMessage || 'Processing failed';
            setProcessingResult({ type: 'error', message: errorMsg });
            showError('Processing failed', result.job.errorMessage);
          }
        }
      }
    };

    // Poll immediately and then every 3 seconds
    pollStatus();
    pollingIntervalRef.current = setInterval(pollStatus, 3000);
  };

  // Expose for potential future use (e.g., after S3 upload triggers processing)
  void startPollingJobStatus;

  // Handle trigger processing
  const handleTriggerProcessing = async () => {
    setIsProcessing(true);
    setProcessingResult(null);
    setJobStatus(null);

    const result = await triggerProcessing(processingAction);

    if (result.success) {
      setProcessingResult({
        type: 'success',
        message: result.message || 'Processing started...'
      });
      showSuccess(result.message || 'Processing started...');
      // Note: On-demand processing doesn't return a jobId directly
      // The frontend will show success message
      // For actual job tracking, would need to implement job listing
      setTimeout(() => {
        setIsProcessing(false);
      }, 2000);
    } else {
      setIsProcessing(false);
      setProcessingResult({
        type: 'error',
        message: result.error || 'Failed to trigger processing'
      });
      showError('Failed to trigger processing', result.error);
    }
  };

  // Save recent uploads to localStorage
  const saveRecentUpload = (upload: RecentSurveyUpload) => {
    const updated = [upload, ...recentUploads].slice(0, MAX_RECENT_UPLOADS);
    setRecentUploads(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleFileSelect = useCallback((file: File) => {
    setValidationError(null);
    setValidationInfo(null);
    setUploadResult(null);

    const result = validateSurveyFile(file, selectedType);

    if (!result.isValid) {
      setValidationError(result.error || 'Invalid file');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setValidationInfo({
      waveNumber: result.waveNumber,
      year: result.year,
    });
  }, [selectedType]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleTypeChange = (type: SurveyUploadType) => {
    setSelectedType(type);
    // Re-validate current file if one is selected
    if (selectedFile) {
      const result = validateSurveyFile(selectedFile, type);
      if (!result.isValid) {
        setValidationError(result.error || 'Invalid file for this type');
        setSelectedFile(null);
        setValidationInfo(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(null);
    setUploadStatus(null);
    setUploadResult(null);

    const result = await uploadSurveyFile(
      selectedFile,
      selectedType,
      (progress) => setUploadProgress(progress),
      (status) => setUploadStatus(status)
    );

    setUploading(false);

    if (result.success) {
      setUploadResult({ type: 'success', message: result.message || 'Upload completed successfully!' });
      showSuccess(result.message || 'Upload completed successfully!');
      saveRecentUpload({
        id: crypto.randomUUID(),
        filename: selectedFile.name,
        uploadType: selectedType,
        timestamp: new Date().toISOString(),
        status: 'success',
        waveNumber: validationInfo?.waveNumber,
        year: validationInfo?.year,
      });
      // Reset form
      setSelectedFile(null);
      setValidationInfo(null);
    } else {
      setUploadResult({ type: 'error', message: result.error || 'Upload failed' });
      showError('Upload failed', result.error);
      saveRecentUpload({
        id: crypto.randomUUID(),
        filename: selectedFile.name,
        uploadType: selectedType,
        timestamp: new Date().toISOString(),
        status: 'error',
        error: result.error,
      });
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setValidationError(null);
    setValidationInfo(null);
    setUploadProgress(null);
    setUploadStatus(null);
    setUploadResult(null);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Survey Upload
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Upload survey files to the external Survey API
        </p>
      </div>

      {/* Upload Type Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          Survey Type
        </label>
        <div className="flex gap-2">
          {UPLOAD_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => handleTypeChange(type.value)}
              disabled={uploading}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: selectedType === type.value ? 'var(--accent)' : 'var(--bg-secondary)',
                color: selectedType === type.value ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${selectedType === type.value ? 'var(--accent)' : 'var(--border)'}`,
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {type.label}
            </button>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          {getSurveyTypeDescription(selectedType)} - Expected pattern: <code>{getExpectedPattern(selectedType)}</code>
        </p>
      </div>

      {/* File Drop Zone */}
      <div
        className="mb-6 p-8 rounded-xl text-center transition-colors"
        style={{
          background: isDragging ? 'var(--accent-light)' : 'var(--bg-secondary)',
          border: `2px dashed ${isDragging ? 'var(--accent)' : validationError ? '#ef4444' : 'var(--border)'}`,
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {selectedFile ? (
          <div>
            <i className="bi bi-file-earmark-check text-4xl mb-3" style={{ color: '#10b981' }}></i>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {selectedFile.name}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {formatFileSize(selectedFile.size)}
              {validationInfo?.waveNumber && ` • Wave ${validationInfo.waveNumber}`}
              {validationInfo?.year && ` • ${validationInfo.year}`}
            </p>
            <button
              onClick={handleClearFile}
              disabled={uploading}
              className="mt-3 px-3 py-1 rounded text-sm"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              Clear
            </button>
          </div>
        ) : (
          <div>
            <i className="bi bi-cloud-upload text-4xl mb-3" style={{ color: 'var(--text-muted)' }}></i>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              Drop your file here, or{' '}
              <label className="cursor-pointer" style={{ color: 'var(--accent)' }}>
                browse
                <input
                  type="file"
                  accept={selectedType === 'international' ? '.zip' : '.csv'}
                  onChange={handleInputChange}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {selectedType === 'international' ? 'ZIP files only' : 'CSV files only'} • Max 500MB
            </p>
          </div>
        )}
      </div>

      {/* Validation Error */}
      {validationError && (
        <div
          className="mb-6 p-4 rounded-lg flex items-start gap-3"
          style={{ background: '#ef444420', border: '1px solid #ef4444' }}
        >
          <i className="bi bi-exclamation-circle text-lg" style={{ color: '#ef4444' }}></i>
          <div>
            <p className="font-medium" style={{ color: '#ef4444' }}>
              Invalid filename
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {validationError}
            </p>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {uploadStatus || 'Uploading...'}
            </span>
            {uploadProgress && (
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {uploadProgress.percentage}%
              </span>
            )}
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${uploadProgress?.percentage || 0}%`,
                background: 'var(--accent)',
              }}
            />
          </div>
        </div>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <div
          className="mb-6 p-4 rounded-lg flex items-center gap-3"
          style={{
            background: uploadResult.type === 'success' ? '#10b98120' : '#ef444420',
            border: `1px solid ${uploadResult.type === 'success' ? '#10b981' : '#ef4444'}`,
          }}
        >
          <i
            className={`bi ${uploadResult.type === 'success' ? 'bi-check-circle' : 'bi-x-circle'} text-lg`}
            style={{ color: uploadResult.type === 'success' ? '#10b981' : '#ef4444' }}
          ></i>
          <span style={{ color: uploadResult.type === 'success' ? '#10b981' : '#ef4444' }}>
            {uploadResult.message}
          </span>
        </div>
      )}

      {/* Upload Button */}
      <div className="mb-8">
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="px-6 py-3 rounded-lg font-medium text-lg transition-opacity"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            opacity: !selectedFile || uploading ? 0.5 : 1,
            cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer',
          }}
        >
          <i className={`bi ${uploading ? 'bi-arrow-repeat animate-spin' : 'bi-cloud-upload'} mr-2`}></i>
          {uploading ? 'Uploading...' : 'Upload Survey'}
        </button>
      </div>

      {/* Analytics Processing Section */}
      <div className="mb-8 p-6 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          <i className="bi bi-bar-chart-line mr-2"></i>
          Run Analytics
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Manually trigger analytics processing to update dashboard data.
        </p>

        {/* Processing Type Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Processing Type
          </label>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'process_all', label: 'All Data' },
              { value: 'process_us', label: 'US Only' },
              { value: 'process_international', label: 'International Only' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setProcessingAction(option.value as ProcessingAction)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: processingAction === option.value ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: processingAction === option.value ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${processingAction === option.value ? 'var(--accent)' : 'var(--border)'}`,
                  opacity: isProcessing ? 0.7 : 1,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Processing Status */}
        {jobStatus && (
          <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Job Status
              </span>
              <span
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: jobStatus.status === 'completed' ? '#10b98120' :
                             jobStatus.status === 'failed' ? '#ef444420' :
                             'var(--accent-light)',
                  color: jobStatus.status === 'completed' ? '#10b981' :
                         jobStatus.status === 'failed' ? '#ef4444' :
                         'var(--accent)',
                }}
              >
                {jobStatus.status}
              </span>
            </div>
            {jobStatus.rowsIngested !== undefined && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Rows processed: {jobStatus.rowsIngested.toLocaleString()}
              </p>
            )}
            {jobStatus.errorMessage && (
              <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                Error: {jobStatus.errorMessage}
              </p>
            )}
          </div>
        )}

        {/* Processing Result */}
        {processingResult && (
          <div
            className="mb-4 p-4 rounded-lg flex items-center gap-3"
            style={{
              background: processingResult.type === 'success' ? '#10b98120' : '#ef444420',
              border: `1px solid ${processingResult.type === 'success' ? '#10b981' : '#ef4444'}`,
            }}
          >
            <i
              className={`bi ${processingResult.type === 'success' ? 'bi-check-circle' : 'bi-x-circle'} text-lg`}
              style={{ color: processingResult.type === 'success' ? '#10b981' : '#ef4444' }}
            ></i>
            <span style={{ color: processingResult.type === 'success' ? '#10b981' : '#ef4444' }}>
              {processingResult.message}
            </span>
          </div>
        )}

        {/* Run Analytics Button */}
        <button
          onClick={handleTriggerProcessing}
          disabled={isProcessing}
          className="px-6 py-3 rounded-lg font-medium transition-opacity"
          style={{
            background: '#6366f1',
            color: '#fff',
            opacity: isProcessing ? 0.5 : 1,
            cursor: isProcessing ? 'not-allowed' : 'pointer',
          }}
        >
          <i className={`bi ${isProcessing ? 'bi-arrow-repeat animate-spin' : 'bi-play-fill'} mr-2`}></i>
          {isProcessing ? 'Processing...' : 'Run Analytics'}
        </button>
      </div>

      {/* Recent Uploads */}
      {recentUploads.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Recent Uploads
          </h2>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Filename
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Time
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentUploads.map((upload) => (
                  <tr
                    key={upload.id}
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                        {upload.filename}
                      </span>
                      {upload.waveNumber && (
                        <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          Wave {upload.waveNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {upload.uploadType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {new Date(upload.timestamp).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {upload.status === 'success' ? (
                        <span className="flex items-center gap-1 text-sm" style={{ color: '#10b981' }}>
                          <i className="bi bi-check-circle"></i>
                          Success
                        </span>
                      ) : (
                        <span
                          className="flex items-center gap-1 text-sm"
                          style={{ color: '#ef4444' }}
                          title={upload.error}
                        >
                          <i className="bi bi-x-circle"></i>
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
