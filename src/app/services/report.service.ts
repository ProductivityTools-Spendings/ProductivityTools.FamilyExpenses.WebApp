import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CategoryMonth {
  month: string;
  category: string;
  total: number;
  count: number;
}

export interface CashflowMonth {
  month: string;
  account: string;
  income: number;
  expenses: number;
  net: number;
  count: number;
}

export interface RecurringPayment {
  payee: string;
  dstAccount: string;
  category: string | null;
  occurrences: number;
  months: number;
  firstDate: string;
  lastDate: string;
  lastAmount: number;
  avgAmount: number;
  minAmount: number;
  maxAmount: number;
  monthlyAvg12m: number;
  active: boolean;
}

export interface HygieneCategory {
  category: string;
  count: number;
  total: number;
}

export interface Hygiene {
  uncategorized: number;
  withoutAccount: number;
  withoutPln: number;
  unmappedAccounts: number;
  unlinkedAuthorizations: number;
  allegroEmailsWithoutSpending: number;
  emailsInError: number;
  duplicates: number;
  proxyCategories: HygieneCategory[];
  uncategorizedSample: { id: number; operationDate: string; operationType: string; name: string; amountPln: number }[];
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/reports`;

  categoryMonthly(from: string, to: string): Observable<CategoryMonth[]> {
    return this.http.get<CategoryMonth[]>(`${this.baseUrl}/category-monthly`, { params: new HttpParams({ fromObject: { from, to } }) });
  }

  cashflow(from: string, to: string): Observable<CashflowMonth[]> {
    return this.http.get<CashflowMonth[]>(`${this.baseUrl}/cashflow`, { params: new HttpParams({ fromObject: { from, to } }) });
  }

  recurring(minMonths = 3): Observable<RecurringPayment[]> {
    return this.http.get<RecurringPayment[]>(`${this.baseUrl}/recurring`, { params: { minMonths } });
  }

  hygiene(): Observable<Hygiene> {
    return this.http.get<Hygiene>(`${this.baseUrl}/hygiene`);
  }
}
