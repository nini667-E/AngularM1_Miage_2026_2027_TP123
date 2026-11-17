import { Routes } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';
import { AlbumPageComponent } from './components/album-page/album-page';
import { AlbumsPageComponent } from './components/albums-page/albums-page';
import { FriendsPageComponent } from './components/friends-page/friends-page';
import { LoginPageComponent } from './components/login-page/login-page';
import { HomePageComponent } from './components/home-page/home-page';
import { ProfilePageComponent } from './components/profile-page/profile-page';
import { RegisterPageComponent } from './components/register-page/register-page';
import { SearchPageComponent } from './components/search-page/search-page';

export const routes: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: RegisterPageComponent },
  { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard] },
  // Albums (V2, étape 2).
  { path: 'albums', component: AlbumsPageComponent, canActivate: [authGuard] },
  { path: 'albums/:id', component: AlbumPageComponent, canActivate: [authGuard] },
  // Amis et invitations (V2, étape 4).
  { path: 'friends', component: FriendsPageComponent, canActivate: [authGuard] },
  // Découverte (V2, étape 7) : accueil (récents, activité des amis) et recherche.
  { path: '', pathMatch: 'full', component: HomePageComponent, canActivate: [authGuard] },
  { path: 'search', component: SearchPageComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
