import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Mirrors EmailProcessingService.ProcessingResult from the WebApi. */
export interface ProcessingResult {
  /** false when another processing run was already in progress (nothing was processed now). */
  started: boolean;
  resetFromError: number;
  processed: number;
  remainingNew: number;
  remainingError: number;
}

@Injectable({ providedIn: 'root' })
export class EmailService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/emails`;

  /** Re-queues ERROR e-mails and processes all pending raw e-mails. */
  process(): Observable<ProcessingResult> {
    return this.http.post<ProcessingResult>(`${this.baseUrl}/process`, null);
  }
}
