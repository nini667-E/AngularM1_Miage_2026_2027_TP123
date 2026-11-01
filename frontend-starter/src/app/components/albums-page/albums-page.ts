import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Album } from '../../shared/models/album.model';
import { AlbumService } from '../../shared/services/album.service';
import { AlbumCoverComponent } from '../../shared/components/album-cover/album-cover';
import { serverErrorMessage } from '../../shared/utils/http-error';
import { ALBUM_DIALOG_CONFIG, AlbumFormDialogComponent } from '../album-form-dialog/album-form-dialog';

/** « Mes albums » (V2, étape 2) : grille paginée des albums de l'utilisateur. */
@Component({
  imports: [MatButtonModule, MatIconModule, MatPaginatorModule, MatProgressBarModule, AlbumCoverComponent],
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

  constructor() {
    this.load();
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
        this.page.set(1);
        this.load();
      });
  }
}
