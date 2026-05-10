export const HOUR_HEIGHT = 42;
export const HOUR_MS = 60 * 60 * 1000;

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toLocalIsoDateTime(date: Date): string {
  const day = toIsoDate(date);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${day}T${hh}:${mm}:${ss}`;
}

export function startOfWeek(source: Date): Date {
  const date = new Date(source);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(source: Date, days: number): Date {
  const date = new Date(source);
  date.setDate(date.getDate() + days);
  return date;
}
