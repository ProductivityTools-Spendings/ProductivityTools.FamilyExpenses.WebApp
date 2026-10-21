import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Mirrors DictionaryCategoryMappingController.CategoryMapping: transaction name → category. */
export interface CategoryMapping {
  id: number;
  key: string;
  category: string;
  /** how many spendings carry exactly this name */
  spendingsCount: number;
}

export interface UnmappedName {
  name: string;
  spendingsCount: number;
  lastOperationDate: string | null;
}

@Injectable({ providedIn: 'root' })
export class DictionaryCategoryMappingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/dictionary/category-mappings`;

  getAll(): Observable<CategoryMapping[]> {
    return this.http.get<CategoryMapping[]>(this.baseUrl);
  }

  getUnmapped(): Observable<UnmappedName[]> {
    return this.http.get<UnmappedName[]>(`${this.baseUrl}/unmapped`);
  }

  create(key: string, category: string): Observable<CategoryMapping> {
    return this.http.post<CategoryMapping>(this.baseUrl, { key, category });
  }

  update(id: number, key: string, category: string): Observable<CategoryMapping> {
    return this.http.put<CategoryMapping>(`${this.baseUrl}/${id}`, { key, category });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
