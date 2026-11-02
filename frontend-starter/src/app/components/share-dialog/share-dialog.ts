import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule, MatListOption } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Album, AlbumShare } from '../../shared/models/album.model';
import { AlbumService } from '../../shared/services/album.service';
import { serverErrorMessage } from '../../shared/utils/http-error';

export interface ShareDialogData {
  album: Album;
}

/**
 * Partage d'un album privé (V2, étape 5) : on coche les amis qui peuvent le
 * voir ; décocher un ami arrête son partage. Se ferme avec l'album mis à
 * jour (sharedCount) après l'enregistrement, ou sans valeur si on annule.
 */
@Component({
  imports: [RouterLink, MatButtonModule, MatDialogModule, MatIconModule, MatListModule, MatProgressBarModule],
  templateUrl: './share-dialog.html',
  styleUrl: './share-dialog.css',
})
export class ShareDialogComponent {
  private readonly albumService = inject(AlbumService);
  private readonly dialogRef = inject<MatDialogRef<ShareDialogComponent, Album>>(MatDialogRef);
  protected readonly data = inject<ShareDialogData>(MAT_DIALOG_DATA);

  readonly shares = signal<AlbumShare[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly saveError = signal('');
  /** Identifiants des amis cochés. */
  readonly selected = signal<ReadonlySet<string>>(new Set());

  /** Vrai si la sélection diffère de ce qui est enregistré. */
  readonly changed = computed(() => {
    const initial = this.shares().filter((share) => share.shared).map((share) => share.user.id);
    const selected = this.selected();
    return initial.length !== selected.size || initial.some((id) => !selected.has(id));
  });

  constructor() {
    this.albumService.shares(this.data.album.id).subscribe({
      next: (shares) => {
        this.shares.set(shares);
        this.selected.set(new Set(shares.filter((share) => share.shared).map((share) => share.user.id)));
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[ShareDialog] Chargement impossible', error);
        this.loading.set(false);
        this.error.set(serverErrorMessage(error, 'Impossible de charger tes amis'));
      },
    });
  }

  onSelection(options: readonly MatListOption[]): void {
    this.selected.set(new Set(options.map((option) => option.value as string)));
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');
    this.dialogRef.disableClose = true;
    this.albumService.setShares(this.data.album.id, [...this.selected()]).subscribe({
      next: (album) => this.dialogRef.close(album),
      error: (error: HttpErrorResponse) => {
        console.error('[ShareDialog] Enregistrement impossible', error);
        this.saving.set(false);
        this.dialogRef.disableClose = false;
        this.saveError.set(serverErrorMessage(error, 'Impossible d’enregistrer le partage'));
      },
    });
  }

  initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }
}
