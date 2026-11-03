import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/letter-experience/letter-experience').then((m) => m.LetterExperience),
  },
  {
    path: 'admin',
    loadComponent: () => import('./components/admin/admin').then((m) => m.Admin),
  },
  { path: '**', redirectTo: '' },
];
