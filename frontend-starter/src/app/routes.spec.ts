import { describe, expect, it } from 'vitest';
import { routes } from './routes';
import { FriendsPageComponent } from './components/friends-page/friends-page';
import { HomePageComponent } from './components/home-page/home-page';
import { SearchPageComponent } from './components/search-page/search-page';
import { NotFoundPageComponent } from './components/not-found-page/not-found-page';
import { UserPageComponent } from './components/user-page/user-page';
import { authGuard } from './shared/guards/auth.guard';

// Protection des pages de Card Vault (V2, étape 1) : toute page de
// l'application exige d'être connecté, sauf connexion et inscription.
describe('routes', () => {
  const byPath = (path: string) => routes.find((route) => route.path === path);

  it.each(['', 'albums', 'albums/:id', 'search', 'friends', 'profile'])('la page "/%s" est protégée par authGuard', (path) => {
    // toEqual et non toContain : constaté le 01/11/2026, expect(undefined)
    // .toContain(...) PASSE dans cette version de Vitest, donc une route
    // sans guard n'aurait pas été détectée.
    expect(byPath(path)?.canActivate).toEqual([authGuard]);
  });

  it.each(['login', 'register'])('la page "/%s" reste publique', (path) => {
    expect(byPath(path)?.canActivate).toBeUndefined();
  });

  it('une URL inconnue affiche la page « introuvable » (étape 8), accessible sans connexion', () => {
    expect(byPath('**')?.component).toBe(NotFoundPageComponent);
    expect(byPath('**')?.canActivate).toBeUndefined();
  });

  it('profil public : /users/:id, protégé', () => {
    expect(byPath('users/:id')?.component).toBe(UserPageComponent);
    expect(byPath('users/:id')?.canActivate).toEqual([authGuard]);
  });

  it('chaque page a un titre d’onglet', () => {
    expect(routes.map((route) => route.title)).toEqual([
      'Connexion', 'Inscription', 'Modifier mon profil', 'Mes albums', 'Album', 'Amis', 'Accueil', 'Recherche', 'Profil', 'Page introuvable',
    ]);
  });

  it('la page Amis est la vraie page (étape 4), plus la page d’attente', () => {
    expect(byPath('friends')?.component).toBe(FriendsPageComponent);
  });

  it('Accueil et Recherche sont les vraies pages (étape 7), plus la page d’attente', () => {
    expect(byPath('')?.component).toBe(HomePageComponent);
    expect(byPath('search')?.component).toBe(SearchPageComponent);
  });

  it("l'ancienne page audio /tracks n'existe plus", () => {
    expect(byPath('tracks')).toBeUndefined();
  });
});
