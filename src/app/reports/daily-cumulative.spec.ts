import {
  aggregateMonth,
  compareRows,
  compareTotals,
  cumulativeSum,
  dayLabel,
  daysInMonth,
  elapsedDays,
  forecast,
  mergeCategories,
  niceStep,
  NO_CATEGORY,
  shiftMonth,
  ticks,
  totalSeries,
} from './daily-cumulative';

describe('daily-cumulative', () => {
  const rows = [
    { operationDate: '2026-03-01', category: 'Jedzenie', amountPln: -100 },
    { operationDate: '2026-03-01', category: 'Jedzenie', amountPln: -50 },
    { operationDate: '2026-03-03', category: 'Jedzenie', amountPln: -30 },
    { operationDate: '2026-03-02', category: 'Paliwo', amountPln: -200 },
    { operationDate: '2026-03-04', category: 'Zwroty', amountPln: 80 },
    { operationDate: '2026-03-05', category: null, amountPln: -10 },
    { operationDate: '2026-02-28', category: 'Jedzenie', amountPln: -999 }, // other month – ignored
    { operationDate: '28.02.2026', category: 'Jedzenie', amountPln: -999 }, // bad format – ignored
    { operationDate: '2026-03-10T12:00:00', category: 'Paliwo', amountPln: -5 }, // timestamp – first 10 chars used
  ];

  it('daysInMonth / shiftMonth / dayLabel', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-03')).toBe(31);
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(dayLabel('2026-03', 7)).toBe('2026-03-07');
  });

  it('elapsedDays depends on today', () => {
    const today = new Date(2026, 2, 15); // 2026-03-15
    expect(elapsedDays('2026-02', today)).toBe(28);
    expect(elapsedDays('2026-03', today)).toBe(15);
    expect(elapsedDays('2026-04', today)).toBe(0);
  });

  it('cumulativeSum', () => {
    expect(cumulativeSum([1, -2, 3])).toEqual([1, -1, 2]);
    expect(cumulativeSum([])).toEqual([]);
  });

  it('aggregateMonth groups by day × category and orders categories by spend', () => {
    const m = aggregateMonth(rows, '2026-03');
    expect(m.days).toBe(31);
    expect(m.categories).toEqual(['Paliwo', 'Jedzenie', NO_CATEGORY, 'Zwroty']);
    expect(m.daily['Jedzenie'][0]).toBe(-150);
    expect(m.daily['Jedzenie'][2]).toBe(-30);
    expect(m.daily['Paliwo'][9]).toBe(-5);
    expect(m.cumulative['Jedzenie'].slice(0, 4)).toEqual([-150, -150, -180, -180]);
    expect(m.cumulative['Jedzenie'][30]).toBe(-180);
    expect(m.cumulative['Zwroty'][3]).toBe(80);
    expect(m.cumulative['Zwroty'][2]).toBe(0);
    expect(m.daily['Paliwo']).toHaveLength(31);
  });

  it('aggregateMonth on empty input', () => {
    const m = aggregateMonth([], '2026-02');
    expect(m.categories).toEqual([]);
    expect(m.days).toBe(28);
  });

  it('totalSeries sums included categories only', () => {
    const m = aggregateMonth(rows, '2026-03');
    const all = totalSeries(m, new Set());
    expect(all[0]).toBe(-150);
    expect(all[1]).toBe(-350);
    expect(all[3]).toBe(-300); // +80 refund
    expect(all[30]).toBe(-315);
    const noFuel = totalSeries(m, new Set(['Paliwo']));
    expect(noFuel[1]).toBe(-150);
    expect(noFuel[30]).toBe(-110);
  });

  it('mergeCategories keeps primary order and appends the rest', () => {
    const cur = aggregateMonth(rows, '2026-03');
    const prev = aggregateMonth([{ operationDate: '2026-02-01', category: 'Czynsz', amountPln: -1 }, rows[0]], '2026-02');
    expect(mergeCategories(cur, prev)).toEqual(['Paliwo', 'Jedzenie', NO_CATEGORY, 'Zwroty', 'Czynsz']);
  });

  it('forecast scales linearly', () => {
    expect(forecast(-300, 10, 30)).toBe(-900);
    expect(forecast(-300, 0, 30)).toBe(0);
  });

  it('compareRows / compareTotals compare categories with the previous month at the same day', () => {
    const cur = aggregateMonth(rows, '2026-03');
    const prev = aggregateMonth(
      [
        { operationDate: '2026-02-01', category: 'Jedzenie', amountPln: -100 },
        { operationDate: '2026-02-20', category: 'Jedzenie', amountPln: -40 },
        { operationDate: '2026-02-02', category: 'Czynsz', amountPln: -500 },
      ],
      '2026-02',
    );
    const cats = mergeCategories(cur, prev);
    const r = compareRows(cur, prev, cats, 3);
    expect(r.map((x) => x.category)).toEqual(cats);
    const food = r.find((x) => x.category === 'Jedzenie')!;
    expect(food).toEqual({ category: 'Jedzenie', cur: -180, prevSameDay: -100, prevTotal: -140, diff: -80 });
    // category present only in the previous month
    expect(r.find((x) => x.category === 'Czynsz')).toEqual({ category: 'Czynsz', cur: 0, prevSameDay: -500, prevTotal: -500, diff: 500 });
    // category present only in the current month
    expect(r.find((x) => x.category === 'Paliwo')).toEqual({ category: 'Paliwo', cur: -200, prevSameDay: 0, prevTotal: 0, diff: -200 });
    // elapsed beyond the previous month's length is clipped (31 > 28)
    expect(compareRows(cur, prev, ['Jedzenie'], 31)[0]).toMatchObject({ cur: -180, prevSameDay: -140 });
    // nothing elapsed yet
    expect(compareRows(cur, prev, ['Jedzenie'], 0)[0]).toEqual({ category: 'Jedzenie', cur: 0, prevSameDay: 0, prevTotal: -140, diff: 0 });

    const totals = compareTotals(r, new Set(['Paliwo']));
    expect(totals).toEqual({ cur: -180, prevSameDay: -600, prevTotal: -640 });
    expect(compareTotals(r, new Set()).cur).toBe(totalSeries(cur, new Set())[2]);
  });

  it('niceStep and ticks', () => {
    expect(niceStep(1000)).toBe(200);
    expect(niceStep(2700)).toBe(500);
    expect(niceStep(12000)).toBe(2000);
    expect(niceStep(0)).toBe(1);
    expect(ticks(1000, 0, 500)).toEqual([0, 500, 1000]);
    expect(ticks(900, 120, 500)).toEqual([-500, 0, 500]);
  });
});
