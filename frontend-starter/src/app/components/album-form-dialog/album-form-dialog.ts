import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Album, AlbumInput, Visibility } from '../../shared/models/album.model';
import { CatalogSet } from '../../shared/models/catalog.model';
import { AlbumService } from '../../shared/services/album.service';
import { CatalogService } from '../../shared/services/catalog.service';
import { typeColor, typeIcon } from '../../shared/utils/card-types';
import { serverErrorMessage } from '../../shared/utils/http-error';

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 500;

/** Taille de la fenêtre, partagée par tous les endroits qui l'ouvrent. */
export const ALBUM_DIALOG_CONFIG = { width: '640px', maxWidth: '95vw', autoFocus: 'first-tabbable' } as const;

/** Données de la fenêtre : `album` absent = création, présent = modification. */
export interface AlbumFormDialogData {
  album?: Album;
}

/**
 * Fenêtre de création / modification d'un album (V2, étape 2). Elle
 * enregistre elle-même l'album et se ferme avec l'album enregistré ; en
 * cas d'erreur serveur, elle reste ouverte et affiche le message.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './album-form-dialog.html',
  styleUrl: './album-form-dialog.css',
})
export class AlbumFormDialogComponent {
  private readonly albums = inject(AlbumService);
  private readonly catalog = inject(CatalogService);
  private readonly dialogRef = inject(MatDialogRef<AlbumFormDialogComponent, Album>);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<AlbumFormDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  protected readonly titleMax = TITLE_MAX;
  protected readonly descriptionMax = DESCRIPTION_MAX;
  protected readonly typeColor = typeColor;
  protected readonly typeIcon = typeIcon;
  protected readonly editing = Boolean(this.data.album);

  protected readonly types = toSignal(this.catalog.types(), { initialValue: [] as string[] });
  protected readonly series = toSignal(this.catalog.series(), { initialValue: [] });
  protected readonly sets = signal<CatalogSet[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  readonly form = new FormGroup({
    title: new FormControl(this.data.album?.title ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(TITLE_MAX)],
    }),
    description: new FormControl(this.data.album?.description ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(DESCRIPTION_MAX)],
    }),
    visibility: new FormControl<Visibility>(this.data.album?.visibility ?? 'private', { nonNullable: true }),
    type: new FormControl(this.data.album?.theme.type ?? '', { nonNullable: true }),
    serieId: new FormControl(this.data.album?.theme.serie?.id ?? '', { nonNullable: true }),
    // Désactivé tant qu'aucune série n'est choisie (une extension appartient
    // toujours à une série).
    setId: new FormControl({ value: '', disabled: true }, { nonNullable: true }),
  });

  constructor() {
    const initialSet = this.data.album?.theme.set?.id ?? '';
    this.loadSets(this.form.controls.serieId.value, initialSet);

    // Changer de série vide l'extension : l'ancienne n'en fait plus partie.
    this.form.controls.serieId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((serieId) => this.loadSets(serieId, ''));
  }

  private loadSets(serieId: string, selected: string): void {
    const setId = this.form.controls.setId;
    setId.setValue('');
    setId.disable();
    this.sets.set([]);
    if (!serieId) return;

    this.catalog.sets(serieId).subscribe({
      next: (sets) => {
        this.sets.set(sets);
        setId.enable();
        setId.setValue(sets.some((set) => set.id === selected) ? selected : '');
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(serverErrorMessage(error, 'Impossible de charger les extensions'));
      },
    });
  }

  /** Corps envoyé à l'API : le thème ne contient que les champs choisis. */
  protected toInput(): AlbumInput {
    const values = this.form.getRawValue();
    const theme: AlbumInput['theme'] = {};
    if (values.type) theme.type = values.type;
    if (values.serieId) theme.serieId = values.serieId;
    if (values.serieId && values.setId) theme.setId = values.setId;
    return {
      title: values.title.trim(),
      description: values.description.trim(),
      visibility: values.visibility,
      theme,
    };
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set('');
    const input = this.toInput();
    const request = this.data.album ? this.albums.update(this.data.album.id, input) : this.albums.create(input);

    request.subscribe({
      next: (album) => {
        console.debug('[AlbumForm] Album enregistré', album.id);
        this.dialogRef.close(album);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[AlbumForm] Enregistrement impossible', error);
        this.saving.set(false);
        this.error.set(serverErrorMessage(error, "Impossible d'enregistrer l'album"));
      },
    });
  }
}
