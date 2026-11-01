import { Routes } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';
import { AlbumPageComponent } from './components/album-page/album-page';
import { AlbumsPageComponent } from './components/albums-page/albums-page';
import { LoginPageComponent } from './components/login-page/login-page';
import { PlaceholderPageComponent, PlaceholderData } from './components/placeholder-page/placeholder-page';
import { ProfilePageComponent } from './components/profile-page/profile-page';
import { RegisterPageComponent } from './components/register-page/register-page';

export const routes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: RegisterPageComponent },
  { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard] },
  // Albums (V2, étape 2).
  { path: 'albums', component: AlbumsPageComponent, canActivate: [authGuard] },
  { path: 'albums/:id', component: AlbumPageComponent, canActivate: [authGuard] },
  // Pages posées à l'étape 1 de la V2, remplies aux étapes indiquées.
  {
    path: '',
    pathMatch: 'full',
    component: PlaceholderPageComponent,
    canActivate: [authGuard],
    data: {
      title: 'Accueil',
      icon: 'auto_awesome',
      description: 'Les albums récemment ajoutés et l’activité de tes amis apparaîtront ici.',
      step: 7,
    } satisfies PlaceholderData,
  },
  {
    path: 'search',
    component: PlaceholderPageComponent,
    canActivate: [authGuard],
    data: {
      title: 'Recherche',
      icon: 'search',
      description: 'Recherche d’albums par titre, propriétaire, type, série ou extension.',
      step: 7,
    } satisfies PlaceholderData,
  },
  {
    path: 'friends',
    component: PlaceholderPageComponent,
    canActivate: [authGuard],
    data: {
      title: 'Amis',
      icon: 'group',
      description: 'Tes amis, les invitations reçues et envoyées.',
      step: 4,
    } satisfies PlaceholderData,
  },
  { path: '**', redirectTo: '' },
];
