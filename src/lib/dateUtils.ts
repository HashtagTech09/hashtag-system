/**
 * IST (Indian Standard Time) date utilities.
 * All date logic in this app should use these helpers
 * to avoid UTC vs local timezone mismatches.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30

/** Returns the current Date object adjusted to IST */
export function nowIST(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + IST_OFFSET_MS);
}

/** Returns today's date string in IST as "YYYY-MM-DD" */
export function todayIST(): string {
  const ist = nowIST();
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, "0");
  const d = String(ist.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Converts a UTC timestamp string to IST date string "YYYY-MM-DD" */
export function toISTDateString(utcTimestamp: string): string {
  const date = new Date(utcTimestamp);
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + IST_OFFSET_MS);
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, "0");
  const d = String(ist.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
