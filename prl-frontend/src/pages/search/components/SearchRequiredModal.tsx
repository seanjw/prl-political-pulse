interface SearchRequiredModalProps {
  show: boolean;
  onHide: () => void;
}

export function SearchRequiredModal({ show, onHide }: SearchRequiredModalProps) {
  if (!show) return null;

  return (
    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border shadow-sm">
          <div className="modal-body">
            <h5 className="modal-title fs-6 fw-semibold mb-1 d-flex align-items-center">
              <i className="bi bi-info-circle me-2" aria-hidden="true"></i>
              Search Term Required
            </h5>
            <hr className="mb-3" />
            <p className="small text-muted">
              Please enter a search term to find legislator statements. You can search for keywords, phrases, or topics discussed by legislators.
            </p>
            <div className="d-flex justify-content-end">
              <button type="button" className="btn btn-primary btn-sm" onClick={onHide}>
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
