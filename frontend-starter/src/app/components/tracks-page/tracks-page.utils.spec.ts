import { describe, expect, it } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { formatAudioType, formatFileSize, serverErrorMessage } from './tracks-page';

// Fonctions pures, testées isolément (pas de TestBed nécessaire) — motivé
// par le bug "Failed to fetch" (TP2) : serverErrorMessage() est exactement
// le genre de logique qu'un test aurait attrapé avant un test manuel.

describe('formatFileSize()', () => {
  it('affiche les octets bruts sous 1024', () => {
    expect(formatFileSize(500)).toBe('500 o');
  });

  it('convertit en Ko entre 1024 octets et 1 Mo', () => {
    expect(formatFileSize(50_000)).toBe('48.8 Ko');
  });

  it('convertit en Mo au-delà de 1024 Ko', () => {
    expect(formatFileSize(6_405_141)).toBe('6.1 Mo');
  });
});

describe('formatAudioType()', () => {
  it('traduit un type MIME connu en libellé court', () => {
    expect(formatAudioType('audio/mpeg')).toBe('MP3');
    expect(formatAudioType('audio/x-wav')).toBe('WAV');
  });

  it('retombe sur le type MIME brut si inconnu', () => {
    expect(formatAudioType('audio/flac')).toBe('audio/flac');
  });
});

describe('serverErrorMessage()', () => {
  it('utilise le message du backend quand une vraie réponse HTTP est arrivée', () => {
    const error = new HttpErrorResponse({ status: 400, error: { message: 'Piste inconnue' } });
    expect(serverErrorMessage(error, 'repli')).toBe('Piste inconnue');
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
