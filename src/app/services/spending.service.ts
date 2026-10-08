import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Spending } from '../models/spending';

@Injectable({ providedIn: 'root' })
export class SpendingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/spendings`;

  getAll(): Observable<Spending[]> {
    return this.http.get<Spending[]>(this.baseUrl);
  }
}
