import { HttpErrorResponse } from '@angular/common/http';

// error.status === 0 signifie qu'aucune réponse n'est venue du serveur
// (connexion refusée, backend arrêté...) : error.error est alors une erreur
// technique du navigateur (ex. "Failed to fetch"), pas un message applicatif
// à afficher tel quel à l'utilisateur.
// Déplacé de tracks-page.ts (V1) vers shared/ en V2, étape 1 : toutes les
// pages en ont besoin.
export function serverErrorMessage(error: HttpErrorResponse, fallback: string): string {
  return error.status > 0 ? (error.error?.message ?? fallback) : fallback;
}
