import { useAdminToast, type ToastType } from '../context/AdminToastContext';

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: string; color: string }> = {
  success: {
    bg: '#10b98120',
    border: '#10b981',
    icon: 'bi-check-circle-fill',
    color: '#10b981',
  },
  error: {
    bg: '#ef444420',
    border: '#ef4444',
    icon: 'bi-exclamation-circle-fill',
    color: '#ef4444',
  },
  warning: {
    bg: '#f59e0b20',
    border: '#f59e0b',
    icon: 'bi-exclamation-triangle-fill',
    color: '#f59e0b',
  },
  info: {
    bg: '#3b82f620',
    border: '#3b82f6',
    icon: 'bi-info-circle-fill',
    color: '#3b82f6',
  },
};

export function AdminToast() {
  const { toasts, dismissToast } = useAdminToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: '400px',
        width: '100%',
      }}
    >
      {toasts.map((toast) => {
        const styles = TOAST_STYLES[toast.type];
        return (
          <div
            key={toast.id}
            className="animate-slide-in"
            style={{
              background: 'var(--bg-primary)',
              border: `1px solid ${styles.border}`,
              borderLeft: `4px solid ${styles.border}`,
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
            }}
          >
            <i
              className={`bi ${styles.icon}`}
              style={{ color: styles.color, fontSize: '1.25rem', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  margin: 0,
                  wordBreak: 'break-word',
                }}
              >
                {toast.message}
              </p>
              {toast.details && (
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    marginTop: '0.25rem',
                    marginBottom: 0,
                    wordBreak: 'break-word',
                  }}
                >
                  {toast.details}
                </p>
              )}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                color: 'var(--text-muted)',
                flexShrink: 0,
              }}
              aria-label="Dismiss"
            >
              <i className="bi bi-x" style={{ fontSize: '1.25rem' }} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slideIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
