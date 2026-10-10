import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Spending } from '../models/spending';
import { SpendingService } from '../services/spending.service';
import { EmailService, ProcessingResult } from '../services/email.service';

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
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly processing = signal(false);
  protected readonly processingMessage = signal<string | null>(null);
  protected readonly processingFailed = signal(false);

  ngOnInit(): void {
    this.load();
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
    this.processing.set(true);
    this.processingMessage.set(null);
    this.processingFailed.set(false);
    this.emailService.process().subscribe({
      next: (result) => {
        this.processingMessage.set(this.describe(result));
        this.processingFailed.set(!result.started);
        this.processing.set(false);
        if (result.started) {
          this.load();
        }
      },
      error: (err) => {
        this.processingMessage.set(err?.message ?? 'Przetwarzanie nie powiodło się.');
        this.processingFailed.set(true);
        this.processing.set(false);
      },
    });
  }

  private describe(r: ProcessingResult): string {
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
}
