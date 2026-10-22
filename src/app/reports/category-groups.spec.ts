import {
  aggregateByGroup,
  categoryGroupMap,
  effectiveSelection,
  groupCategories,
  groupColor,
  groupLabel,
  groupOrder,
  isCategoryVisible,
  MonthlyRow,
  NO_GROUP,
  NO_GROUP_COLOR,
  NO_GROUP_LABEL,
  orderedGroups,
  toggleGroupExclusion,
} from './category-groups';
import { NO_CATEGORY } from './daily-cumulative';

describe('category-groups', () => {
  const groups = [
    { id: 2, name: 'Dom', color: null, sortOrder: 1 },
    { id: 1, name: 'Auto', color: '#ff0000', sortOrder: 0 },
    { id: 3, name: 'Dzieci', color: '#00ff00', sortOrder: 1 },
  ];
  const rows = [
    { category: 'Paliwo', group: 'Auto' },
    { category: 'Serwis', group: 'Auto' },
    { category: 'Czynsz', group: 'Dom' },
    { category: 'Hobby', group: null },
    { category: null, group: null },
    { category: 'Legacy', group: 'Stara' }, // group not (yet) known from hygiene
  ];
  const map = categoryGroupMap(rows);

  it('categoryGroupMap maps null category/group to the pseudo keys', () => {
    expect(map.get('Paliwo')).toBe('Auto');
    expect(map.get('Hobby')).toBe(NO_GROUP);
    expect(map.get(NO_CATEGORY)).toBe(NO_GROUP);
    expect(categoryGroupMap([{ category: 'X' }]).get('X')).toBe(NO_GROUP); // field absent → ungrouped
  });

  it('orderedGroups sorts by sortOrder then name', () => {
    expect(orderedGroups(groups).map((g) => g.name)).toEqual(['Auto', 'Dom', 'Dzieci']);
  });

  it('groupOrder: known groups, then unknown ones from data, NO_GROUP last', () => {
    expect(groupOrder(groups, map)).toEqual(['Auto', 'Dom', 'Dzieci', 'Stara', NO_GROUP]);
    expect(groupOrder([], new Map())).toEqual([NO_GROUP]);
  });

  it('groupLabel / groupColor', () => {
    expect(groupLabel(NO_GROUP)).toBe(NO_GROUP_LABEL);
    expect(groupLabel('Dom')).toBe('Dom');
    expect(groupColor(NO_GROUP, groups)).toBe(NO_GROUP_COLOR);
    expect(groupColor('Auto', groups)).toBe('#ff0000');
    expect(groupColor('Dom', groups)).toMatch(/^#[0-9a-f]{6}$/); // fallback palette
    expect(groupColor('Stara', groups)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('effectiveSelection drops unknown keys', () => {
    expect([...effectiveSelection(['Auto', 'Gone', NO_GROUP], groups)]).toEqual(['Auto', NO_GROUP]);
    expect(effectiveSelection(['Gone'], groups).size).toBe(0); // falls back to "all"
  });

  it('isCategoryVisible: empty selection shows everything', () => {
    expect(isCategoryVisible('Paliwo', map, new Set())).toBe(true);
    expect(isCategoryVisible('Paliwo', map, new Set(['Dom']))).toBe(false);
    expect(isCategoryVisible('Paliwo', map, new Set(['Auto']))).toBe(true);
    expect(isCategoryVisible('Hobby', map, new Set([NO_GROUP]))).toBe(true);
    expect(isCategoryVisible('Unknown', map, new Set([NO_GROUP]))).toBe(true); // not in map → ungrouped
    expect(isCategoryVisible('Unknown', map, new Set(['Auto']))).toBe(false);
  });

  it('toggleGroupExclusion includes all when any is excluded, otherwise excludes all', () => {
    expect([...toggleGroupExclusion(new Set(['Serwis', 'X']), ['Paliwo', 'Serwis'])]).toEqual(['X']);
    expect([...toggleGroupExclusion(new Set(['X']), ['Paliwo', 'Serwis'])].sort()).toEqual(['Paliwo', 'Serwis', 'X']);
    expect(toggleGroupExclusion(new Set(), []).size).toBe(0);
  });

  it('groupCategories buckets categories by group in display order', () => {
    const out = groupCategories(['Hobby', 'Czynsz', 'Paliwo', 'Serwis', 'Unknown'], map, groupOrder(groups, map));
    expect(out).toEqual([
      { group: 'Auto', categories: ['Paliwo', 'Serwis'] },
      { group: 'Dom', categories: ['Czynsz'] },
      { group: NO_GROUP, categories: ['Hobby', 'Unknown'] },
    ]);
  });

  it('aggregateByGroup sums included categories only and keeps order', () => {
    const pivot: MonthlyRow[] = [
      { category: 'Paliwo', byMonth: { '2026-01': -100, '2026-02': -50 }, total: -150, avg: -75 },
      { category: 'Serwis', byMonth: { '2026-01': -300 }, total: -300, avg: -150 },
      { category: 'Czynsz', byMonth: { '2026-02': -1000 }, total: -1000, avg: -500 },
      { category: 'Hobby', byMonth: { '2026-01': -20 }, total: -20, avg: -10 },
    ];
    const out = aggregateByGroup(pivot, map, groupOrder(groups, map), (c) => c !== 'Serwis', 2);
    expect(out.map((g) => g.group)).toEqual(['Auto', 'Dom', NO_GROUP]); // Dzieci/Stara have no rows
    const auto = out[0];
    expect(auto.label).toBe('Auto');
    expect(auto.categories.map((c) => c.category)).toEqual(['Paliwo', 'Serwis']);
    expect(auto.includedCount).toBe(1);
    expect(auto.byMonth).toEqual({ '2026-01': -100, '2026-02': -50 });
    expect(auto.total).toBe(-150);
    expect(auto.avg).toBe(-75);
    expect(out[2].label).toBe(NO_GROUP_LABEL);
    expect(out[2].total).toBe(-20);
    expect(aggregateByGroup(pivot, map, [], () => true, 0)).toEqual([]);
  });
});
