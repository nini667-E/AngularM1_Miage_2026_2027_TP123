import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Page introuvable (V2, étape 8) : une adresse inconnue l'affiche au lieu de
 * renvoyer silencieusement vers l'accueil. Accessible sans être connecté.
 */
@Component({
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <section class="cv-page not-found">
      <div class="empty-pocket" aria-hidden="true">?</div>
      <h1 class="cv-page-title">Page introuvable</h1>
      <p>Cette page n’existe pas, ou elle a changé d’adresse.</p>
      <a mat-flat-button routerLink="/">
        <mat-icon>home</mat-icon>
        Retour à l’accueil
      </a>
    </section>
  `,
  styles: `
    .not-found { display: grid; justify-items: center; gap: 0.75rem; text-align: center; padding-top: 2rem; }
    .not-found .cv-page-title { margin: 0; }
    .not-found p { margin: 0 0 0.75rem; color: var(--mat-sys-on-surface-variant); }
    /* Une pochette de classeur vide, au format carte. */
    .empty-pocket {
      display: grid;
      place-items: center;
      width: 96px;
      aspect-ratio: 63 / 88;
      border: 2px dashed rgb(201 162 77 / 0.55);
      border-radius: 10px;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-display-medium);
    }
  `,
})
export class NotFoundPageComponent {}
