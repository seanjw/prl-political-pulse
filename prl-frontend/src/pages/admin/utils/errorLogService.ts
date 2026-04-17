export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warning';
  message: string;
  details?: string;
  stack?: string;
  source: string;
  action?: string;
}

const STORAGE_KEY = 'admin-error-log';
const MAX_ENTRIES = 100;

export function getErrorLog(): ErrorLogEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addErrorLog(
  entry: Omit<ErrorLogEntry, 'id' | 'timestamp'>
): ErrorLogEntry {
  const newEntry: ErrorLogEntry = {
    ...entry,
    id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
  };

  const logs = getErrorLog();

  // Add new entry at the beginning (most recent first)
  logs.unshift(newEntry);

  // Keep only the most recent MAX_ENTRIES (FIFO)
  if (logs.length > MAX_ENTRIES) {
    logs.length = MAX_ENTRIES;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // localStorage might be full - remove oldest entries and try again
    logs.length = Math.floor(MAX_ENTRIES / 2);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch {
      // If still failing, just continue without persisting
    }
  }

  return newEntry;
}

export function clearErrorLog(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportErrorLog(): string {
  const logs = getErrorLog();
  return JSON.stringify(logs, null, 2);
}
