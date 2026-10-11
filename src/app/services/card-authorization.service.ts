import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CardAuthorization, LinkResult } from '../models/card-authorization';

@Injectable({ providedIn: 'root' })
export class CardAuthorizationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/card-authorizations`;

  getAll(): Observable<CardAuthorization[]> {
    return this.http.get<CardAuthorization[]>(this.baseUrl);
  }

  /** Links authorizations to the debits that settled them. */
  link(): Observable<LinkResult> {
    return this.http.post<LinkResult>(`${this.baseUrl}/link`, null);
  }
}
