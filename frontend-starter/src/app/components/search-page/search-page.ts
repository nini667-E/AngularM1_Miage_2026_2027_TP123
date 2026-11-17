import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { debounceTime, distinctUntilChanged, map, Observable, of, Subscription, switchMap } from 'rxjs';
import { AlbumWithOwner, DiscoveredCard, SearchCriteria } from '../../shared/models/discover.model';
import { CatalogSet } from '../../shared/models/catalog.model';
import { Page } from '../../shared/models/page.model';
import { CatalogService } from '../../shared/services/catalog.service';
import { DiscoverService } from '../../shared/services/discover.service';
import { AlbumCoverComponent } from '../../shared/components/album-cover/album-cover';
import { CardTileComponent } from '../../shared/components/card-tile/card-tile';
import { serverErrorMessage } from '../../shared/utils/http-error';

export const SEARCH_DEBOUNCE_MS = 300;
export const RESULTS_PER_PAGE = 12;
export const CARD_CATEGORIES = ['Pokémon', 'Dresseur', 'Énergie'];

/** Un onglet de résultats : sa page, son total, son état. */
class ResultTab<T> {
  readonly items = signal<T[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly loaded = signal(false);
  sub?: Subscription;

  reset(): void {
    this.sub?.unsubscribe();
    this.items.set([]);
    this.total.set(0);
    this.page.set(1);
    this.loading.set(false);
    this.error.set('');
    this.loaded.set(false);
  }
}

/**
 * Recherche (V2, étape 7) : un texte et des filtres de thème communs, deux
 * onglets de résultats, albums et cartes, parmi ce que je peux voir. Sans
 * critère, l'onglet Albums liste tous les albums visibles ; l'onglet Cartes
 * attend un texte ou un filtre.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    AlbumCoverComponent,
    CardTileComponent,
  ],
  templateUrl: './search-page.html',
  styleUrl: './search-page.css',
})
export class SearchPageComponent {
  private readonly discoverService = inject(DiscoverService);
  private readonly catalog = inject(CatalogService);

  readonly form = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    type: new FormControl('', { nonNullable: true }),
    serieId: new FormControl('', { nonNullable: true }),
    setId: new FormControl({ value: '', disabled: true }, { nonNullable: true }),
    category: new FormControl('', { nonNullable: true }),
  });

  readonly types = toSignal(this.catalog.types(), { initialValue: [] as string[] });
  readonly series = toSignal(this.catalog.series(), { initialValue: [] });
  readonly sets = signal<CatalogSet[]>([]);
  readonly categories = CARD_CATEGORIES;
  readonly perPage = RESULTS_PER_PAGE;

  readonly albums = new ResultTab<AlbumWithOwner>();
  readonly cards = new ResultTab<DiscoveredCard>();
  readonly criteria = signal<SearchCriteria>({ q: '', type: '', serieId: '', setId: '', category: '' });
  readonly tab = signal(0);

  /** Un seul caractère : trop court, on attend le suivant. */
  readonly tooShort = computed(() => this.criteria().q.length === 1);
  /** L'onglet Cartes exige un texte (2 caractères) ou un filtre. */
  readonly cardsAllowed = computed(() => {
    const c = this.criteria();
    return !this.tooShort() && Boolean(c.q || c.type || c.serieId || c.setId || c.category);
  });
  readonly hasFilters = computed(() => {
    const c = this.criteria();
    return Boolean(c.q || c.type || c.serieId || c.setId || c.category);
  });

  constructor() {
    const { serieId, setId } = this.form.controls;
    // Extension : seulement après la série, et vidée si la série change.
    serieId.valueChanges
      .pipe(
        distinctUntilChanged(),
        switchMap((id) => {
          setId.reset('');
          if (id) setId.enable({ emitEvent: false });
          else setId.disable({ emitEvent: false });
          return id ? this.catalog.sets(id) : of([] as CatalogSet[]);
        }),
        takeUntilDestroyed(),
      )
      .subscribe({ next: (sets) => this.sets.set(sets), error: () => this.sets.set([]) });

    this.form.valueChanges
      .pipe(
        map(() => this.readCriteria()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntilDestroyed(),
      )
      .subscribe((criteria) => this.search(criteria));

    this.search(this.readCriteria());
  }

  private readCriteria(): SearchCriteria {
    const value = this.form.getRawValue();
    return { ...value, q: value.q.trim() };
  }

  /** Nouveaux critères : les deux onglets repartent de la page 1. */
  search(criteria: SearchCriteria): void {
    this.criteria.set(criteria);
    this.albums.reset();
    this.cards.reset();
    if (this.tooShort()) return;
    this.loadAlbums();
    if (this.cardsAllowed()) this.loadCards();
  }

  loadAlbums(): void {
    this.load(this.albums, this.discoverService.searchAlbums(this.criteria(), this.albums.page(), RESULTS_PER_PAGE), 'Recherche d’albums impossible');
  }

  loadCards(): void {
    this.load(this.cards, this.discoverService.searchCards(this.criteria(), this.cards.page(), RESULTS_PER_PAGE), 'Recherche de cartes impossible');
  }

  onAlbumsPage(event: PageEvent): void {
    this.albums.page.set(event.pageIndex + 1);
    this.loadAlbums();
  }

  onCardsPage(event: PageEvent): void {
    this.cards.page.set(event.pageIndex + 1);
    this.loadCards();
  }

  clear(): void {
    this.form.reset();
  }

  /** Lance une recherche dans un onglet ; une recherche plus récente annule la précédente. */
  private load<T>(tab: ResultTab<T>, request: Observable<Page<T>>, fallback: string): void {
    tab.sub?.unsubscribe();
    tab.loading.set(true);
    tab.error.set('');
    tab.sub = request.subscribe({
      next: (response) => {
        tab.items.set(response.items);
        tab.total.set(response.total);
        tab.loading.set(false);
        tab.loaded.set(true);
      },
      error: (error: HttpErrorResponse) => {
        console.error('[SearchPage] Recherche impossible', error);
        tab.loading.set(false);
        tab.error.set(serverErrorMessage(error, fallback));
      },
    });
  }
}
