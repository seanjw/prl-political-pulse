const SESSION_PASSWORD_KEY = 'admin-password';
const SESSION_KEY = 'admin-authenticated';

export function getAdminPassword(): string {
  return sessionStorage.getItem(SESSION_PASSWORD_KEY) ?? '';
}

export function setAdminPassword(password: string): void {
  sessionStorage.setItem(SESSION_PASSWORD_KEY, password);
}

export function clearAdminPassword(): void {
  sessionStorage.removeItem(SESSION_PASSWORD_KEY);
}

/**
 * Handle a 401 response by clearing the session and forcing re-login.
 * Call this whenever an admin API call returns 401.
 */
export function handleUnauthorized(): void {
  sessionStorage.removeItem(SESSION_PASSWORD_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  window.location.reload();
}
