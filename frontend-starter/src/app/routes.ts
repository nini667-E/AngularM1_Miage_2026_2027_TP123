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
import { NotFoundPageComponent } from './components/not-found-page/not-found-page';
import { UserPageComponent } from './components/user-page/user-page';

export const routes: Routes = [
  { path: 'login', component: LoginPageComponent, title: 'Connexion' },
  { path: 'register', component: RegisterPageComponent, title: 'Inscription' },
  { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard], title: 'Modifier mon profil' },
  // Albums (V2, étape 2).
  { path: 'albums', component: AlbumsPageComponent, canActivate: [authGuard], title: 'Mes albums' },
  // Titre remplacé par celui de l'album une fois chargé.
  { path: 'albums/:id', component: AlbumPageComponent, canActivate: [authGuard], title: 'Album' },
  // Amis et invitations (V2, étape 4).
  { path: 'friends', component: FriendsPageComponent, canActivate: [authGuard], title: 'Amis' },
  // Découverte (V2, étape 7) : accueil (récents, activité des amis) et recherche.
  { path: '', pathMatch: 'full', component: HomePageComponent, canActivate: [authGuard], title: 'Accueil' },
  { path: 'search', component: SearchPageComponent, canActivate: [authGuard], title: 'Recherche' },
  // Profil public d'un collectionneur (V2, étape 8) ; titre remplacé par son pseudo.
  { path: 'users/:id', component: UserPageComponent, canActivate: [authGuard], title: 'Profil' },
  // Adresse inconnue : page dédiée (étape 8), accessible sans être connecté.
  { path: '**', component: NotFoundPageComponent, title: 'Page introuvable' },
];
