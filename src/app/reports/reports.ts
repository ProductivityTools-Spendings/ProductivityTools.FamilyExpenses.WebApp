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
      recurring: this.service.recurring(3),
      hygiene: this.service.hygiene(),
    }).subscribe({
      next: ({ categories, recurring, hygiene }) => {
        this.categoryData.set(categories);
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
