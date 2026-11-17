import { Component, computed, input } from '@angular/core';

/**
 * Avatar d'un collectionneur (V2, étape 8) : l'illustration de la carte
 * qu'il a choisie, en rond, ou à défaut l'initiale de son pseudo sur le fond
 * or métallique. Décoratif : le pseudo est toujours écrit à côté.
 */
@Component({
  selector: 'app-avatar',
  template: `
    @if (image(); as src) {
      <img [src]="src" alt="" loading="lazy" />
    } @else {
      <span class="initial">{{ initial() }}</span>
    }
  `,
  host: {
    'aria-hidden': 'true',
    '[style.--size.px]': 'size()',
  },
  styles: `
    :host {
      display: inline-grid;
      flex: none;
      place-items: center;
      width: var(--size);
      height: var(--size);
      overflow: hidden;
      border-radius: 50%;
      background: var(--cv-gold);
      box-shadow: 0 0 0 2px rgb(201 162 77 / 0.55);
    }
    /* L'illustration est dans le haut d'une carte : on cadre sur elle. */
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: 50% 22%;
      transform: scale(1.6);
      transform-origin: 50% 22%;
    }
    .initial {
      color: var(--cv-bg);
      font-weight: 700;
      font-size: calc(var(--size) * 0.45);
      line-height: 1;
    }
  `,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  /** URL de la vignette de la carte choisie ; absente : l'initiale. */
  readonly image = input<string | null | undefined>(null);
  readonly size = input(36);

  readonly initial = computed(() => this.name().trim().charAt(0).toUpperCase() || '?');
}
