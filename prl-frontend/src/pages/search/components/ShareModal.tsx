import { useState, useEffect, useCallback } from 'react';
import LZString from 'lz-string';
import type { SearchFilters, SortMode } from '../types';

interface ShareModalProps {
  show: boolean;
  onHide: () => void;
  filters: SearchFilters;
  sortMode: SortMode;
}

export function ShareModal({ show, onHide, filters, sortMode }: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Generate share URL when modal opens
  useEffect(() => {
    if (show) {
      const state = { ...filters, sort_mode: sortMode };
      const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(state));
      const url = `${window.location.origin}${window.location.pathname}#${compressed}`;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShareUrl(url);
      setCopied(false);
    }
  }, [show, filters, sortMode]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  if (!show) return null;

  return (
    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border shadow-sm">
          <div className="modal-body">
            <h5 className="modal-title fs-6 fw-semibold mb-1 d-flex align-items-center">
              <i className="bi bi-link-45deg me-2" aria-hidden="true"></i>
              Share This Search
            </h5>
            <hr className="mb-3" />
            <p className="small text-muted">Copy this link to share your current search with others.</p>
            <div className="input-group mb-3">
              <input
                type="text"
                className="form-control bg-light small"
                readOnly
                value={shareUrl}
              />
              <button
                className="btn btn-light-grey btn-sm"
                type="button"
                onClick={handleCopy}
                title="Copy to clipboard"
              >
                <i className={`bi ${copied ? 'bi-check-lg' : 'bi-clipboard'}`} aria-hidden="true"></i>
              </button>
            </div>
            {copied && <p className="small text-success mb-2">Copied to clipboard!</p>}
            <div className="d-flex justify-content-end gap-1">
              <button type="button" className="btn btn-light-grey btn-sm" onClick={onHide}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
