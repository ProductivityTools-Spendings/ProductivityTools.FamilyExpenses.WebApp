/**
 * Pure helpers for category groups on the Reports page: category → group lookup, group ordering,
 * group filter and aggregation of pivot rows by group. No Angular dependencies – covered by category-groups.spec.ts.
 */
import { NO_CATEGORY } from './daily-cumulative';

/** Group as returned by the hygiene report (`hygiene.groups`). */
export interface GroupInfo {
  id: number;
  name: string;
  color: string | null;
  sortOrder: number;
}

/** Key of the pseudo-group holding categories that have no group; always displayed last. */
export const NO_GROUP = '(bez grupy)';
/** UI label of the pseudo-group. */
export const NO_GROUP_LABEL = 'Bez grupy';
export const NO_GROUP_COLOR = '#9e9e9e';

/** Colours for groups without a configured `color`, assigned by position in the ordered group list. */
const FALLBACK_COLORS = ['#1e88e5', '#e53935', '#43a047', '#fb8c00', '#8e24aa', '#00acc1', '#6d4c41', '#3949ab', '#d81b60', '#7cb342', '#f4511e', '#00897b'];

/** Minimal shape of a report row carrying its group (subset of CategoryMonth / CategoryDetail). */
export interface GroupedRow {
  category: string | null;
  group?: string | null;
}

/** Row of the category × month pivot (minimal shape needed for the aggregation). */
export interface MonthlyRow {
  category: string;
  byMonth: Record<string, number>;
  total: number;
  avg: number;
}

/** One group of the pivot in "Grupy" mode: monthly sums over its *included* categories plus the category rows themselves. */
export interface GroupRow<T extends MonthlyRow = MonthlyRow> {
  group: string;
  label: string;
  byMonth: Record<string, number>;
  total: number;
  avg: number;
  categories: T[];
  /** Number of categories currently included (ticked). */
  includedCount: number;
}

/**
 * Builds the category → group key map from loaded rows. Rows without a category count as NO_CATEGORY,
 * rows without a group map to NO_GROUP. A category appears in at most one group, so later rows simply overwrite.
 */
export function categoryGroupMap(rows: Iterable<GroupedRow>): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.category ?? NO_CATEGORY, r.group ?? NO_GROUP);
  return map;
}

/** Groups sorted by sortOrder, then name (Polish collation). */
export function orderedGroups(groups: readonly GroupInfo[]): GroupInfo[] {
  return [...groups].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pl'));
}

/**
 * Display order of group keys: configured groups by sortOrder, then groups that occur in the data but are
 * (not yet) known from hygiene, alphabetically, and NO_GROUP last. Only keys present in `map` or `groups` are returned.
 */
export function groupOrder(groups: readonly GroupInfo[], map: Map<string, string>): string[] {
  const known = orderedGroups(groups).map((g) => g.name);
  const seen = new Set(known);
  const extra = [...new Set(map.values())].filter((g) => g !== NO_GROUP && !seen.has(g)).sort((a, b) => a.localeCompare(b, 'pl'));
  return [...known, ...extra, NO_GROUP];
}

export function groupLabel(key: string): string {
  return key === NO_GROUP ? NO_GROUP_LABEL : key;
}

/** Group colour: configured colour, otherwise a palette colour by the group's position; grey for the ungrouped bucket. */
export function groupColor(key: string, groups: readonly GroupInfo[]): string {
  if (key === NO_GROUP) return NO_GROUP_COLOR;
  const ordered = orderedGroups(groups);
  const i = ordered.findIndex((g) => g.name === key);
  if (i >= 0 && ordered[i].color) return ordered[i].color as string;
  const idx = i >= 0 ? i : ordered.length + Math.abs(hash(key)) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Normalises the persisted chip selection: keys of groups that no longer exist are dropped;
 * an empty result means "all groups" (the same as no selection at all).
 */
export function effectiveSelection(selected: Iterable<string>, groups: readonly GroupInfo[]): Set<string> {
  const valid = new Set<string>([NO_GROUP, ...groups.map((g) => g.name)]);
  return new Set([...selected].filter((k) => valid.has(k)));
}

/** True when the category's group is selected (an empty selection shows everything). */
export function isCategoryVisible(category: string, map: Map<string, string>, selection: Set<string>): boolean {
  return selection.size === 0 || selection.has(map.get(category) ?? NO_GROUP);
}

/**
 * Group checkbox semantics shared by the pivot and the daily chart: when any of the group's categories is excluded,
 * all of them become included; when all are included, all become excluded. Returns a new set.
 */
export function toggleGroupExclusion(excluded: ReadonlySet<string>, categories: readonly string[]): Set<string> {
  const include = categories.some((c) => excluded.has(c));
  const next = new Set(excluded);
  for (const c of categories) {
    if (include) next.delete(c);
    else next.add(c);
  }
  return next;
}

/** Categories of the daily chart legend bucketed by group, in `order`; groups without categories are omitted. */
export function groupCategories(categories: readonly string[], map: Map<string, string>, order: readonly string[]): { group: string; categories: string[] }[] {
  const by = new Map<string, string[]>();
  for (const c of categories) {
    const key = map.get(c) ?? NO_GROUP;
    (by.get(key) ?? by.set(key, []).get(key))!.push(c);
  }
  return order.filter((k) => by.has(k)).map((k) => ({ group: k, categories: by.get(k)! }));
}

/**
 * Aggregates pivot rows into group rows following `order`. Group sums include only categories accepted by `included`;
 * groups without any category row in the data are omitted. `months` is the number of displayed months (for the average).
 */
export function aggregateByGroup<T extends MonthlyRow>(
  rows: readonly T[],
  map: Map<string, string>,
  order: readonly string[],
  included: (category: string) => boolean,
  months: number,
): GroupRow<T>[] {
  const byGroup = new Map<string, GroupRow<T>>();
  for (const r of rows) {
    const key = map.get(r.category) ?? NO_GROUP;
    let g = byGroup.get(key);
    if (!g) {
      g = { group: key, label: groupLabel(key), byMonth: {}, total: 0, avg: 0, categories: [], includedCount: 0 };
      byGroup.set(key, g);
    }
    g.categories.push(r);
    if (!included(r.category)) continue;
    g.includedCount++;
    g.total += r.total;
    for (const [m, v] of Object.entries(r.byMonth)) g.byMonth[m] = (g.byMonth[m] ?? 0) + v;
  }
  const out: GroupRow<T>[] = [];
  for (const key of order) {
    const g = byGroup.get(key);
    if (g) out.push({ ...g, avg: months ? g.total / months : 0 });
  }
  return out;
}
