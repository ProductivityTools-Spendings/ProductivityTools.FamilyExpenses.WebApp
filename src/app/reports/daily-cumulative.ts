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

/** One row of the per-category comparison table under the cumulative chart. */
export interface CategoryCompareRow {
  category: string;
  /** Net cumulative in the current month up to the last drawn day (0 when absent from the month). */
  cur: number;
  /** Previous month's net cumulative at the same day index (clipped to that month's length). */
  prevSameDay: number;
  /** Previous month's net total (cumulative at its last day). */
  prevTotal: number;
  /** cur − prevSameDay; positive = less spent than a month ago (negative-expenses convention). */
  diff: number;
}

/**
 * Compares every category of `categories` between the current and the previous month
 * at the given number of elapsed days. Categories missing from a month contribute 0.
 */
export function compareRows(cur: DailyMonth, prev: DailyMonth, categories: readonly string[], elapsed: number): CategoryCompareRow[] {
  const curIdx = Math.min(elapsed, cur.days) - 1;
  const prevIdx = Math.min(elapsed, prev.days) - 1;
  return categories.map((category) => {
    const c = curIdx >= 0 ? (cur.cumulative[category]?.[curIdx] ?? 0) : 0;
    const p = prevIdx >= 0 ? (prev.cumulative[category]?.[prevIdx] ?? 0) : 0;
    const t = prev.cumulative[category]?.[prev.days - 1] ?? 0;
    return { category, cur: c, prevSameDay: p, prevTotal: t, diff: c - p };
  });
}

/** Sums of the three amount columns over rows whose category is not in `excluded`. */
export function compareTotals(rows: readonly CategoryCompareRow[], excluded: ReadonlySet<string>): { cur: number; prevSameDay: number; prevTotal: number } {
  const out = { cur: 0, prevSameDay: 0, prevTotal: 0 };
  for (const r of rows) {
    if (excluded.has(r.category)) continue;
    out.cur += r.cur;
    out.prevSameDay += r.prevSameDay;
    out.prevTotal += r.prevTotal;
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
