import { describe, expect, it } from 'vitest';
import { routes } from './routes';
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

  it("une URL inconnue renvoie vers l'accueil", () => {
    expect(byPath('**')?.redirectTo).toBe('');
  });

  it("l'ancienne page audio /tracks n'existe plus", () => {
    expect(byPath('tracks')).toBeUndefined();
  });
});
