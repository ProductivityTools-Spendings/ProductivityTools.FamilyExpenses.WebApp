import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Observable } from 'rxjs';
import { Spending } from '../models/spending';
import { FillResult, SpendingService } from '../services/spending.service';
import { EmailService, ProcessingResult } from '../services/email.service';

type Action = 'process' | 'fillAccounts' | 'fillCategories' | 'markDuplicates';

@Component({
  selector: 'app-spendings',
  imports: [CurrencyPipe],
  templateUrl: './spendings.html',
  styleUrl: './spendings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Spendings implements OnInit {
  private readonly spendingService = inject(SpendingService);
  private readonly emailService = inject(EmailService);

  protected readonly spendings = signal<Spending[]>([]);
  protected readonly hideDuplicates = signal(true);
  protected readonly visibleSpendings = computed(() =>
    this.hideDuplicates() ? this.spendings().filter((s) => s.duplicateOf === null) : this.spendings(),
  );
  protected readonly duplicateCount = computed(() => this.spendings().filter((s) => s.duplicateOf !== null).length);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Which maintenance action is currently running (null = none). */
  protected readonly runningAction = signal<Action | null>(null);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly statusFailed = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected get busy(): boolean {
    return this.loading() || this.runningAction() !== null;
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.spendingService.getAll().subscribe({
      next: (data) => {
        this.spendings.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Nie udało się pobrać transakcji.');
        this.loading.set(false);
      },
    });
  }

  /** Triggers server-side processing of raw e-mails (NEW + ERROR), then refreshes the list. */
  protected processEmails(): void {
    this.run('process', this.emailService.process(), (r) => ({
      message: this.describeProcessing(r),
      failed: !r.started,
      reload: r.started,
    }));
  }

  /** Fills missing accounts from dictionary_account. */
  protected fillAccounts(): void {
    this.run('fillAccounts', this.spendingService.fillAccounts(), (r) => ({
      message: this.describeFill('rachunki', 'bez rachunku', r),
      failed: false,
      reload: r.updated > 0,
    }));
  }

  /** Fills missing categories from account rules and dictionary_category_mapping. */
  protected fillCategories(): void {
    this.run('fillCategories', this.spendingService.fillCategories(), (r) => ({
      message: this.describeFill('kategorie', 'bez kategorii', r),
      failed: false,
      reload: r.updated > 0,
    }));
  }

  /** Marks debits that mirror an outgoing transfer as duplicates. */
  protected markDuplicates(): void {
    this.run('markDuplicates', this.spendingService.markDuplicates(), (r) => ({
      message: `Oznaczono nowych duplikatów: ${r.updated}. Łącznie duplikatów: ${r.remainingEmpty}.`,
      failed: false,
      reload: r.updated > 0,
    }));
  }

  protected toggleDuplicates(): void {
    this.hideDuplicates.update((v) => !v);
  }

  private run<T>(
    action: Action,
    request: Observable<T>,
    describe: (result: T) => { message: string; failed: boolean; reload: boolean },
  ): void {
    this.runningAction.set(action);
    this.statusMessage.set(null);
    this.statusFailed.set(false);
    request.subscribe({
      next: (result) => {
        const { message, failed, reload } = describe(result);
        this.statusMessage.set(message);
        this.statusFailed.set(failed);
        this.runningAction.set(null);
        if (reload) {
          this.load();
        }
      },
      error: (err) => {
        this.statusMessage.set(err?.message ?? 'Operacja nie powiodła się.');
        this.statusFailed.set(true);
        this.runningAction.set(null);
      },
    });
  }

  private describeProcessing(r: ProcessingResult): string {
    if (!r.started) {
      return `Przetwarzanie już trwa w tle – spróbuj za chwilę (oczekujące: ${r.remainingNew}).`;
    }
    const parts = [`przetworzono ${r.processed}`];
    if (r.resetFromError > 0) {
      parts.push(`ponowiono z błędem ${r.resetFromError}`);
    }
    if (r.remainingError > 0) {
      parts.push(`nadal z błędem ${r.remainingError}`);
    }
    if (r.remainingNew > 0) {
      parts.push(`oczekujące ${r.remainingNew}`);
    }
    return `Gotowe: ${parts.join(', ')}.`;
  }

  private describeFill(what: string, missingLabel: string, r: FillResult): string {
    return `Uzupełniono ${what}: ${r.updated}. Nadal ${missingLabel}: ${r.remainingEmpty}.`;
  }
}
