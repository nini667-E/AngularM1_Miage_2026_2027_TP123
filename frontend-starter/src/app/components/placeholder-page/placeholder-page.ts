import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { map } from 'rxjs';

/** Données passées par la route (routes.ts, propriété `data`). */
export interface PlaceholderData {
  title: string;
  icon: string;
  description: string;
  step: number;
}

/**
 * Page d'attente commune (V2, étape 1) : Accueil, Recherche et Amis
 * existent déjà dans la navigation, mais leur contenu arrive aux étapes
 * suivantes. Chaque route sera remplacée par son vrai composant.
 */
@Component({
  imports: [MatCardModule, MatIconModule],
  templateUrl: './placeholder-page.html',
  styleUrl: './placeholder-page.css',
})
export class PlaceholderPageComponent {
  protected readonly page = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => data as PlaceholderData)),
  );
}
