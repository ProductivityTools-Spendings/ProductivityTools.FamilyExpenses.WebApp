import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MbankRawEmail } from '../models/mbank-raw-email';

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

/**
 * Opens an HTML document in a new browser tab. The tab must be opened synchronously in the click handler
 * (popup blockers), so call `openPreviewWindow()` first and pass the handle here once the body arrives.
 */
export function openPreviewWindow(): Window | null {
  const w = window.open('', '_blank');
  if (w) {
    w.document.write('<p style="font-family:sans-serif;padding:1rem">Ładowanie…</p>');
  }
  return w;
}

export function showHtmlInWindow(w: Window | null, blob: Blob): void {
  // force UTF-8: the stored body is already decoded text, while the <meta> inside still says iso-8859-2
  const html = new Blob([blob], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(html);
  if (w && !w.closed) {
    w.location.href = url;
  } else {
    window.open(url, '_blank');
  }
  // keep the URL alive long enough for the tab to load
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Saves a downloaded blob through a temporary object URL. */
export function saveDownloadedFile({ blob, filename }: DownloadedFile): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

@Injectable({ providedIn: 'root' })
export class MbankRawEmailService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/mbank-emails`;

  getAll(): Observable<MbankRawEmail[]> {
    return this.http.get<MbankRawEmail[]>(this.baseUrl);
  }

  /**
   * Downloads the stored HTML attachment. Goes through HttpClient (not a plain link)
   * so the auth interceptor can attach the bearer token.
   */
  download(id: number): Observable<DownloadedFile> {
    return this.http
      .get(`${this.baseUrl}/${id}/download`, { responseType: 'blob', observe: 'response' })
      .pipe(
        map((res: HttpResponse<Blob>) => ({
          blob: res.body ?? new Blob(),
          filename: extractFilename(res.headers.get('Content-Disposition')) ?? `mbank-email-${id}.html`,
        })),
      );
  }
}

/** Parses `filename*=UTF-8''...` (preferred) or `filename="..."` from a Content-Disposition header. */
export function extractFilename(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}
