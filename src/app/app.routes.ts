import { Routes } from '@angular/router';
import { Spendings } from './spendings/spendings';

export const routes: Routes = [
  { path: '', redirectTo: 'spendings', pathMatch: 'full' },
  { path: 'spendings', component: Spendings, title: 'Transakcje' },
  { path: '**', redirectTo: 'spendings' },
];
