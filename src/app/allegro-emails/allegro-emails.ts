import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AllegroRawEmail, AllegroService } from '../services/allegro.service';
import { saveDownloadedFile } from '../services/mbank-raw-email.service';

@Component({
  selector: 'app-allegro-emails',
  imports: [DatePipe],
  templateUrl: './allegro-emails.html',
  styleUrl: '../mbank-emails/mbank-emails.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllegroEmails implements OnInit {
  private readonly service = inject(AllegroService);

  protected readonly emails = signal<AllegroRawEmail[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly downloadingId = signal<number | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getEmails().subscribe({
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

  protected download(email: AllegroRawEmail): void {
    this.downloadingId.set(email.id);
    this.service.downloadEmail(email.id).subscribe({
      next: (file) => {
        saveDownloadedFile(file);
        this.downloadingId.set(null);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Pobieranie nie powiodło się.');
        this.downloadingId.set(null);
      },
    });
  }

  protected countByStatus(status: string): number {
    return this.emails().filter((e) => e.status === status).length;
  }
}
