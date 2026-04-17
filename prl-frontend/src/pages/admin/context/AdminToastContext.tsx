/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { addErrorLog } from '../utils/errorLogService';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  details?: string;
  duration?: number;
}

interface AdminToastContextType {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, details?: string, duration?: number) => void;
  showError: (message: string, error?: unknown, action?: string) => void;
  showSuccess: (message: string) => void;
  dismissToast: (id: string) => void;
}

const AdminToastContext = createContext<AdminToastContextType | null>(null);

const DEFAULT_DURATION = 5000;
const ERROR_DURATION = 8000;

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, details?: string, duration?: number) => {
      const id = crypto.randomUUID();
      const toast: Toast = {
        id,
        type,
        message,
        details,
        duration: duration ?? (type === 'error' ? ERROR_DURATION : DEFAULT_DURATION),
      };

      setToasts((prev) => [...prev, toast]);

      // Auto-dismiss after duration
      if (toast.duration && toast.duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, toast.duration);
      }
    },
    [dismissToast]
  );

  const showError = useCallback(
    (message: string, error?: unknown, action?: string) => {
      // Log the error to console with full details
      const timestamp = new Date().toISOString();
      const errorDetails = error instanceof Error
        ? error.message
        : error
          ? String(error)
          : undefined;

      console.error(`[Admin Error ${timestamp}]`, message, error);

      // Show toast to user
      showToast('error', message, errorDetails);

      // Persist to localStorage
      addErrorLog({
        level: 'error',
        message,
        details: errorDetails,
        stack: error instanceof Error ? error.stack : undefined,
        source: window.location.pathname,
        action,
      });
    },
    [showToast]
  );

  const showSuccess = useCallback(
    (message: string) => {
      showToast('success', message);
    },
    [showToast]
  );

  return (
    <AdminToastContext.Provider value={{ toasts, showToast, showError, showSuccess, dismissToast }}>
      {children}
    </AdminToastContext.Provider>
  );
}

export function useAdminToast() {
  const context = useContext(AdminToastContext);
  if (!context) {
    throw new Error('useAdminToast must be used within an AdminToastProvider');
  }
  return context;
}
