import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MbankRawEmail } from '../models/mbank-raw-email';
import { MbankRawEmailService, saveDownloadedFile } from '../services/mbank-raw-email.service';

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

  protected download(email: MbankRawEmail): void {
    this.downloadingId.set(email.id);
    this.service.download(email.id).subscribe({
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
