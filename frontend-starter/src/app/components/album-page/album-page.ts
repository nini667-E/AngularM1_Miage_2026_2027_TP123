import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Album, AlbumDetail } from '../../shared/models/album.model';
import { AlbumCard, CardCategory } from '../../shared/models/card.model';
import { AlbumService } from '../../shared/services/album.service';
import { AuthService } from '../../shared/services/auth.service';
import { CardService } from '../../shared/services/card.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog';
import { ThemeChipsComponent } from '../../shared/components/theme-chips/theme-chips';
import { typeColor, typeIcon } from '../../shared/utils/card-types';
import { serverErrorMessage } from '../../shared/utils/http-error';
import { AddCardDialogComponent, AddCardDialogData } from '../add-card-dialog/add-card-dialog';
import { ALBUM_DIALOG_CONFIG, AlbumFormDialogComponent } from '../album-form-dialog/album-form-dialog';
import { CardZoomData, CardZoomDialogComponent, CardZoomResult } from '../card-zoom-dialog/card-zoom-dialog';

/** Une page de classeur = 9 pochettes, comme un vrai classeur de collection. */
export const CARDS_PER_PAGE = 9;

/** Page d'un album (V2, étapes 2 et 3) : en-tête + classeur de cartes. */
@Component({
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTooltipModule,
    ThemeChipsComponent,
  ],
  templateUrl: './album-page.html',
  styleUrl: './album-page.css',
})
export class AlbumPageComponent {
  private readonly albumService = inject(AlbumService);
  private readonly cardService = inject(CardService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly album = signal<AlbumDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notFound = signal(false);
  readonly deleting = signal(false);

  // Classeur.
  readonly cards = signal<AlbumCard[]>([]);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly cardsLoading = signal(false);
  readonly cardsError = signal('');
  readonly category = signal<CardCategory | ''>('');
  readonly perPage = CARDS_PER_PAGE;
  // Les URL signées des photos expirent (1 à 2 h) : une seule tentative de
  // rechargement par page pour en obtenir de nouvelles.
  private imageRetry = false;

  /** Les 9 pochettes de la page : une carte, ou null pour une pochette vide. */
  readonly pockets = computed<(AlbumCard | null)[]>(() =>
    Array.from({ length: CARDS_PER_PAGE }, (_, i) => this.cards()[i] ?? null),
  );

  readonly isOwner = computed(() => {
    const album = this.album();
    return Boolean(album) && album!.ownerId === this.auth.currentUser()?.id;
  });
  protected readonly color = computed(() => typeColor(this.album()?.theme.type));
  protected readonly icon = computed(() => typeIcon(this.album()?.theme.type));
  protected readonly logo = computed(() => this.album()?.theme.set?.logo ?? this.album()?.theme.serie?.logo ?? null);
  protected readonly typeColor = typeColor;
  protected readonly typeIcon = typeIcon;

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
        this.page.set(1);
        this.loadCards();
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

  loadCards(): void {
    const album = this.album();
    if (!album) return;
    this.cardsLoading.set(true);
    this.cardsError.set('');
    this.cardService.list(album.id, this.page(), CARDS_PER_PAGE, this.category() || undefined).subscribe({
      next: (response) => {
        this.cards.set(response.items);
        this.total.set(response.total);
        this.cardsLoading.set(false);
        this.imageRetry = false;
      },
      error: (error: HttpErrorResponse) => {
        console.error('[AlbumPage] Cartes indisponibles', error);
        this.cardsLoading.set(false);
        this.cardsError.set(serverErrorMessage(error, 'Impossible de charger les cartes'));
      },
    });
  }

  onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.loadCards();
  }

  onCategory(category: CardCategory | ''): void {
    this.category.set(category);
    this.page.set(1);
    this.loadCards();
  }

  /** Photo qui ne se charge plus (URL signée expirée) : nouvelles URL, une fois. */
  onImageError(): void {
    if (this.imageRetry) return;
    this.imageRetry = true;
    this.loadCards();
  }

  addCard(): void {
    const album = this.album();
    if (!album) return;
    this.dialog
      .open<AddCardDialogComponent, AddCardDialogData, AlbumCard>(AddCardDialogComponent, {
        width: '760px',
        maxWidth: '95vw',
        // Focus direct sur la recherche (par défaut : l'en-tête du stepper),
        // pour pouvoir taper le nom de la carte dès l'ouverture.
        autoFocus: 'input.card-search',
        data: { album },
      })
      .afterClosed()
      .subscribe((card) => {
        if (!card) return;
        this.snackBar.open(`« ${card.name} » ajoutée au classeur.`, 'OK', { duration: 4000, panelClass: 'snack-success' });
        this.album.set({ ...album, cardCount: album.cardCount + 1 });
        // La carte est ajoutée à la fin : on affiche la page qui la contient
        // (sans filtre, pour qu'elle soit visible quelle que soit sa catégorie).
        this.category.set('');
        this.page.set(Math.ceil((album.cardCount + 1) / CARDS_PER_PAGE));
        this.loadCards();
      });
  }

  openCard(card: AlbumCard): void {
    this.dialog
      .open<CardZoomDialogComponent, CardZoomData, CardZoomResult>(CardZoomDialogComponent, {
        maxWidth: '95vw',
        data: { card, canDelete: this.isOwner() },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result === 'delete') this.confirmRemoveCard(card);
      });
  }

  private confirmRemoveCard(card: AlbumCard): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: `Retirer « ${card.name} » ?`,
          message: 'La carte et ta photo seront supprimées de ce classeur.',
          confirmLabel: 'Retirer',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.cardService.delete(card.id).subscribe({
          next: () => {
            this.snackBar.open(`« ${card.name} » retirée du classeur.`, 'OK', { duration: 4000, panelClass: 'snack-success' });
            const album = this.album();
            if (album) this.album.set({ ...album, cardCount: Math.max(0, album.cardCount - 1) });
            // Dernière carte d'une page > 1 : on recule d'une page.
            if (this.cards().length === 1 && this.page() > 1) this.page.update((p) => p - 1);
            this.loadCards();
          },
          error: (error: HttpErrorResponse) => {
            this.snackBar.open(serverErrorMessage(error, 'Suppression impossible'), 'OK', {
              duration: 6000,
              panelClass: 'snack-error',
            });
          },
        });
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
    const cards = album.cardCount === 0 ? '' : ` Ses ${album.cardCount} carte(s) et leurs photos seront supprimées.`;
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
