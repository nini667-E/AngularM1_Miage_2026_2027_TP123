import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivityItem, ActivityResponse, RecentResponse } from '../../shared/models/discover.model';
import { AuthService } from '../../shared/services/auth.service';
import { DiscoverService } from '../../shared/services/discover.service';
import { AlbumCoverComponent } from '../../shared/components/album-cover/album-cover';
import { CardTileComponent } from '../../shared/components/card-tile/card-tile';
import { serverErrorMessage } from '../../shared/utils/http-error';

/**
 * Accueil (V2, étape 7) : ce qui vient d'être ajouté dans les albums publics
 * (dernières cartes, nouveaux albums), puis l'activité de mes amis. Les deux
 * parties se chargent indépendamment : l'échec de l'une n'empêche pas
 * l'autre de s'afficher.
 */
@Component({
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, AlbumCoverComponent, CardTileComponent],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePageComponent {
  private readonly discoverService = inject(DiscoverService);
  protected readonly auth = inject(AuthService);

  readonly recent = signal<RecentResponse | null>(null);
  readonly recentError = signal('');
  readonly activity = signal<ActivityResponse | null>(null);
  readonly activityError = signal('');

  constructor() {
    this.discoverService.recent().subscribe({
      next: (recent) => this.recent.set(recent),
      error: (error: HttpErrorResponse) => {
        console.error('[HomePage] Récents indisponibles', error);
        this.recentError.set(serverErrorMessage(error, 'Impossible de charger les nouveautés'));
      },
    });
    this.discoverService.activity().subscribe({
      next: (activity) => this.activity.set(activity),
      error: (error: HttpErrorResponse) => {
        console.error('[HomePage] Activité indisponible', error);
        this.activityError.set(serverErrorMessage(error, 'Impossible de charger l’activité de tes amis'));
      },
    });
  }

  /** « ton album », « son album » ou « l'album de X », selon qui le possède. */
  albumOwnerLabel(item: ActivityItem): string {
    const owner = item.album.owner;
    if (owner.id === this.auth.currentUser()?.id) return 'ton album';
    if (owner.id === item.actor.id) return 'son album';
    return `l’album de ${owner.name}`;
  }

  initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }
}
