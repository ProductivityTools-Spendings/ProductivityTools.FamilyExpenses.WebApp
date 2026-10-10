import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Spending } from '../models/spending';

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

  /** Fills missing accounts in spending_details from dictionary_account. */
  fillAccounts(): Observable<FillResult> {
    return this.http.post<FillResult>(`${this.baseUrl}/fill-accounts`, null);
  }

  /** Fills missing categories in spending_details from account rules and dictionary_category_mapping. */
  fillCategories(): Observable<FillResult> {
    return this.http.post<FillResult>(`${this.baseUrl}/fill-categories`, null);
  }
}
