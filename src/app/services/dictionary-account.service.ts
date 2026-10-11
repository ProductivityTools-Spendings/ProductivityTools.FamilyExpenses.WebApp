import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DictionaryAccount {
  id: number;
  key: string;
  name: string;
}

export interface UnmappedAccount {
  account: string;
  spendingsCount: number;
  lastOperationDate: string | null;
}

@Injectable({ providedIn: 'root' })
export class DictionaryAccountService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/dictionary/accounts`;

  getAll(): Observable<DictionaryAccount[]> {
    return this.http.get<DictionaryAccount[]>(this.baseUrl);
  }

  getUnmapped(): Observable<UnmappedAccount[]> {
    return this.http.get<UnmappedAccount[]>(`${this.baseUrl}/unmapped`);
  }

  create(key: string, name: string): Observable<DictionaryAccount> {
    return this.http.post<DictionaryAccount>(this.baseUrl, { key, name });
  }

  update(id: number, key: string, name: string): Observable<DictionaryAccount> {
    return this.http.put<DictionaryAccount>(`${this.baseUrl}/${id}`, { key, name });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
