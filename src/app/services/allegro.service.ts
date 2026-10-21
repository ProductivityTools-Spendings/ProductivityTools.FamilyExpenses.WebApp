import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DownloadedFile, extractFilename } from './mbank-raw-email.service';

export interface AllegroRawEmail {
  id: number;
  messageId: string;
  threadId: string;
  subject: string | null;
  emailDate: string | null;
  status: 'NEW' | 'PROCESSED' | 'ERROR' | string;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
  purchasesCount: number;
  linkedSpendingId: number | null;
}

export interface AllegroPurchase {
  id: number;
  allegroRawEmailId: number;
  operationId: string;
  purchaseDate: string;
  fullPrice: number;
  itemName: string;
  itemCost: number;
  multipleItems: string | null;
  itemCount: string | null;
  itemPrice: string | null;
  createdAt: string;
  emailSubject: string | null;
  spendingId: number | null;
  spendingDate: string | null;
  spendingAmount: number | null;
  spendingName: string | null;
  spendingCategory: string | null;
}

@Injectable({ providedIn: 'root' })
export class AllegroService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/allegro`;

  getEmails(): Observable<AllegroRawEmail[]> {
    return this.http.get<AllegroRawEmail[]>(`${this.baseUrl}/emails`);
  }

  downloadEmail(id: number): Observable<DownloadedFile> {
    return this.http
      .get(`${this.baseUrl}/emails/${id}/download`, { responseType: 'blob', observe: 'response' })
      .pipe(
        map((res: HttpResponse<Blob>) => ({
          blob: res.body ?? new Blob(),
          filename: extractFilename(res.headers.get('Content-Disposition')) ?? `allegro-email-${id}.html`,
        })),
      );
  }

  getPurchases(): Observable<AllegroPurchase[]> {
    return this.http.get<AllegroPurchase[]>(`${this.baseUrl}/purchases`);
  }

  /** Items of one order (= one Allegro e-mail). */
  getPurchasesForEmail(emailId: number): Observable<AllegroPurchase[]> {
    return this.http.get<AllegroPurchase[]>(`${this.baseUrl}/emails/${emailId}/purchases`);
  }
}
