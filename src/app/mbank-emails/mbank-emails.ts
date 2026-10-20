import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MbankRawEmail } from '../models/mbank-raw-email';
import { MbankRawEmailService, openPreviewWindow, showHtmlInWindow } from '../services/mbank-raw-email.service';
import { environment } from '../../environments/environment';

/** One cell of the monthly calendar; `day` is null for the leading blanks before the 1st. */
interface CalendarCell {
  day: number | null;
  key: string;
  count: number;
  errors: number;
  future: boolean;
}

/** One month of the 12-month grid. */
interface CalendarMonth {
  first: Date;
  cells: CalendarCell[];
  daysWithEmail: number;
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
  /** Link to the Apps Script web app that imports new e-mails from Gmail (owner-only deployment). */
  protected readonly gmailImportUrl = environment.mbankGmailImportUrl;

  protected readonly emails = signal<MbankRawEmail[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Id of the e-mail currently being downloaded (null = none). */
  protected readonly downloadingId = signal<number | null>(null);

  // --- calendar --------------------------------------------------------------
  protected readonly weekdays = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
  protected readonly MONTHS_SHOWN = 12;
  /** First day of the last (newest) displayed month; the grid shows this month and the 11 before it. */
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

  /** 12 months, oldest first, each with its Monday-first cell grid and the number of days with e-mails. */
  protected readonly calMonths = computed<CalendarMonth[]>(() => {
    const last = this.calMonth();
    const byDay = this.byDay();
    const todayKey = dayKey(new Date());
    const out: CalendarMonth[] = [];
    for (let i = this.MONTHS_SHOWN - 1; i >= 0; i--) {
      const first = new Date(last.getFullYear(), last.getMonth() - i, 1);
      const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const lead = (first.getDay() + 6) % 7;
      const cells: CalendarCell[] = [];
      for (let b = 0; b < lead; b++) cells.push({ day: null, key: `blank-${b}`, count: 0, errors: 0, future: false });
      let daysWithEmail = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const key = dayKey(new Date(first.getFullYear(), first.getMonth(), d));
        const stats = byDay.get(key);
        if (stats) daysWithEmail++;
        cells.push({ day: d, key, count: stats?.count ?? 0, errors: stats?.errors ?? 0, future: key > todayKey });
      }
      out.push({ first, cells, daysWithEmail });
    }
    return out;
  });

  /** Moves the whole 12-month window by `delta` months. */
  protected shiftMonth(delta: number): void {
    const m = this.calMonth();
    this.calMonth.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  protected goToCurrentMonth(): void {
    this.calMonth.set(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  }

  protected readonly isCurrentWindow = computed(() => {
    const now = new Date();
    const m = this.calMonth();
    return m.getFullYear() === now.getFullYear() && m.getMonth() === now.getMonth();
  });

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
