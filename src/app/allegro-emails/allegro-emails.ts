import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AllegroRawEmail, AllegroService } from '../services/allegro.service';
import { openPreviewWindow, showHtmlInWindow } from '../services/mbank-raw-email.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-allegro-emails',
  imports: [DatePipe],
  templateUrl: './allegro-emails.html',
  styleUrl: '../mbank-emails/mbank-emails.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllegroEmails implements OnInit {
  private readonly service = inject(AllegroService);
  /** Link to the Apps Script web app that imports new Allegro e-mails from Gmail (owner-only deployment). */
  protected readonly gmailImportUrl = environment.allegroGmailImportUrl;

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

  /** Opens the stored e-mail HTML in a new tab (fetched with the auth token, then shown via an object URL). */
  protected show(email: AllegroRawEmail): void {
    const preview = openPreviewWindow();
    this.downloadingId.set(email.id);
    this.service.downloadEmail(email.id).subscribe({
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
