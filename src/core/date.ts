// Calendar dates are stored as local "YYYY-MM-DD" strings and times as minutes
// since midnight. No Date objects in the data model → no time-zone drift.

declare const isoDateBrand: unique symbol;
export type ISODate = string & { readonly [isoDateBrand]: true };
/** Minutes since local midnight, 0..1440. */
export type Minutes = number;

const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: string): value is ISODate {
  if (!ISO_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function toISODate(value: string): ISODate {
  if (!isISODate(value)) throw new Error(`Invalid date: ${value}`);
  return value;
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function fromLocalDate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` as ISODate;
}

export function today(): ISODate {
  return fromLocalDate(new Date());
}

export function nowMinutes(): Minutes {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** Day number since epoch (UTC-based, DST-safe). */
function dayNumber(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function fromDayNumber(n: number): ISODate {
  const dt = new Date(n * DAY_MS);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}` as ISODate;
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromDayNumber(dayNumber(date) + days);
}

/** b − a in days. */
export function diffDays(a: ISODate, b: ISODate): number {
  return dayNumber(b) - dayNumber(a);
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(date: ISODate): number {
  // 1970-01-01 was a Thursday (index 3).
  return (((dayNumber(date) + 3) % 7) + 7) % 7;
}

export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -weekday(date));
}

export function addMonths(date: ISODate, months: number): ISODate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, lastDay))}` as ISODate;
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function dateRange(from: ISODate, days: number): ISODate[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}

export function toJSDate(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

// ── Time ─────────────────────────────────────────────────────────────────────

export function parseTime(hhmm: string): Minutes {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) throw new Error(`Invalid time: ${hhmm}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatTime(min: Minutes): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** "1 ч 40 мин", "45 мин", "2 ч". */
export function formatDuration(min: Minutes): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

// ── Formatting (ru) ──────────────────────────────────────────────────────────

const fmtDayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const fmtWeekdayShort = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
const fmtWeekdayLong = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' });

export function formatDayMonth(date: ISODate): string {
  return fmtDayMonth.format(toJSDate(date));
}

export function formatWeekday(date: ISODate, style: 'short' | 'long' = 'short'): string {
  return (style === 'short' ? fmtWeekdayShort : fmtWeekdayLong).format(toJSDate(date));
}

/** "Сегодня", "Завтра", "Вчера" or "пятница, 24 октября". */
export function formatRelativeDay(date: ISODate, base: ISODate = today()): string {
  const diff = diffDays(base, date);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  if (diff === -1) return 'Вчера';
  return `${formatWeekday(date, 'long')}, ${formatDayMonth(date)}`;
}
