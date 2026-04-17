import { useState, useCallback, useRef } from 'react';
import { exportResults, exportResultsChunked } from '../api';
import type { SearchFilters } from '../types';

interface ExportModalProps {
  show: boolean;
  onHide: () => void;
  filters: SearchFilters;
  totalCount: number;
  selectedIds: string[];
}

export function ExportModal({ show, onHide, filters, totalCount, selectedIds }: ExportModalProps) {
  const [fileName, setFileName] = useState('Legislator_Rhetoric');
  const [exportRange, setExportRange] = useState<'all' | 'first' | 'custom' | 'selected'>('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [startIndex, setStartIndex] = useState(1);
  const [endIndex, setEndIndex] = useState(50);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<{ downloaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);
    setProgress(null);

    try {
      let blob: Blob;

      // Use chunked export for large "all" range exports to avoid API Gateway timeout
      if (exportRange === 'all' && totalCount > 500) {
        const controller = new AbortController();
        abortRef.current = controller;

        blob = await exportResultsChunked(
          filters,
          exportFormat,
          totalCount,
          (downloaded, total) => setProgress({ downloaded, total }),
          controller.signal
        );
      } else {
        blob = await exportResults(
          filters,
          exportFormat,
          exportRange,
          exportRange === 'custom' ? startIndex : undefined,
          exportRange === 'custom' ? endIndex : undefined,
          exportRange === 'selected' ? selectedIds : undefined
        );
      }

      // Download the file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onHide();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Export cancelled.');
      } else {
        console.error('Export failed:', err);
        setError(err instanceof Error ? err.message : 'Export failed. Try a smaller date range.');
      }
    } finally {
      setIsExporting(false);
      abortRef.current = null;
    }
  }, [filters, exportFormat, exportRange, startIndex, endIndex, selectedIds, fileName, onHide, totalCount]);

  const handleCancel = useCallback(() => {
    if (isExporting && abortRef.current) {
      abortRef.current.abort();
    } else {
      onHide();
    }
  }, [isExporting, onHide]);

  if (!show) return null;

  const EXPORT_LIMIT = 50_000;
  const progressPercent = progress ? Math.round((progress.downloaded / progress.total) * 100) : 0;

  // Determine effective row count for the selected range
  const effectiveCount =
    exportRange === 'all' ? totalCount :
    exportRange === 'selected' ? selectedIds.length :
    exportRange === 'custom' ? Math.max(endIndex - startIndex + 1, 0) :
    50; // "first" page
  const exceedsLimit = effectiveCount > EXPORT_LIMIT;

  return (
    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border shadow-sm">
          <div className="modal-body">
            <h5 className="modal-title fs-6 fw-semibold mb-1 d-flex align-items-center">
              <i className="bi bi-download me-2" aria-hidden="true"></i>
              Export Results
            </h5>
            <hr className="mb-3" />

            {/* Error message */}
            {error && (
              <div className="alert alert-danger small py-2 mb-3" role="alert">
                {error}
              </div>
            )}

            {/* Progress bar */}
            {isExporting && progress && (
              <div className="mb-3">
                <div className="d-flex justify-content-between small text-muted mb-1">
                  <span>Downloading rows...</span>
                  <span>{progress.downloaded.toLocaleString()} / {progress.total.toLocaleString()}</span>
                </div>
                <div className="progress" style={{ height: '6px' }}>
                  <div
                    className="progress-bar"
                    role="progressbar"
                    style={{ width: `${progressPercent}%` }}
                    aria-valuenow={progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            )}

            {/* File name */}
            <div className="mb-3">
              <label className="form-label" htmlFor="exportFileNameInput">File Name</label>
              <input
                type="text"
                id="exportFileNameInput"
                className="form-control bg-light small"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                disabled={isExporting}
              />
            </div>

            {/* Export range */}
            <div className="mb-3">
              <label className="form-label" htmlFor="exportRangeSelect">Export Range</label>
              <select
                id="exportRangeSelect"
                className="form-select bg-light small"
                value={exportRange}
                onChange={(e) => setExportRange(e.target.value as typeof exportRange)}
                disabled={isExporting}
              >
                <option value="all">All Results ({totalCount.toLocaleString()})</option>
                <option value="first">First Page (50)</option>
                <option value="custom">Custom Range</option>
                {selectedIds.length > 0 && (
                  <option value="selected">Selected ({selectedIds.length})</option>
                )}
              </select>
            </div>

            {/* Custom range inputs */}
            {exportRange === 'custom' && (
              <div className="mb-3">
                <div className="row g-2">
                  <div className="col">
                    <label className="form-label" htmlFor="exportStartPage">Start Index</label>
                    <input
                      type="number"
                      min="1"
                      id="exportStartPage"
                      className="form-control bg-light small"
                      value={startIndex}
                      onChange={(e) => setStartIndex(parseInt(e.target.value) || 1)}
                      disabled={isExporting}
                    />
                  </div>
                  <div className="col">
                    <label className="form-label" htmlFor="exportEndPage">End Index</label>
                    <input
                      type="number"
                      min="1"
                      id="exportEndPage"
                      className="form-control bg-light small"
                      value={endIndex}
                      onChange={(e) => setEndIndex(parseInt(e.target.value) || 50)}
                      disabled={isExporting}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Export limit warning */}
            {exceedsLimit && (
              <div className="alert alert-warning small py-2 mb-3" role="alert">
                Downloads are limited to {EXPORT_LIMIT.toLocaleString()} results. Your current selection has {effectiveCount.toLocaleString()} results.
                {' '}For larger exports, download the full dataset at{' '}
                <a href="https://polarizationresearchlab.org/data#section=elites" target="_blank" rel="noopener noreferrer">
                  polarizationresearchlab.org/data
                </a>.
              </div>
            )}

            {/* Export format */}
            <div className="mb-3">
              <label className="form-label" htmlFor="exportFormatSelect">Export Format</label>
              <select
                id="exportFormatSelect"
                className="form-select bg-light small"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
                disabled={isExporting}
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </div>

            {/* Modal actions */}
            <div className="d-flex justify-content-end gap-1">
              <button
                type="button"
                className="btn btn-light-grey btn-sm"
                onClick={handleCancel}
              >
                {isExporting ? 'Cancel' : 'Close'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleExport}
                disabled={isExporting || exceedsLimit}
              >
                {isExporting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    {progress ? `${progressPercent}%` : 'Exporting...'}
                  </>
                ) : (
                  'Export'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
