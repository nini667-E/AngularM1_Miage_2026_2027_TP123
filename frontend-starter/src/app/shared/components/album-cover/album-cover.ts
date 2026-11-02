import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Album } from '../../models/album.model';
import { PublicUser } from '../../models/friend.model';
import { typeColor, typeIcon } from '../../utils/card-types';
import { ThemeChipsComponent } from '../theme-chips/theme-chips';

/**
 * Couverture d'album, façon classeur de collection : teinte du type,
 * logo de l'extension (ou de la série, ou icône du type), liseré doré.
 * Réutilisée par « Mes albums » puis l'accueil, la recherche et les profils.
 */
@Component({
  selector: 'app-album-cover',
  imports: [RouterLink, MatIconModule, MatTooltipModule, ThemeChipsComponent],
  templateUrl: './album-cover.html',
  styleUrl: './album-cover.css',
})
export class AlbumCoverComponent {
  readonly album = input.required<Album>();
  /** Propriétaire à afficher (« par X ») : albums partagés avec moi (étape 5). */
  readonly owner = input<PublicUser | null>(null);

  protected readonly color = computed(() => typeColor(this.album().theme.type));
  protected readonly icon = computed(() => typeIcon(this.album().theme.type));
  protected readonly logo = computed(() => this.album().theme.set?.logo ?? this.album().theme.serie?.logo ?? null);
  /** Icône et textes de visibilité, partage compris (étape 5). */
  protected readonly visibility = computed(() => {
    const album = this.album();
    if (album.visibility === 'public') {
      return { icon: 'public', label: 'Album public', tooltip: 'Public : visible par tous' };
    }
    if (this.owner()) {
      return { icon: 'group', label: 'Album privé, partagé avec toi', tooltip: 'Privé : partagé avec toi' };
    }
    const n = album.sharedCount ?? 0;
    if (n > 0) {
      const friends = n === 1 ? '1 ami' : `${n} amis`;
      return { icon: 'group', label: `Album privé, partagé avec ${friends}`, tooltip: `Privé : partagé avec ${friends}` };
    }
    return { icon: 'lock', label: 'Album privé', tooltip: 'Privé : visible par toi seul' };
  });
  protected readonly cardLabel = computed(() => {
    const n = this.album().cardCount;
    return n === 0 ? 'Aucune carte' : n === 1 ? '1 carte' : `${n} cartes`;
  });
}
