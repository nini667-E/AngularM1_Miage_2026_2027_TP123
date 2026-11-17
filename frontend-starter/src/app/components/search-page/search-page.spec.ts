import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AlbumWithOwner, DiscoveredCard } from '../../shared/models/discover.model';
import { SearchPageComponent } from './search-page';

const owner = { id: 'u2', name: 'Ondine' };
const album = (id: string, title: string): AlbumWithOwner => ({
  id,
  ownerId: 'u2',
  title,
  description: '',
  visibility: 'public',
  theme: { type: null, serie: null, set: null },
  cardCount: 0,
  likeCount: 0,
  commentCount: 0,
  sharedCount: null,
  createdAt: '2026-11-10',
  updatedAt: '2026-11-10',
  owner,
});
const card = (id: string, name: string): DiscoveredCard =>
  ({ id, albumId: 'a1', name, photo: { thumb: `/api/images/${id}/thumb`, full: '' }, album: { id: 'a1', title: 'Mes Psy' }, owner }) as DiscoveredCard;
const pageOf = <T>(items: T[], total = items.length, page = 1) => ({ items, page, limit: 12, total, pages: Math.max(1, Math.ceil(total / 12)) });

describe('SearchPageComponent (Recherche)', () => {
  let fixture: ComponentFixture<SearchPageComponent>;
  let component: SearchPageComponent;
  let httpMock: HttpTestingController;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SearchPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SearchPageComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
    httpMock.expectOne('/api/catalog/types').flush(['Eau', 'Feu', 'Psy']);
    httpMock.expectOne('/api/catalog/series').flush([{ id: 'sv', name: 'Écarlate et Violet', logo: null }]);
  });

  afterEach(() => {
    vi.useRealTimers();
    httpMock.verify();
  });

  const albumsRequest = (): TestRequest => httpMock.expectOne((r) => r.url === '/api/discover/albums');
  const cardsRequest = (): TestRequest => httpMock.expectOne((r) => r.url === '/api/discover/cards');
  const text = (selector: string) => el.querySelector(selector)?.textContent ?? '';
  const tabLabels = () => Array.from(el.querySelectorAll('[role="tab"]')).map((t) => (t.textContent ?? '').trim());

  async function showCardsTab(): Promise<void> {
    component.tab.set(1);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('au départ : tous les albums visibles, pas de recherche de cartes (il faut un critère)', async () => {
    const req = albumsRequest();
    expect(req.request.params.keys().sort()).toEqual(['limit', 'page']);
    req.flush(pageOf([album('a1', 'Mes Psy'), album('a2', 'Feu')], 2));
    fixture.detectChanges();

    expect(el.querySelectorAll('.albums app-album-cover').length).toBe(2);
    expect(tabLabels()).toEqual(['Albums (2)', 'Cartes']);
    httpMock.expectNone((r) => r.url === '/api/discover/cards');
    await showCardsTab();
    expect(text('.cards-hint')).toContain('Tape le nom d’une carte');
  });

  it('saisie : rien pour 1 caractère, puis une seule recherche (albums et cartes) après 300 ms de pause', () => {
    albumsRequest().flush(pageOf([]));
    vi.useFakeTimers();

    component.form.controls.q.setValue('m');
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    httpMock.expectNone((r) => r.url.startsWith('/api/discover/'));
    expect(text('.too-short')).toContain('2 caractères minimum');

    component.form.controls.q.setValue('me');
    component.form.controls.q.setValue('mew ');
    vi.advanceTimersByTime(299);
    httpMock.expectNone((r) => r.url.startsWith('/api/discover/'));
    vi.advanceTimersByTime(1);

    const albums = albumsRequest();
    const cards = cardsRequest();
    expect([albums.request.params.get('q'), cards.request.params.get('q')]).toEqual(['mew', 'mew']);
    albums.flush(pageOf([album('a1', 'Mes Psy')]));
    cards.flush(pageOf([card('c1', 'Mewtwo'), card('c2', 'Mew')], 2));
    fixture.detectChanges();

    expect(tabLabels()).toEqual(['Albums (1)', 'Cartes (2)']);
  });

  it('filtres : type et catégorie transmis ; la catégorie ne part qu’avec les cartes', () => {
    albumsRequest().flush(pageOf([]));
    vi.useFakeTimers();

    component.form.patchValue({ type: 'Psy', category: 'Pokémon' });
    vi.advanceTimersByTime(300);

    const albums = albumsRequest();
    const cards = cardsRequest();
    expect([albums.request.params.get('type'), albums.request.params.get('category')]).toEqual(['Psy', null]);
    expect([cards.request.params.get('type'), cards.request.params.get('category')]).toEqual(['Psy', 'Pokémon']);
    albums.flush(pageOf([]));
    cards.flush(pageOf([]));
  });

  it('série : charge ses extensions et active le choix ; changer de série vide l’extension', () => {
    albumsRequest().flush(pageOf([]));
    const { serieId, setId } = component.form.controls;
    expect(setId.disabled).toBe(true);

    serieId.setValue('sv');
    httpMock.expectOne('/api/catalog/series/sv/sets').flush([{ id: 'sv03.5', name: '151', logo: null, cardCount: 165 }]);
    expect(setId.enabled).toBe(true);
    expect(component.sets().map((s) => s.name)).toEqual(['151']);
    setId.setValue('sv03.5');

    serieId.setValue('');
    expect([setId.value, setId.disabled]).toEqual(['', true]);
    // Recherches déclenchées par ces changements (debounce non simulé ici).
    httpMock.match((r) => r.url.startsWith('/api/discover/'));
  });

  it('cartes : résultats en tuiles, pagination de l’onglet', async () => {
    albumsRequest().flush(pageOf([]));
    component.search({ q: 'mew', type: '', serieId: '', setId: '', category: '' });
    albumsRequest().flush(pageOf([]));
    cardsRequest().flush(pageOf(Array.from({ length: 12 }, (_, i) => card(`c${i}`, `Mew ${i}`)), 30));
    await showCardsTab();

    expect(el.querySelectorAll('.cards app-card-tile').length).toBe(12);
    expect(el.querySelector('.cards app-card-tile a')?.getAttribute('href')).toBe('/albums/a1');
    component.onCardsPage({ pageIndex: 2, pageSize: 12, length: 30 });
    const req = cardsRequest();
    expect(req.request.params.get('page')).toBe('3');
    req.flush(pageOf([], 30, 3));
  });

  it('une nouvelle recherche annule la précédente', () => {
    albumsRequest().flush(pageOf([]));
    component.search({ q: 'mew', type: '', serieId: '', setId: '', category: '' });
    const first = httpMock.match((r) => r.url.startsWith('/api/discover/'));
    component.search({ q: 'dracau', type: '', serieId: '', setId: '', category: '' });

    expect(first.every((req) => req.cancelled)).toBe(true);
    const albums = albumsRequest();
    expect(albums.request.params.get('q')).toBe('dracau');
    albums.flush(pageOf([]));
    cardsRequest().flush(pageOf([]));
  });

  it('changer de page pendant une recherche de cartes : la requête précédente est annulée', () => {
    albumsRequest().flush(pageOf([]));
    component.search({ q: 'mew', type: '', serieId: '', setId: '', category: '' });
    albumsRequest().flush(pageOf([]));
    cardsRequest().flush(pageOf([], 40));

    component.onCardsPage({ pageIndex: 1, pageSize: 12, length: 40 });
    const page2 = cardsRequest();
    component.onCardsPage({ pageIndex: 2, pageSize: 12, length: 40 });

    expect(page2.cancelled).toBe(true);
    const page3 = cardsRequest();
    expect(page3.request.params.get('page')).toBe('3');
    page3.flush(pageOf([], 40, 3));
  });

  it('un seul caractère juste après une recherche : la réponse en retard n’est pas affichée', () => {
    albumsRequest().flush(pageOf([]));
    component.search({ q: 'mew', type: '', serieId: '', setId: '', category: '' });
    const pending = httpMock.match((r) => r.url.startsWith('/api/discover/'));
    component.search({ q: 'm', type: '', serieId: '', setId: '', category: '' });

    expect(pending.every((req) => req.cancelled)).toBe(true);
    expect(component.albums.items()).toEqual([]);
  });

  it('nouvelle recherche après une pagination : retour à la page 1', () => {
    albumsRequest().flush(pageOf([]));
    component.search({ q: 'mew', type: '', serieId: '', setId: '', category: '' });
    albumsRequest().flush(pageOf([], 40));
    cardsRequest().flush(pageOf([], 40));
    component.onAlbumsPage({ pageIndex: 2, pageSize: 12, length: 40 });
    albumsRequest().flush(pageOf([], 40, 3));

    component.search({ q: 'dracau', type: '', serieId: '', setId: '', category: '' });
    const albums = albumsRequest();
    const cards = cardsRequest();
    expect([albums.request.params.get('page'), cards.request.params.get('page')]).toEqual(['1', '1']);
    albums.flush(pageOf([]));
    cards.flush(pageOf([]));
  });

  it('aucun résultat ou erreur : message dans l’onglet concerné', () => {
    albumsRequest().flush(pageOf([]));
    component.search({ q: 'zz', type: '', serieId: '', setId: '', category: '' });
    albumsRequest().flush({ message: 'Critère de recherche invalide' }, { status: 400, statusText: 'Bad Request' });
    cardsRequest().flush(pageOf([]));
    fixture.detectChanges();

    expect(text('.albums-error')).toContain('Critère de recherche invalide');
    expect(component.cards.loaded()).toBe(true);
    expect(component.cards.total()).toBe(0);
  });

  it('« Effacer » : critères vidés, retour à tous les albums', () => {
    albumsRequest().flush(pageOf([]));
    vi.useFakeTimers();
    component.form.controls.q.setValue('psy');
    vi.advanceTimersByTime(300);
    albumsRequest().flush(pageOf([]));
    cardsRequest().flush(pageOf([]));
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('button.clear')!.click();
    vi.advanceTimersByTime(300);
    expect(albumsRequest().request.params.has('q')).toBe(false);
    httpMock.expectNone((r) => r.url === '/api/discover/cards');
    expect(component.form.controls.q.value).toBe('');
  });
});
