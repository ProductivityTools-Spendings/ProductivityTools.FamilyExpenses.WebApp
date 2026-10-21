import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import {
  CategoryMapping,
  DictionaryCategoryMappingService,
  UnmappedName,
} from '../services/dictionary-category-mapping.service';
import { SpendingService } from '../services/spending.service';

interface EditRow {
  id: number;
  key: string;
  category: string;
  spendingsCount: number;
  /** working copy used by the inputs */
  draftKey: string;
  draftCategory: string;
  editing: boolean;
  saving: boolean;
}

/** Dictionary "transaction name → category" (dictionary_category_mapping). Reuses the accounts dictionary styles. */
@Component({
  selector: 'app-dictionary-category-mappings',
  imports: [FormsModule],
  templateUrl: './dictionary-category-mappings.html',
  styleUrl: '../dictionary-accounts/dictionary-accounts.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DictionaryCategoryMappings implements OnInit {
  private readonly service = inject(DictionaryCategoryMappingService);
  private readonly spendingService = inject(SpendingService);

  protected readonly rows = signal<EditRow[]>([]);
  protected readonly unmapped = signal<UnmappedName[]>([]);
  protected readonly categories = signal<string[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);
  /** Text filter over key and category. */
  protected filter = '';

  // new-entry form
  protected newKey = '';
  protected newCategory = '';
  protected readonly creating = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      all: this.service.getAll(),
      unmapped: this.service.getUnmapped(),
      categories: this.spendingService.getCategories(),
    }).subscribe({
      next: ({ all, unmapped, categories }) => {
        this.rows.set(all.map(toRow));
        this.unmapped.set(unmapped);
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(describeError(err, 'Nie udało się pobrać słownika.'));
        this.loading.set(false);
      },
    });
  }

  protected visibleRows(): EditRow[] {
    const f = this.filter.trim().toLowerCase();
    if (!f) return this.rows();
    return this.rows().filter((r) => r.key.toLowerCase().includes(f) || r.category.toLowerCase().includes(f));
  }

  protected create(): void {
    const key = this.newKey.trim();
    const category = this.newCategory.trim();
    if (!key || !category) {
      this.error.set('Podaj nazwę transakcji i wybierz kategorię.');
      return;
    }
    this.creating.set(true);
    this.error.set(null);
    this.service.create(key, category).subscribe({
      next: (created) => {
        this.rows.update((rs) => [...rs, toRow(created)].sort(byCategory));
        this.unmapped.update((us) => us.filter((u) => u.name !== key));
        this.newKey = '';
        this.newCategory = '';
        this.creating.set(false);
        this.status.set(`Dodano: ${created.key} → ${created.category}. Kliknij „Uzupełnij kategorie” na stronie transakcji, aby zastosować.`);
      },
      error: (err) => {
        this.error.set(describeError(err, 'Nie udało się dodać wpisu.'));
        this.creating.set(false);
      },
    });
  }

  /** Pre-fills the form from the "unmapped" list. */
  protected prefill(u: UnmappedName): void {
    this.newKey = u.name;
    document.getElementById('new-category')?.focus();
  }

  protected startEdit(row: EditRow): void {
    this.patch(row.id, { editing: true, draftKey: row.key, draftCategory: row.category });
  }

  protected cancelEdit(row: EditRow): void {
    this.patch(row.id, { editing: false, draftKey: row.key, draftCategory: row.category });
  }

  protected save(row: EditRow): void {
    const key = row.draftKey.trim();
    const category = row.draftCategory.trim();
    if (!key || !category) {
      this.error.set('Nazwa transakcji i kategoria nie mogą być puste.');
      return;
    }
    this.patch(row.id, { saving: true });
    this.error.set(null);
    this.service.update(row.id, key, category).subscribe({
      next: (saved) => {
        this.patch(row.id, { key: saved.key, category: saved.category, spendingsCount: saved.spendingsCount, editing: false, saving: false });
        this.rows.update((rs) => [...rs].sort(byCategory));
        this.status.set(`Zapisano: ${saved.key} → ${saved.category}.`);
      },
      error: (err) => {
        this.patch(row.id, { saving: false });
        this.error.set(describeError(err, 'Nie udało się zapisać.'));
      },
    });
  }

  protected remove(row: EditRow): void {
    if (!confirm(`Usunąć wpis ${row.key} → ${row.category}?`)) {
      return;
    }
    this.patch(row.id, { saving: true });
    this.service.delete(row.id).subscribe({
      next: () => {
        this.rows.update((rs) => rs.filter((r) => r.id !== row.id));
        this.status.set(`Usunięto: ${row.key}.`);
        this.service.getUnmapped().subscribe((us) => this.unmapped.set(us));
      },
      error: (err) => {
        this.patch(row.id, { saving: false });
        this.error.set(describeError(err, 'Nie udało się usunąć.'));
      },
    });
  }

  private patch(id: number, changes: Partial<EditRow>): void {
    this.rows.update((rs) => rs.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }
}

function toRow(m: CategoryMapping): EditRow {
  return {
    id: m.id, key: m.key, category: m.category, spendingsCount: m.spendingsCount,
    draftKey: m.key, draftCategory: m.category, editing: false, saving: false,
  };
}

function byCategory(a: EditRow, b: EditRow): number {
  return a.category.localeCompare(b.category, 'pl') || a.key.localeCompare(b.key, 'pl');
}

function describeError(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { message?: string; detail?: string } | null;
    return body?.detail || body?.message || err.message || fallback;
  }
  return fallback;
}
