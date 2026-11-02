import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { Album, SharedAlbum } from '../../shared/models/album.model';
import { AlbumService } from '../../shared/services/album.service';
import { AlbumCoverComponent } from '../../shared/components/album-cover/album-cover';
import { serverErrorMessage } from '../../shared/utils/http-error';
import { ALBUM_DIALOG_CONFIG, AlbumFormDialogComponent } from '../album-form-dialog/album-form-dialog';

/**
 * « Mes albums » (V2, étape 2) : grille paginée des albums de l'utilisateur ;
 * onglet « Partagés avec moi » (étape 5) : albums privés que des amis
 * partagent avec lui, chargés à la première ouverture de l'onglet.
 */
@Component({
  imports: [MatButtonModule, MatIconModule, MatPaginatorModule, MatProgressBarModule, MatTabsModule, AlbumCoverComponent],
  templateUrl: './albums-page.html',
  styleUrl: './albums-page.css',
})
export class AlbumsPageComponent {
  private readonly albumService = inject(AlbumService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly albums = signal<Album[]>([]);
  readonly page = signal(1);
  readonly limit = signal(12);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly tab = signal(0);

  // Onglet « Partagés avec moi » (étape 5).
  readonly shared = signal<SharedAlbum[]>([]);
  readonly sharedPage = signal(1);
  readonly sharedTotal = signal(0);
  readonly sharedLoading = signal(false);
  readonly sharedLoaded = signal(false);
  readonly sharedError = signal('');

  constructor() {
    this.load();
  }

  onTab(index: number): void {
    this.tab.set(index);
    // Rechargé à chaque ouverture : un ami a pu partager ou arrêter un partage.
    if (index === 1) this.loadShared();
  }

  loadShared(): void {
    this.sharedLoading.set(true);
    this.sharedError.set('');
    this.albumService.shared(this.sharedPage(), this.limit()).subscribe({
      next: (response) => {
        this.shared.set(response.items);
        this.sharedTotal.set(response.total);
        this.sharedLoading.set(false);
        this.sharedLoaded.set(true);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[AlbumsPage] Albums partagés indisponibles', error);
        this.sharedLoading.set(false);
        this.sharedError.set(serverErrorMessage(error, 'Impossible de charger les albums partagés avec toi'));
      },
    });
  }

  onSharedPage(event: PageEvent): void {
    this.sharedPage.set(event.pageIndex + 1);
    this.loadShared();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.albumService.mine(this.page(), this.limit()).subscribe({
      next: (response) => {
        this.albums.set(response.items);
        this.total.set(response.total);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[AlbumsPage] Chargement impossible', error);
        this.loading.set(false);
        this.error.set(serverErrorMessage(error, 'Impossible de charger tes albums'));
      },
    });
  }

  onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.limit.set(event.pageSize);
    this.load();
  }

  create(): void {
    this.dialog
      .open(AlbumFormDialogComponent, { ...ALBUM_DIALOG_CONFIG, data: {} })
      .afterClosed()
      .subscribe((album?: Album) => {
        if (!album) return;
        this.snackBar.open(`Album « ${album.title} » créé.`, 'OK', { duration: 4000, panelClass: 'snack-success' });
        // Le nouvel album est le plus récent : il apparaît en tête de la page 1.
        this.tab.set(0);
        this.page.set(1);
        this.load();
      });
  }
}
