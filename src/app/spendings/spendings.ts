import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Spending } from '../models/spending';
import { SpendingService } from '../services/spending.service';

@Component({
  selector: 'app-spendings',
  imports: [CurrencyPipe],
  templateUrl: './spendings.html',
  styleUrl: './spendings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Spendings implements OnInit {
  private readonly spendingService = inject(SpendingService);

  protected readonly spendings = signal<Spending[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

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
}
