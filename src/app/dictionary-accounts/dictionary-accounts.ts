import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import {
  DictionaryAccount,
  DictionaryAccountService,
  UnmappedAccount,
} from '../services/dictionary-account.service';

interface EditRow {
  id: number;
  key: string;
  name: string;
  /** working copy used by the inputs */
  draftKey: string;
  draftName: string;
  editing: boolean;
  saving: boolean;
}

@Component({
  selector: 'app-dictionary-accounts',
  imports: [FormsModule],
  templateUrl: './dictionary-accounts.html',
  styleUrl: './dictionary-accounts.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DictionaryAccounts implements OnInit {
  private readonly service = inject(DictionaryAccountService);

  protected readonly rows = signal<EditRow[]>([]);
  protected readonly unmapped = signal<UnmappedAccount[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly status = signal<string | null>(null);

  // new-entry form
  protected newKey = '';
  protected newName = '';
  protected readonly creating = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ all: this.service.getAll(), unmapped: this.service.getUnmapped() }).subscribe({
      next: ({ all, unmapped }) => {
        this.rows.set(all.map(toRow));
        this.unmapped.set(unmapped);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(describeError(err, 'Nie udało się pobrać słownika.'));
        this.loading.set(false);
      },
    });
  }

  protected create(): void {
    const key = this.newKey.trim();
    const name = this.newName.trim();
    if (!key || !name) {
      this.error.set('Podaj numer rachunku i nazwę.');
      return;
    }
    this.creating.set(true);
    this.error.set(null);
    this.service.create(key, name).subscribe({
      next: (created) => {
        this.rows.update((rs) => [...rs, toRow(created)].sort(byName));
        this.unmapped.update((us) => us.filter((u) => u.account !== key));
        this.newKey = '';
        this.newName = '';
        this.creating.set(false);
        this.status.set(`Dodano: ${created.key} → ${created.name}. Kliknij „Uzupełnij rachunki” na stronie transakcji, aby zastosować.`);
      },
      error: (err) => {
        this.error.set(describeError(err, 'Nie udało się dodać wpisu.'));
        this.creating.set(false);
      },
    });
  }

  /** Pre-fills the form from the "unmapped" list. */
  protected prefill(u: UnmappedAccount): void {
    this.newKey = u.account;
    this.newName = '';
    document.getElementById('new-name')?.focus();
  }

  protected startEdit(row: EditRow): void {
    this.patch(row.id, { editing: true, draftKey: row.key, draftName: row.name });
  }

  protected cancelEdit(row: EditRow): void {
    this.patch(row.id, { editing: false, draftKey: row.key, draftName: row.name });
  }

  protected save(row: EditRow): void {
    const key = row.draftKey.trim();
    const name = row.draftName.trim();
    if (!key || !name) {
      this.error.set('Numer rachunku i nazwa nie mogą być puste.');
      return;
    }
    this.patch(row.id, { saving: true });
    this.error.set(null);
    this.service.update(row.id, key, name).subscribe({
      next: (saved) => {
        this.patch(row.id, { key: saved.key, name: saved.name, editing: false, saving: false });
        this.rows.update((rs) => [...rs].sort(byName));
        this.status.set(`Zapisano: ${saved.key} → ${saved.name}.`);
      },
      error: (err) => {
        this.patch(row.id, { saving: false });
        this.error.set(describeError(err, 'Nie udało się zapisać.'));
      },
    });
  }

  protected remove(row: EditRow): void {
    if (!confirm(`Usunąć wpis ${row.key} → ${row.name}?`)) {
      return;
    }
    this.patch(row.id, { saving: true });
    this.service.delete(row.id).subscribe({
      next: () => {
        this.rows.update((rs) => rs.filter((r) => r.id !== row.id));
        this.status.set(`Usunięto: ${row.key}.`);
        // the account may now show up as unmapped again
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

function toRow(a: DictionaryAccount): EditRow {
  return { id: a.id, key: a.key, name: a.name, draftKey: a.key, draftName: a.name, editing: false, saving: false };
}

function byName(a: EditRow, b: EditRow): number {
  return a.name.localeCompare(b.name, 'pl') || a.key.localeCompare(b.key);
}

function describeError(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    // Spring's ResponseStatusException puts the reason in `message` (or `error` for problem+json)
    const body = err.error as { message?: string; detail?: string } | null;
    return body?.detail || body?.message || err.message || fallback;
  }
  return fallback;
}
