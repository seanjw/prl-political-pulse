export interface PrimaryDateInfo {
  date: string;          // ISO "YYYY-MM-DD"
  runoffDate?: string;   // Optional runoff date
  notes?: string;        // e.g. "Top-two primary"
}

// 2026 primary election dates by state code
// Sources: NCSL, 270toWin, FEC, state SOS offices
export const PRIMARY_DATES: Record<string, PrimaryDateInfo> = {
  AL: { date: '2026-06-02', runoffDate: '2026-07-14' },
  AK: { date: '2026-08-18', notes: 'Top-four primary + RCV general' },
  AZ: { date: '2026-08-04' },
  AR: { date: '2026-03-03', runoffDate: '2026-04-07' },
  CA: { date: '2026-06-02', notes: 'Top-two primary' },
  CO: { date: '2026-06-30' },
  CT: { date: '2026-08-11' },
  DE: { date: '2026-09-15' },
  FL: { date: '2026-08-18' },
  GA: { date: '2026-05-19', runoffDate: '2026-06-16' },
  HI: { date: '2026-08-08' },
  ID: { date: '2026-05-19' },
  IL: { date: '2026-03-17' },
  IN: { date: '2026-05-05' },
  IA: { date: '2026-06-02' },
  KS: { date: '2026-08-04' },
  KY: { date: '2026-05-19' },
  LA: { date: '2026-08-15', runoffDate: '2026-09-19', notes: 'Closed primaries' },
  ME: { date: '2026-06-09', notes: 'RCV for federal races' },
  MD: { date: '2026-06-23' },
  MA: { date: '2026-09-08' },
  MI: { date: '2026-08-04' },
  MN: { date: '2026-08-11' },
  MS: { date: '2026-06-02', runoffDate: '2026-06-23' },
  MO: { date: '2026-08-04' },
  MT: { date: '2026-06-02' },
  NE: { date: '2026-05-12' },
  NV: { date: '2026-06-09' },
  NH: { date: '2026-09-08' },
  NJ: { date: '2026-06-02' },
  NM: { date: '2026-06-02' },
  NY: { date: '2026-06-23' },
  NC: { date: '2026-03-03', runoffDate: '2026-04-14' },
  ND: { date: '2026-06-09' },
  OH: { date: '2026-05-05' },
  OK: { date: '2026-06-30', runoffDate: '2026-08-25' },
  OR: { date: '2026-05-19' },
  PA: { date: '2026-05-19' },
  RI: { date: '2026-09-08' },
  SC: { date: '2026-06-09', runoffDate: '2026-06-23' },
  SD: { date: '2026-06-02', runoffDate: '2026-06-23' },
  TN: { date: '2026-08-06' },
  TX: { date: '2026-03-03', runoffDate: '2026-04-07' },
  UT: { date: '2026-06-30' },
  VT: { date: '2026-08-11' },
  VA: { date: '2026-06-09' },
  WA: { date: '2026-08-04', notes: 'Top-two primary' },
  WV: { date: '2026-05-12' },
  WI: { date: '2026-08-11' },
  WY: { date: '2026-08-18' },
  DC: { date: '2026-06-16' },
};

export function formatPrimaryDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function daysUntil(iso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(iso + 'T00:00:00');
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getCountdownText(iso: string): string {
  const days = daysUntil(iso);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `${days} days away`;
  if (days === -1) return '1 day ago';
  return `${Math.abs(days)} days ago`;
}

export function isPrimaryPast(iso: string): boolean {
  return daysUntil(iso) < 0;
}
