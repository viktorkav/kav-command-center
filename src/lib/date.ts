// Calendar-string convention: dates are "YYYY-MM-DD" strings without TZ.
// - todayISO() returns today in LOCAL time (what the user thinks "today" is).
// - addDays/daysUntil anchor input strings to UTC midnight and operate
//   on UTC milliseconds, so calendar arithmetic is DST-safe regardless
//   of which TZ the caller is in. Output is a calendar string, not a TZ-bound instant.
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

const FOLDER_DATE_RE = /^(\d{4}-\d{2}-\d{2})\b/;

export function parseFolderDate(name: string): string | null {
  const m = name.match(FOLDER_DATE_RE);
  return m ? m[1] : null;
}

export function daysUntil(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}
