import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const APP_NAME = 'Card Vault';

/** « Mes 151 Psy · Card Vault », ou « Card Vault » seul. */
export function pageTitle(name?: string | null): string {
  return name ? `${name} · ${APP_NAME}` : APP_NAME;
}

/**
 * Titre de l'onglet du navigateur (V2, étape 8) : le `title` de chaque route
 * suivi du nom de l'application. Les pages dont le titre dépend des données
 * (un album, un profil) le remplacent une fois chargées, avec pageTitle().
 */
@Injectable({ providedIn: 'root' })
export class CardVaultTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.title.setTitle(pageTitle(this.buildTitle(snapshot)));
  }
}
