import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { CardAuthorization } from '../models/card-authorization';
import { CardAuthorizationService } from '../services/card-authorization.service';

type Filter = 'all' | 'linked' | 'unlinked';

@Component({
  selector: 'app-card-authorizations',
  imports: [CurrencyPipe],
  templateUrl: './card-authorizations.html',
  styleUrl: './card-authorizations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardAuthorizations implements OnInit {
  private readonly service = inject(CardAuthorizationService);

  protected readonly authorizations = signal<CardAuthorization[]>([]);
  protected readonly loading = signal(false);
  protected readonly linking = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly filter = signal<Filter>('all');

  protected readonly linkedCount = computed(() => this.authorizations().filter((a) => a.settledBySpendingId !== null).length);
  protected readonly unlinkedCount = computed(() => this.authorizations().length - this.linkedCount());
  protected readonly visible = computed(() => {
    const f = this.filter();
    const all = this.authorizations();
    if (f === 'linked') return all.filter((a) => a.settledBySpendingId !== null);
    if (f === 'unlinked') return all.filter((a) => a.settledBySpendingId === null);
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
    this.service.getAll().subscribe({
      next: (data) => {
        this.authorizations.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Nie udało się pobrać autoryzacji.');
        this.loading.set(false);
      },
    });
  }

  protected link(): void {
    this.linking.set(true);
    this.statusMessage.set(null);
    this.service.link().subscribe({
      next: (r) => {
        this.statusMessage.set(
          `Powiązano nowych: ${r.linked}. Łącznie powiązanych: ${r.totalLinked}, bez powiązania: ${r.totalUnlinked}.`,
        );
        this.linking.set(false);
        if (r.linked > 0) {
          this.load();
        }
      },
      error: (err) => {
        this.statusMessage.set(err?.message ?? 'Łączenie nie powiodło się.');
        this.linking.set(false);
      },
    });
  }
}
