import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Album, AlbumDetail } from '../../shared/models/album.model';
import { AlbumService } from '../../shared/services/album.service';
import { AuthService } from '../../shared/services/auth.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog';
import { ThemeChipsComponent } from '../../shared/components/theme-chips/theme-chips';
import { typeColor, typeIcon } from '../../shared/utils/card-types';
import { serverErrorMessage } from '../../shared/utils/http-error';
import { ALBUM_DIALOG_CONFIG, AlbumFormDialogComponent } from '../album-form-dialog/album-form-dialog';

/** Page d'un album (V2, étape 2) : en-tête + classeur (cartes à l'étape 3). */
@Component({
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule, ThemeChipsComponent],
  templateUrl: './album-page.html',
  styleUrl: './album-page.css',
})
export class AlbumPageComponent {
  private readonly albumService = inject(AlbumService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly album = signal<AlbumDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notFound = signal(false);
  readonly deleting = signal(false);

  // Les 9 pochettes d'une page de classeur.
  protected readonly slots = Array.from({ length: 9 }, (_, i) => i);

  readonly isOwner = computed(() => {
    const album = this.album();
    return Boolean(album) && album!.ownerId === this.auth.currentUser()?.id;
  });
  protected readonly color = computed(() => typeColor(this.album()?.theme.type));
  protected readonly icon = computed(() => typeIcon(this.album()?.theme.type));
  protected readonly logo = computed(() => this.album()?.theme.set?.logo ?? this.album()?.theme.serie?.logo ?? null);

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((params) => this.load(params.get('id') ?? ''));
  }

  load(id: string): void {
    this.loading.set(true);
    this.error.set('');
    this.notFound.set(false);
    this.albumService.get(id).subscribe({
      next: (album) => {
        this.album.set(album);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[AlbumPage] Chargement impossible', error);
        this.loading.set(false);
        this.album.set(null);
        // 404 : inexistant OU privé d'un autre (le backend ne distingue pas).
        if (error.status === 404) this.notFound.set(true);
        else this.error.set(serverErrorMessage(error, "Impossible de charger l'album"));
      },
    });
  }

  edit(): void {
    const album = this.album();
    if (!album) return;
    this.dialog
      .open(AlbumFormDialogComponent, { ...ALBUM_DIALOG_CONFIG, data: { album } })
      .afterClosed()
      .subscribe((saved?: Album) => {
        if (!saved) return;
        this.album.set({ ...album, ...saved });
        this.snackBar.open('Album enregistré.', 'OK', { duration: 4000, panelClass: 'snack-success' });
      });
  }

  confirmDelete(): void {
    const album = this.album();
    if (!album || this.deleting()) return;
    const cards = album.cardCount === 0 ? '' : ` Ses ${album.cardCount} carte(s) seront supprimées.`;
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: `Supprimer « ${album.title} » ?`,
          message: `Cette action est définitive.${cards}`,
          confirmLabel: 'Supprimer',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) this.delete(album);
      });
  }

  private delete(album: AlbumDetail): void {
    this.deleting.set(true);
    this.albumService.delete(album.id).subscribe({
      next: () => {
        this.snackBar.open(`Album « ${album.title} » supprimé.`, 'OK', { duration: 4000, panelClass: 'snack-success' });
        void this.router.navigateByUrl('/albums');
      },
      error: (error: HttpErrorResponse) => {
        console.error('[AlbumPage] Suppression impossible', error);
        this.deleting.set(false);
        this.snackBar.open(serverErrorMessage(error, 'Suppression impossible'), 'OK', {
          duration: 6000,
          panelClass: 'snack-error',
        });
      },
    });
  }
}
