import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Spending } from '../models/spending';

/** Mirrors SpendingAnnotationController.AnnotationResponse from the WebApi. */
export interface AnnotationResult {
  spendingId: number;
  category: string | null;
  note: string | null;
  rowsUpdated: number;
}

/** Mirrors the refund endpoints' RefundState from the WebApi. */
export interface RefundState {
  spendingId: number;
  refundExpected: boolean;
  refundSpendingId: number | null;
  refundOfSpendingId: number | null;
}

/** Mirrors SpendingController.FillResult from the WebApi. */
export interface FillResult {
  updated: number;
  remainingEmpty: number;
}

@Injectable({ providedIn: 'root' })
export class SpendingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/spendings`;

  getAll(): Observable<Spending[]> {
    return this.http.get<Spending[]>(this.baseUrl);
  }

  /** Category names known to the system (dictionary_category), for inline-edit suggestions. */
  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/categories`);
  }

  /** Replaces category and note of one spending (blank = cleared); the API mirrors them onto duplicate twins. */
  updateAnnotations(id: number, category: string | null, note: string | null): Observable<AnnotationResult> {
    return this.http.put<AnnotationResult>(`${this.baseUrl}/${id}/annotations`, { category, note });
  }

  /** Flags an expense as "refund expected". */
  expectRefund(id: number): Observable<RefundState> {
    return this.http.put<RefundState>(`${this.baseUrl}/${id}/refund/expect`, null);
  }

  /** Links an expense with the row that refunds it. */
  linkRefund(id: number, refundSpendingId: number): Observable<RefundState> {
    return this.http.put<RefundState>(`${this.baseUrl}/${id}/refund/link`, { refundSpendingId });
  }

  /** Clears the refund flag and the link (both sides) of an expense. */
  clearRefund(id: number): Observable<RefundState> {
    return this.http.delete<RefundState>(`${this.baseUrl}/${id}/refund`);
  }

  /** Fills missing accounts in spending_details from dictionary_account. */
  fillAccounts(): Observable<FillResult> {
    return this.http.post<FillResult>(`${this.baseUrl}/fill-accounts`, null);
  }

  /** Fills missing categories in spending_details from account rules and dictionary_category_mapping. */
  fillCategories(): Observable<FillResult> {
    return this.http.post<FillResult>(`${this.baseUrl}/fill-categories`, null);
  }

  /** Converts foreign-currency amounts to PLN (NBP mid rate). `remainingEmpty` = rows still without PLN amount. */
  fillPln(): Observable<FillResult> {
    return this.http.post<FillResult>(`${this.baseUrl}/fill-pln`, null);
  }

  /** Marks debits mirroring outgoing transfers as duplicates. `remainingEmpty` carries the total marked count. */
  markDuplicates(): Observable<FillResult> {
    return this.http.post<FillResult>(`${this.baseUrl}/mark-duplicates`, null);
  }
}
