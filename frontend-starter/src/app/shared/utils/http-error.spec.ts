import { describe, expect, it } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { serverErrorMessage } from './http-error';

// Fonction pure, testée isolément (pas de TestBed nécessaire) — motivé
// par le bug "Failed to fetch" (TP2) : serverErrorMessage() est exactement
// le genre de logique qu'un test aurait attrapé avant un test manuel.

describe('serverErrorMessage()', () => {
  it('utilise le message du backend quand une vraie réponse HTTP est arrivée', () => {
    const error = new HttpErrorResponse({ status: 400, error: { message: 'Album inconnu' } });
    expect(serverErrorMessage(error, 'repli')).toBe('Album inconnu');
  });

  it('ignore le message brut du navigateur quand aucune réponse n\'est arrivée (status 0)', () => {
    // Cas exact du bug TP2 : error.error est une erreur technique du
    // navigateur ("Failed to fetch"), pas le JSON applicatif du backend.
    const error = new HttpErrorResponse({ status: 0, error: new TypeError('Failed to fetch') });
    expect(serverErrorMessage(error, 'Échec de la requête')).toBe('Échec de la requête');
  });

  it("utilise le message de repli si le backend répond sans champ message", () => {
    const error = new HttpErrorResponse({ status: 500, error: {} });
    expect(serverErrorMessage(error, 'repli')).toBe('repli');
  });
});
