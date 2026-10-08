import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { from, switchMap, tap, throwError, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Attaches `Authorization: Bearer <Firebase ID token>` to every request going to the WebApi.
 * On 401 the session is considered invalid and the user is sent to the login page.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  return from(auth.getIdToken()).pipe(
    switchMap((token) => {
      const authorized = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;
      return next(authorized);
    }),
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        void auth.signOut().then(() =>
          router.navigate(['/login'], { queryParams: { returnUrl: router.url } }),
        );
      }
      return throwError(() => err);
    }),
  );
};
