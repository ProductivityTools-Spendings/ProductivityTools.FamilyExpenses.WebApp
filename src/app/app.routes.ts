import { Routes } from '@angular/router';
import { Spendings } from './spendings/spendings';
import { Login } from './auth/login';
import { authGuard, guestGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'spendings', pathMatch: 'full' },
  { path: 'login', component: Login, title: 'Logowanie', canActivate: [guestGuard] },
  { path: 'spendings', component: Spendings, title: 'Transakcje', canActivate: [authGuard] },
  { path: '**', redirectTo: 'spendings' },
];
