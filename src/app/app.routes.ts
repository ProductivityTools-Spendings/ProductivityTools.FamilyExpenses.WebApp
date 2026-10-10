import { Routes } from '@angular/router';
import { Spendings } from './spendings/spendings';
import { MbankEmails } from './mbank-emails/mbank-emails';
import { Login } from './auth/login';
import { authGuard, guestGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'spendings', pathMatch: 'full' },
  { path: 'login', component: Login, title: 'Logowanie', canActivate: [guestGuard] },
  { path: 'spendings', component: Spendings, title: 'Transakcje', canActivate: [authGuard] },
  { path: 'emails', component: MbankEmails, title: 'E-maile mBank', canActivate: [authGuard] },
  { path: '**', redirectTo: 'spendings' },
];
