interface ClearConfirmModalProps {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void;
}

export function ClearConfirmModal({ show, onHide, onConfirm }: ClearConfirmModalProps) {
  if (!show) return null;

  return (
    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border shadow-sm">
          <div className="modal-body">
            <h5 className="modal-title fs-6 fw-semibold mb-1 d-flex align-items-center">
              <i className="bi bi-exclamation-triangle me-2" aria-hidden="true"></i>
              Heads up!
            </h5>
            <hr className="mb-3" />
            <p className="small text-muted">
              This action will reset all search parameters to their default values.
            </p>
            <div className="d-flex justify-content-end gap-1">
              <button type="button" className="btn btn-light-grey btn-sm" onClick={onHide}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={onConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
