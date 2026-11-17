import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DiscoveredCard } from '../../models/discover.model';

/**
 * Tuile d'une carte trouvée ailleurs que dans son classeur (V2, étape 7) :
 * la photo au format carte, son nom, l'album et le collectionneur. Mène à
 * l'album. Utilisée par l'Accueil (dernières cartes) et la Recherche.
 */
@Component({
  selector: 'app-card-tile',
  imports: [RouterLink],
  template: `
    @let c = card();
    <a class="tile" [routerLink]="['/albums', c.album.id]" [attr.aria-label]="c.name + ', dans ' + c.album.title + ', par ' + c.owner.name">
      <span class="photo">
        <img [src]="c.photo.thumb" [alt]="c.name" loading="lazy" />
      </span>
      <span class="name">{{ c.name }}</span>
      <span class="where">{{ c.album.title }} · par {{ c.owner.name }}</span>
    </a>
  `,
  styles: `
    :host { display: block; }
    .tile {
      display: grid;
      gap: 0.3rem;
      color: inherit;
      text-decoration: none;
    }
    .photo {
      display: block;
      overflow: hidden;
      aspect-ratio: 63 / 88;
      border: 1px solid rgb(201 162 77 / 0.35);
      border-radius: 10px;
      background: var(--cv-surface);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }
    .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .tile:hover .photo,
    .tile:focus-visible .photo {
      transform: translateY(-3px);
      box-shadow: 0 10px 24px rgb(0 0 0 / 0.45);
    }
    .tile:focus-visible { outline: none; }
    .name { font: var(--mat-sys-title-small); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .where {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class CardTileComponent {
  readonly card = input.required<DiscoveredCard>();
}
