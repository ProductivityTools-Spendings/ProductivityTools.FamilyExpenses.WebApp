/**
 * Pure aggregation helpers for the "Wydatki narastająco" (cumulative daily spending) chart.
 * No Angular dependencies – covered by daily-cumulative.spec.ts.
 *
 * Sign convention (as everywhere in the app): expenses are negative, refunds/inflows positive.
 */

/** Minimal shape of a transaction row needed for the aggregation (subset of CategoryDetail). */
export interface DailyRow {
  operationDate: string;
  category: string | null;
  amountPln: number;
}

/** Label used for rows without a category. */
export const NO_CATEGORY = '(bez kategorii)';

/** One month aggregated into day × category matrices. Day arrays are 0-based (index 0 = 1st of the month). */
export interface DailyMonth {
  month: string;
  days: number;
  /** All categories of the month, largest spender (most negative net) first. */
  categories: string[];
  /** Net amount booked in the category on each day. */
  daily: Record<string, number[]>;
  /** Running net total of the category from day 1 to the given day inclusive. */
  cumulative: Record<string, number[]>;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** 'YYYY-MM' of the month `delta` months away. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' for a 1-based day of the month. */
export function dayLabel(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, '0')}`;
}

/**
 * Number of days of `month` that have already elapsed (and should be drawn as bars):
 * the whole month for past months, today's day number for the current month, 0 for future months.
 */
export function elapsedDays(month: string, today: Date): number {
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (month < current) return daysInMonth(month);
  if (month === current) return today.getDate();
  return 0;
}

export function cumulativeSum(values: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const v of values) {
    acc += v;
    out.push(acc);
  }
  return out;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Groups rows of a single month by day × category and computes cumulative sums.
 * Rows from other months or with an unparsable operationDate are ignored.
 */
export function aggregateMonth(rows: readonly DailyRow[], month: string): DailyMonth {
  const days = daysInMonth(month);
  const daily: Record<string, number[]> = {};
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (typeof r.operationDate !== 'string' || !DATE_RE.test(r.operationDate)) continue;
    const date = r.operationDate.slice(0, 10);
    if (date.slice(0, 7) !== month) continue;
    const day = Number(date.slice(8, 10));
    if (!(day >= 1 && day <= days)) continue;
    const amount = Number(r.amountPln) || 0;
    const cat = r.category ?? NO_CATEGORY;
    (daily[cat] ??= new Array<number>(days).fill(0))[day - 1] += amount;
    totals.set(cat, (totals.get(cat) ?? 0) + amount);
  }
  const categories = [...totals.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  const cumulative: Record<string, number[]> = {};
  for (const c of categories) cumulative[c] = cumulativeSum(daily[c]);
  return { month, days, categories, daily, cumulative };
}

/** Categories of `primary` in its order, followed by categories that appear only in `secondary`. */
export function mergeCategories(primary: DailyMonth, secondary: DailyMonth): string[] {
  const seen = new Set(primary.categories);
  return [...primary.categories, ...secondary.categories.filter((c) => !seen.has(c))];
}

/** Cumulative net total per day (index 0 = day 1) over the categories not in `excluded`. */
export function totalSeries(m: DailyMonth, excluded: ReadonlySet<string>): number[] {
  const out = new Array<number>(m.days).fill(0);
  for (const c of m.categories) {
    if (excluded.has(c)) continue;
    const cum = m.cumulative[c];
    for (let i = 0; i < m.days; i++) out[i] += cum[i];
  }
  return out;
}

/** Linear end-of-month projection: total so far scaled from the elapsed days to the whole month. */
export function forecast(totalSoFar: number, daysElapsed: number, days: number): number {
  if (daysElapsed <= 0) return 0;
  return (totalSoFar / daysElapsed) * days;
}

/** A "nice" tick step (1/2/5 × 10^k) giving roughly `targetTicks` intervals over `range`. */
export function niceStep(range: number, targetTicks = 5): number {
  if (!(range > 0)) return 1;
  const raw = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const nice = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return nice * mag;
}

/** Tick values from -down to +up (inclusive, snapped to multiples of the step, always including 0). */
export function ticks(up: number, down: number, step: number): number[] {
  const out: number[] = [];
  const first = -Math.ceil(down / step);
  const last = Math.floor(up / step + 1e-9);
  for (let i = first; i <= last; i++) out.push(i * step || 0); // `|| 0` normalises -0
  return out;
}

// --- donut geometry (shared by the category-share donut and the daily chart's donut) ------------

/** One donut slice: input item plus its share, SVG path and label position. */
export interface DonutSlice<T> {
  item: T;
  value: number;
  pct: number;
  path: string;
  labelX: number;
  labelY: number;
}

/** SVG path of a ring sector between `start` and `end` (radians, clockwise from 3 o'clock); R = outer, r = inner radius, c = centre. */
export function arcPath(c: number, R: number, r: number, start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0;
  const p = (rad: number, a: number) => `${(c + rad * Math.cos(a)).toFixed(2)},${(c + rad * Math.sin(a)).toFixed(2)}`;
  return `M${p(R, start)} A${R},${R} 0 ${large} 1 ${p(R, end)} L${p(r, end)} A${r},${r} 0 ${large} 0 ${p(r, start)} Z`;
}

/**
 * Lays out `items` (value ≥ 0, in the given order) as consecutive ring sectors starting at 12 o'clock.
 * Items with value 0 get an empty sector; a single 100 % item is drawn as a full ring.
 */
export function donutSlices<T>(items: readonly T[], value: (item: T) => number, c: number, R: number, r: number): DonutSlice<T>[] {
  const sum = items.reduce((s, it) => s + value(it), 0);
  const lr = (R + r) / 2;
  let angle = -Math.PI / 2;
  return items.map((item) => {
    const v = value(item);
    const frac = sum ? v / sum : 0;
    const start = angle;
    const end = angle + Math.min(frac, 0.99999) * 2 * Math.PI;
    angle = start + frac * 2 * Math.PI;
    const mid = (start + end) / 2;
    return { item, value: v, pct: frac * 100, path: arcPath(c, R, r, start, end), labelX: c + lr * Math.cos(mid), labelY: c + lr * Math.sin(mid) };
  });
}

/**
 * Share of each included category in the cumulative spending up to `day` (1-based): only categories whose cumulative
 * net is negative (expenses) count, with their absolute value; sorted largest first.
 */
export function cumulativeShares(month: DailyMonth, day: number, excluded: Set<string>): { category: string; value: number }[] {
  if (day < 1) return [];
  const i = Math.min(day, month.days) - 1;
  return month.categories
    .filter((c) => !excluded.has(c))
    .map((c) => ({ category: c, value: -(month.cumulative[c]?.[i] ?? 0) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
}
