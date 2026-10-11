import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { AllegroPurchase, AllegroService } from '../services/allegro.service';

type Filter = 'all' | 'linked' | 'unlinked';

@Component({
  selector: 'app-allegro-purchases',
  imports: [CurrencyPipe],
  templateUrl: './allegro-purchases.html',
  styleUrl: '../card-authorizations/card-authorizations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllegroPurchases implements OnInit {
  private readonly service = inject(AllegroService);

  protected readonly purchases = signal<AllegroPurchase[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<Filter>('all');

  protected readonly linkedCount = computed(() => this.purchases().filter((p) => p.spendingId !== null).length);
  protected readonly unlinkedCount = computed(() => this.purchases().length - this.linkedCount());
  protected readonly visible = computed(() => {
    const f = this.filter();
    const all = this.purchases();
    if (f === 'linked') return all.filter((p) => p.spendingId !== null);
    if (f === 'unlinked') return all.filter((p) => p.spendingId === null);
    return all;
  });

  ngOnInit(): void {
    this.load();
  }

  protected setFilter(f: Filter): void {
    this.filter.set(f);
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getPurchases().subscribe({
      next: (data) => {
        this.purchases.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Nie udało się pobrać zakupów.');
        this.loading.set(false);
      },
    });
  }

  /** True when this row is the first item of an order (orders with several items share allegroRawEmailId). */
  protected isFirstOfOrder(index: number): boolean {
    const rows = this.visible();
    return index === 0 || rows[index - 1].allegroRawEmailId !== rows[index].allegroRawEmailId;
  }
}
