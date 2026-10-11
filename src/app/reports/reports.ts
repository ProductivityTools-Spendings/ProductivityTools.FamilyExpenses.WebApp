import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CategoryDetail, CategoryMonth, Hygiene, RecurringPayment, ReportService } from '../services/report.service';

/** Row of the category × month pivot (report 1). */
interface PivotRow {
  category: string;
  byMonth: Record<string, number>;
  total: number;
  avg: number;
}

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return ym(new Date(y, m - 1 + delta, 1));
}

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = shiftMonth(cur, 1);
  }
  return out;
}

@Component({
  selector: 'app-reports',
  imports: [CurrencyPipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reports implements OnInit {
  private readonly service = inject(ReportService);

  // --- filters -------------------------------------------------------------
  protected from = shiftMonth(ym(new Date()), -11);
  protected to = ym(new Date());

  // --- data ----------------------------------------------------------------
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly categoryData = signal<CategoryMonth[]>([]);
  /** Range extended by 11 months backwards so that every month in the range has a full 12-month window. */
  protected readonly matData = signal<CategoryMonth[]>([]);
  protected readonly recurring = signal<RecurringPayment[]>([]);
  protected readonly hygiene = signal<Hygiene | null>(null);

  // --- report 1: pivot -----------------------------------------------------
  protected readonly months = computed(() => monthsBetween(this.fromApplied(), this.toApplied()));
  private readonly fromApplied = signal(this.from);
  private readonly toApplied = signal(this.to);

  protected readonly pivot = computed<PivotRow[]>(() => {
    const months = this.months();
    const map = new Map<string, PivotRow>();
    for (const r of this.categoryData()) {
      let row = map.get(r.category);
      if (!row) {
        row = { category: r.category, byMonth: {}, total: 0, avg: 0 };
        map.set(r.category, row);
      }
      row.byMonth[r.month] = (row.byMonth[r.month] ?? 0) + r.total;
      row.total += r.total;
    }
    const rows = [...map.values()].map((r) => ({ ...r, avg: months.length ? r.total / months.length : 0 }));
    return rows.sort((a, b) => a.total - b.total); // most negative (largest expense) first
  });

  /** Categories unticked in the pivot – greyed out and left out of the totals. Persisted in localStorage. */
  private static readonly EXCLUDED_KEY = 'reports.pivot.excludedCategories';
  protected readonly excluded = signal<Set<string>>(new Set(JSON.parse(localStorage.getItem(Reports.EXCLUDED_KEY) ?? '[]')));

  protected isIncluded(category: string): boolean {
    return !this.excluded().has(category);
  }

  protected toggleCategory(category: string): void {
    this.excluded.update((set) => {
      const next = new Set(set);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      localStorage.setItem(Reports.EXCLUDED_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  protected readonly allIncluded = computed(() => this.pivot().every((r) => this.isIncluded(r.category)));

  protected toggleAll(): void {
    const include = !this.allIncluded();
    this.excluded.update(() => {
      const next = include ? new Set<string>() : new Set(this.pivot().map((r) => r.category));
      localStorage.setItem(Reports.EXCLUDED_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  /** Month totals over included categories only. */
  protected readonly pivotMonthTotals = computed<Record<string, number>>(() => {
    const excluded = this.excluded();
    const totals: Record<string, number> = {};
    for (const r of this.categoryData()) {
      if (excluded.has(r.category)) continue;
      totals[r.month] = (totals[r.month] ?? 0) + r.total;
    }
    return totals;
  });

  protected readonly pivotGrandTotal = computed(() => Object.values(this.pivotMonthTotals()).reduce((a, b) => a + b, 0));

  /** Largest absolute monthly value in the pivot – scales the inline heat bars. */
  protected readonly pivotMax = computed(() =>
    Math.max(1, ...this.pivot().flatMap((r) => Object.values(r.byMonth).map((v) => Math.abs(v)))),
  );

  // --- report 1: drill-down ---------------------------------------------------
  /** Currently opened pivot cell; null = panel closed. */
  protected readonly drill = signal<{ category: string | null; from: string; to: string } | null>(null);
  protected readonly drillRows = signal<CategoryDetail[]>([]);
  protected readonly drillLoading = signal(false);
  protected readonly drillTotal = computed(() => this.drillRows().reduce((s, r) => s + r.amountPln, 0));

  /** category = null → all categories; month = null → whole selected range. */
  protected openDrill(category: string | null, month: string | null): void {
    const from = month ?? this.fromApplied();
    const to = month ?? this.toApplied();
    this.drill.set({ category, from, to });
    this.drillLoading.set(true);
    this.service.categoryMonthlyDetails(from, to, category ?? undefined).subscribe({
      next: (rows) => {
        this.drillRows.set(rows);
        this.drillLoading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Nie udało się pobrać szczegółów.');
        this.drillLoading.set(false);
      },
    });
  }

  protected closeDrill(): void {
    this.drill.set(null);
    this.drillRows.set([]);
  }

  protected drillTitle(): string {
    const d = this.drill();
    if (!d) return '';
    const period = d.from === d.to ? d.from : `${d.from} – ${d.to}`;
    return `${d.category ?? 'Wszystkie kategorie'} · ${period}`;
  }

  // --- MAT: moving annual total --------------------------------------------
  private static readonly MAT_EXCLUDED_KEY = 'reports.mat.excludedCategories';
  protected readonly matExcluded = signal<Set<string>>(new Set(JSON.parse(localStorage.getItem(Reports.MAT_EXCLUDED_KEY) ?? '[]')));

  /** All categories present in the loaded MAT window, sorted by total spend. */
  protected readonly matCategories = computed(() => {
    const totals = new Map<string, number>();
    for (const r of this.matData()) totals.set(r.category, (totals.get(r.category) ?? 0) + r.total);
    return [...totals.entries()].sort((a, b) => a[1] - b[1]).map(([c]) => c);
  });

  protected matIncluded(category: string): boolean {
    return !this.matExcluded().has(category);
  }

  protected toggleMatCategory(category: string): void {
    this.matExcluded.update((set) => {
      const next = new Set(set);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      localStorage.setItem(Reports.MAT_EXCLUDED_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  protected matSetAll(include: boolean): void {
    this.matExcluded.update(() => {
      const next = include ? new Set<string>() : new Set(this.matCategories());
      localStorage.setItem(Reports.MAT_EXCLUDED_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  /** Per displayed month: that month's net total and the rolling 12-month total (both over included categories). */
  protected readonly matRows = computed<{ month: string; monthly: number; mat: number }[]>(() => {
    const excluded = this.matExcluded();
    const byMonth = new Map<string, number>();
    for (const r of this.matData()) {
      if (excluded.has(r.category)) continue;
      byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + r.total);
    }
    return this.months().map((m) => {
      let mat = 0;
      for (let i = 0; i < 12; i++) mat += byMonth.get(shiftMonth(m, -i)) ?? 0;
      return { month: m, monthly: byMonth.get(m) ?? 0, mat };
    });
  });

  // SVG chart geometry
  protected readonly chartW = 900;
  protected readonly chartH = 260;
  protected readonly chartPad = { l: 70, r: 16, t: 12, b: 36 };

  protected readonly matMax = computed(() => Math.max(1, ...this.matRows().map((r) => Math.abs(r.mat))));

  protected chartX(i: number): number {
    const n = Math.max(1, this.matRows().length - 1);
    return this.chartPad.l + (i * (this.chartW - this.chartPad.l - this.chartPad.r)) / n;
  }

  protected chartY(value: number): number {
    const h = this.chartH - this.chartPad.t - this.chartPad.b;
    return this.chartPad.t + h - (Math.abs(value) / this.matMax()) * h;
  }

  protected readonly matPath = computed(() =>
    this.matRows().map((r, i) => `${i === 0 ? 'M' : 'L'}${this.chartX(i).toFixed(1)},${this.chartY(r.mat).toFixed(1)}`).join(' '),
  );

  /** Y-axis gridlines (4 steps). */
  protected readonly matTicks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: this.chartY(f * this.matMax()), value: -f * this.matMax() })));

  protected barHeight(value: number): number {
    return this.chartH - this.chartPad.b - this.chartY(value);
  }

  // --- report 8: recurring ------------------------------------------------
  protected readonly showInactive = signal(false);
  protected readonly recurringRows = computed(() =>
    this.recurring().filter((r) => this.showInactive() || r.active),
  );
  protected readonly recurringMonthlyTotal = computed(() =>
    this.recurringRows().reduce((s, r) => s + r.monthlyAvg12m, 0),
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    if (this.from > this.to) {
      [this.from, this.to] = [this.to, this.from];
    }
    this.fromApplied.set(this.from);
    this.toApplied.set(this.to);
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      categories: this.service.categoryMonthly(this.from, this.to),
      mat: this.service.categoryMonthly(shiftMonth(this.from, -11), this.to),
      recurring: this.service.recurring(3),
      hygiene: this.service.hygiene(),
    }).subscribe({
      next: ({ categories, mat, recurring, hygiene }) => {
        this.categoryData.set(categories);
        this.matData.set(mat);
        this.recurring.set(recurring);
        this.hygiene.set(hygiene);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Nie udało się pobrać raportów.');
        this.loading.set(false);
      },
    });
  }

  protected barWidth(value: number, max: number): string {
    return `${Math.min(100, (Math.abs(value) / max) * 100).toFixed(1)}%`;
  }

  protected toggleInactive(): void {
    this.showInactive.update((v) => !v);
  }

}
