// API configuration
// In development, Vite proxies /api to the Lambda endpoint
// In production, we need to call the Lambda directly

const isDev = import.meta.env.DEV;

export const API_BASE = isDev
  ? '/api'
  : import.meta.env.VITE_DATA_API_URL;
