import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Album } from '../../shared/models/album.model';
import { UserProfile } from '../../shared/models/user.model';
import { UserService } from '../../shared/services/user.service';
import { AlbumCoverComponent } from '../../shared/components/album-cover/album-cover';
import { AvatarComponent } from '../../shared/components/avatar/avatar';
import { FriendButtonComponent } from '../../shared/components/friend-button/friend-button';
import { serverErrorMessage } from '../../shared/utils/http-error';
import { pageTitle } from '../../shared/utils/page-title';

export const ALBUMS_PER_PAGE = 12;

/**
 * Page publique d'un collectionneur (V2, étape 8) : avatar, pseudo, bio,
 * chiffres, bouton d'amitié (ou « Modifier mon profil » sur la mienne), et
 * ses albums que je peux voir.
 */
@Component({
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    AlbumCoverComponent,
    AvatarComponent,
    FriendButtonComponent,
  ],
  templateUrl: './user-page.html',
  styleUrl: './user-page.css',
})
export class UserPageComponent {
  private readonly userService = inject(UserService);
  private readonly title = inject(Title);

  readonly profile = signal<UserProfile | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly error = signal('');

  readonly albums = signal<Album[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly albumsLoading = signal(false);
  readonly albumsError = signal('');
  readonly perPage = ALBUMS_PER_PAGE;

  constructor() {
    // Même composant pour un autre profil (lien depuis un profil) : on recharge.
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((params) => this.load(params.get('id') ?? ''));
  }

  load(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set('');
    this.profile.set(null);
    this.albums.set([]);
    this.userService.profile(id).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
        this.title.setTitle(pageTitle(profile.name));
        this.page.set(1);
        this.loadAlbums();
      },
      error: (error: HttpErrorResponse) => {
        console.error('[UserPage] Profil indisponible', error);
        this.loading.set(false);
        if (error.status === 404) this.notFound.set(true);
        else this.error.set(serverErrorMessage(error, 'Impossible de charger ce profil'));
      },
    });
  }

  loadAlbums(): void {
    const profile = this.profile();
    if (!profile) return;
    this.albumsLoading.set(true);
    this.albumsError.set('');
    this.userService.albums(profile.id, this.page(), ALBUMS_PER_PAGE).subscribe({
      next: (response) => {
        this.albums.set(response.items);
        this.total.set(response.total);
        this.albumsLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[UserPage] Albums indisponibles', error);
        this.albumsLoading.set(false);
        this.albumsError.set(serverErrorMessage(error, 'Impossible de charger ses albums'));
      },
    });
  }

  onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.loadAlbums();
  }
}
