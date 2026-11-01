import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ImageCroppedEvent, ImageCropperComponent } from 'ngx-image-cropper';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap, tap } from 'rxjs';
import { Album } from '../../shared/models/album.model';
import { AlbumCard, CardDetail, CardSearchResult, PhotoAdjustments } from '../../shared/models/card.model';
import { CardService } from '../../shared/services/card.service';
import { typeColor, typeIcon } from '../../shared/utils/card-types';
import { serverErrorMessage } from '../../shared/utils/http-error';

/** Mêmes règles que le backend (services/images.js). */
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
/** Format d'une carte (63 × 88 mm) : le cadre de recadrage le respecte. */
export const CARD_RATIO = 63 / 88;

export interface AddCardDialogData {
  album: Album;
}

/**
 * Ajout d'une carte (V2, étape 3), en deux étapes (MatStepper linéaire) :
 * 1. la carte : recherche dans le catalogue (MatAutocomplete), puis détail
 *    avec le verdict de cohérence calculé par le serveur ; impossible
 *    d'avancer si la carte est refusée ;
 * 2. la photo : choix, recadrage au format carte (ngx-image-cropper) avec
 *    rotation par quarts de tour, envoi avec barre de progression. Seules
 *    les coordonnées du cadre sont envoyées : le serveur découpe l'original.
 * Se ferme avec la carte ajoutée.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatStepperModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    ImageCropperComponent,
  ],
  templateUrl: './add-card-dialog.html',
  styleUrl: './add-card-dialog.css',
})
export class AddCardDialogComponent {
  private readonly cards = inject(CardService);
  private readonly dialogRef = inject(MatDialogRef<AddCardDialogComponent, AlbumCard>);
  protected readonly data = inject<AddCardDialogData>(MAT_DIALOG_DATA);
  protected readonly typeColor = typeColor;
  protected readonly typeIcon = typeIcon;

  // Étape 1 : la carte.
  readonly query = new FormControl<string | CardSearchResult>('', { nonNullable: true });
  readonly results = signal<CardSearchResult[]>([]);
  readonly searching = signal(false);
  readonly searchError = signal('');
  readonly detail = signal<CardDetail | null>(null);
  readonly loadingDetail = signal(false);
  /** Étape 1 terminée : une carte choisie ET acceptée par le serveur. */
  readonly cardAccepted = computed(() => {
    const detail = this.detail();
    return Boolean(detail) && (detail!.verdict === null || detail!.verdict.compatible);
  });

  // Étape 2 : la photo.
  readonly photo = signal<File | null>(null);
  /** Aperçu du résultat recadré (petite image produite par le recadreur). */
  readonly preview = signal('');
  /** Cadre choisi, en pixels de la photo redressée puis tournée ; null tant que le recadreur n'est pas prêt. */
  readonly crop = signal<PhotoAdjustments['crop'] | null>(null);
  /** Quarts de tour demandés (sens horaire), 0 à 3. */
  readonly rotation = signal(0);
  protected readonly cardRatio = CARD_RATIO;
  readonly photoError = signal('');
  readonly uploading = signal(false);
  readonly progress = signal(0);
  readonly uploadError = signal('');

  constructor() {
    this.query.valueChanges
      .pipe(
        // Une option choisie remplace le texte par l'objet : on ne relance pas.
        filter((value): value is string => typeof value === 'string'),
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => this.searchError.set('')),
        switchMap((name) => {
          if (name.length < 2) return of([]);
          this.searching.set(true);
          return this.cards.search(name, this.data.album.id).pipe(
            catchError((error: HttpErrorResponse) => {
              this.searchError.set(serverErrorMessage(error, 'Recherche impossible'));
              return of([]);
            }),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((results) => {
        this.searching.set(false);
        this.results.set(results);
      });
  }

  /** Texte affiché dans le champ quand une carte est choisie. */
  readonly displayCard = (value: CardSearchResult | string | null) =>
    typeof value === 'string' ? value : (value?.name ?? '');

  select(event: MatAutocompleteSelectedEvent): void {
    const result = event.option.value as CardSearchResult;
    this.detail.set(null);
    this.loadingDetail.set(true);
    this.searchError.set('');
    this.cards.detail(result.id, this.data.album.id).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.loadingDetail.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loadingDetail.set(false);
        this.searchError.set(serverErrorMessage(error, 'Carte introuvable'));
      },
    });
  }

  choosePhoto(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.photoError.set('');
    this.uploadError.set('');
    this.setPhoto(null);
    if (!file) return;
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      this.photoError.set('Format non accepté : JPEG, PNG ou WebP');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      this.photoError.set('Photo trop volumineuse (10 Mo maximum)');
      return;
    }
    this.setPhoto(file);
  }

  private setPhoto(file: File | null): void {
    this.photo.set(file);
    this.preview.set('');
    this.crop.set(null);
    this.rotation.set(0);
  }

  /**
   * Le recadreur signale chaque nouveau cadre. imagePosition est exprimé en
   * pixels de la photo affichée (déjà redressée, puis tournée) : c'est le
   * repère attendu par le serveur.
   */
  onCropped(event: ImageCroppedEvent): void {
    const { x1, y1, x2, y2 } = event.imagePosition;
    this.crop.set({ x: Math.round(x1), y: Math.round(y1), width: Math.round(x2 - x1), height: Math.round(y2 - y1) });
    this.preview.set(event.base64 ?? '');
  }

  onCropperFailed(): void {
    this.setPhoto(null);
    this.photoError.set('Impossible de lire cette image');
  }

  /** Quart de tour : +1 sens horaire, -1 sens antihoraire. Le cadre est recalculé. */
  rotate(step: 1 | -1): void {
    this.rotation.update((r) => (r + step + 4) % 4);
    this.crop.set(null);
  }

  upload(): void {
    const detail = this.detail();
    const photo = this.photo();
    const crop = this.crop();
    if (!detail || !photo || !crop || !this.cardAccepted() || this.uploading()) return;

    this.uploading.set(true);
    this.progress.set(0);
    this.uploadError.set('');
    // Pendant l'envoi, on ne ferme pas la fenêtre par erreur (Échap, clic dehors).
    this.dialogRef.disableClose = true;
    this.cards.add(this.data.album.id, detail.tcgdexId, photo, { crop, rotation: this.rotation() }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progress.set(Math.round((100 * event.loaded) / event.total));
        } else if (event.type === HttpEventType.Response && event.body) {
          this.dialogRef.close(event.body);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.uploading.set(false);
        this.dialogRef.disableClose = false;
        this.uploadError.set(serverErrorMessage(error, "Échec de l'envoi"));
      },
    });
  }
}
