import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MbankRawEmail } from '../models/mbank-raw-email';
import { MbankRawEmailService, openPreviewWindow, showHtmlInWindow } from '../services/mbank-raw-email.service';

/** One cell of the monthly calendar; `day` is null for the leading blanks before the 1st. */
interface CalendarCell {
  day: number | null;
  key: string;
  count: number;
  errors: number;
  future: boolean;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-mbank-emails',
  imports: [DatePipe],
  templateUrl: './mbank-emails.html',
  styleUrl: './mbank-emails.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MbankEmails implements OnInit {
  private readonly service = inject(MbankRawEmailService);

  protected readonly emails = signal<MbankRawEmail[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Id of the e-mail currently being downloaded (null = none). */
  protected readonly downloadingId = signal<number | null>(null);

  // --- calendar --------------------------------------------------------------
  protected readonly weekdays = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
  /** First day of the displayed month. */
  protected readonly calMonth = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  /** Day (yyyy-MM-dd) the list is filtered to; null = all e-mails. */
  protected readonly selectedDay = signal<string | null>(null);

  /** E-mails per calendar day (by local e-mail date). */
  private readonly byDay = computed(() => {
    const map = new Map<string, { count: number; errors: number }>();
    for (const e of this.emails()) {
      if (!e.emailDate) continue;
      const key = dayKey(new Date(e.emailDate));
      const entry = map.get(key) ?? { count: 0, errors: 0 };
      entry.count++;
      if (e.status === 'ERROR') entry.errors++;
      map.set(key, entry);
    }
    return map;
  });

  protected readonly calCells = computed<CalendarCell[]>(() => {
    const first = this.calMonth();
    const byDay = this.byDay();
    const todayKey = dayKey(new Date());
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const cells: CalendarCell[] = [];
    for (let i = 0; i < lead; i++) cells.push({ day: null, key: `blank-${i}`, count: 0, errors: 0, future: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = dayKey(new Date(first.getFullYear(), first.getMonth(), d));
      const stats = byDay.get(key);
      cells.push({ day: d, key, count: stats?.count ?? 0, errors: stats?.errors ?? 0, future: key > todayKey });
    }
    return cells;
  });

  /** Days with at least one e-mail in the displayed month. */
  protected readonly calMonthCount = computed(() => this.calCells().filter((c) => c.count > 0).length);

  protected shiftMonth(delta: number): void {
    const m = this.calMonth();
    this.calMonth.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  protected goToCurrentMonth(): void {
    this.calMonth.set(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  }

  protected selectDay(cell: CalendarCell): void {
    if (!cell.day) return;
    this.selectedDay.update((cur) => (cur === cell.key ? null : cell.key));
  }

  protected clearDay(): void {
    this.selectedDay.set(null);
  }

  /** List rows: all e-mails or only those from the selected day. */
  protected readonly visibleEmails = computed(() => {
    const day = this.selectedDay();
    if (!day) return this.emails();
    return this.emails().filter((e) => e.emailDate && dayKey(new Date(e.emailDate)) === day);
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getAll().subscribe({
      next: (data) => {
        this.emails.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Nie udało się pobrać listy e-maili.');
        this.loading.set(false);
      },
    });
  }

  /** Opens the stored e-mail HTML in a new tab (fetched with the auth token, then shown via an object URL). */
  protected show(email: MbankRawEmail): void {
    const preview = openPreviewWindow();
    this.downloadingId.set(email.id);
    this.service.download(email.id).subscribe({
      next: (file) => {
        showHtmlInWindow(preview, file.blob);
        this.downloadingId.set(null);
      },
      error: (err) => {
        preview?.close();
        this.error.set(err?.message ?? 'Nie udało się otworzyć e-maila.');
        this.downloadingId.set(null);
      },
    });
  }

  protected countByStatus(status: string): number {
    return this.emails().filter((e) => e.status === status).length;
  }
}
