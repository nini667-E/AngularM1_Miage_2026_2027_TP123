import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AlbumDetail } from '../../shared/models/album.model';
import { AlbumCard } from '../../shared/models/card.model';
import { AuthService } from '../../shared/services/auth.service';
import { AlbumPageComponent } from './album-page';

const ALBUM: AlbumDetail = {
  id: 'a1',
  ownerId: 'owner',
  owner: { id: 'owner', name: 'Sacha' },
  title: 'Mes Dracaufeu',
  description: 'Les plus beaux',
  visibility: 'public',
  theme: { type: 'Feu', serie: null, set: null },
  cardCount: 3,
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01',
};

const card = (id: string, name: string, fields: Partial<AlbumCard> = {}): AlbumCard => ({
  id,
  albumId: 'a1',
  tcgdexId: 'sv03.5-006',
  name,
  localId: '006',
  category: 'Pokémon',
  subCategory: null,
  types: ['Feu'],
  rarity: 'Rare',
  set: { id: 'sv03.5', name: '151' },
  serie: { id: 'sv', name: 'Écarlate et Violet' },
  officialImage: { small: null, large: null },
  photo: { thumb: `/api/images/${id}/thumb?exp=1&sig=x`, full: `/api/images/${id}/full?exp=1&sig=x` },
  createdAt: '2026-11-01',
  ...fields,
});

describe('AlbumPageComponent', () => {
  let fixture: ComponentFixture<AlbumPageComponent>;
  let component: AlbumPageComponent;
  let httpMock: HttpTestingController;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AlbumPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'a1' })) } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AlbumPageComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  const text = (selector: string) => el.querySelector(selector)?.textContent ?? '';
  const cardsRequest = (): TestRequest => httpMock.expectOne((r) => r.url === '/api/albums/a1/cards');
  const flushCards = (items: AlbumCard[], total = items.length) =>
    cardsRequest().flush({ items, page: 1, limit: 9, total, pages: Math.max(1, Math.ceil(total / 9)) });

  /** Album affiché pour un utilisateur donné, avec une première page de cartes. */
  function showAlbum(currentUserId: string, cards: AlbumCard[] = [], album = ALBUM): void {
    TestBed.inject(AuthService).currentUser.set({ id: currentUserId, name: 'X', email: 'x@x', createdAt: '' });
    httpMock.expectOne('/api/albums/a1').flush(album);
    flushCards(cards, Math.max(cards.length, 0));
    fixture.detectChanges();
  }

  // ------------------------------------------------------------- en-tête

  it('affiche titre, propriétaire, visibilité et description', () => {
    showAlbum('someone-else');

    expect(text('h1')).toContain('Mes Dracaufeu');
    expect(text('.eyebrow')).toContain('Album public');
    expect(text('.eyebrow')).toContain('par Sacha');
    expect(text('.description')).toContain('Les plus beaux');
  });

  it('visiteur : ni Modifier, ni Supprimer, ni « Ajouter une carte »', () => {
    showAlbum('someone-else');

    expect(el.querySelector('.actions')).toBeNull();
    expect(text('.binder-toolbar')).not.toContain('Ajouter une carte');
    expect(text('.binder-note')).toContain('Ce classeur est encore vide');
  });

  it('propriétaire : Modifier, Supprimer et « Ajouter une carte »', () => {
    showAlbum('owner');

    expect(text('.actions')).toContain('Modifier');
    expect(el.querySelector('.actions button[aria-label="Supprimer l\'album"]')).not.toBeNull();
    expect(text('.binder-toolbar')).toContain('Ajouter une carte');
    expect(text('.binder-note')).toContain('ajoute ta première carte');
  });

  it('404 (inexistant ou privé d’un autre) : « Album introuvable », aucune carte demandée', () => {
    httpMock.expectOne('/api/albums/a1').flush({ message: 'Album inconnu' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(text('.message h1')).toContain('Album introuvable');
    expect(el.querySelector('.banner')).toBeNull();
    httpMock.expectNone((r) => r.url === '/api/albums/a1/cards');
  });

  // ------------------------------------------------------------ classeur

  it('classeur : une pochette par carte (photo signée), les autres vides, 9 au total', () => {
    showAlbum('owner', [card('c1', 'Dracaufeu-ex'), card('c2', 'Salamèche'), card('c3', 'Reptincel')]);

    const cards = el.querySelectorAll<HTMLButtonElement>('.pocket.card');
    expect(cards.length).toBe(3);
    expect(el.querySelectorAll('.pocket.empty').length).toBe(6);
    expect(cards[0].querySelector('img')?.getAttribute('src')).toBe('/api/images/c1/thumb?exp=1&sig=x');
    expect(cards[0].getAttribute('aria-label')).toBe('Voir Dracaufeu-ex');
    expect(el.querySelector('mat-paginator')).toBeNull();
  });

  it('chargement : 9 emplacements fantômes', () => {
    TestBed.inject(AuthService).currentUser.set({ id: 'owner', name: 'X', email: 'x@x', createdAt: '' });
    httpMock.expectOne('/api/albums/a1').flush(ALBUM);
    fixture.detectChanges();

    expect(el.querySelectorAll('.pocket.skeleton').length).toBe(9);
    flushCards([]);
  });

  it('filtre par catégorie : demande filtrée, retour à la page 1', () => {
    showAlbum('owner', [card('c1', 'A')]);
    component.page.set(2);

    component.onCategory('Dresseur');
    const req = cardsRequest();
    expect(req.request.params.get('category')).toBe('Dresseur');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ items: [], page: 1, limit: 9, total: 0, pages: 1 });
    fixture.detectChanges();

    expect(text('.binder-note')).toContain('Aucune carte de cette catégorie');
  });

  it('pagination : affichée au-delà de 9 cartes, page suivante demandée', () => {
    showAlbum('owner', Array.from({ length: 9 }, (_, i) => card(`c${i}`, `Carte ${i}`)));
    component.total.set(12);
    fixture.detectChanges();
    expect(el.querySelector('mat-paginator')).not.toBeNull();

    component.onPage({ pageIndex: 1, pageSize: 9, length: 12 });
    expect(cardsRequest().request.params.get('page')).toBe('2');
  });

  it('photo expirée : nouvelles URL demandées une seule fois', () => {
    showAlbum('owner', [card('c1', 'A')]);

    component.onImageError();
    component.onImageError();

    cardsRequest().flush({ items: [card('c1', 'A')], page: 1, limit: 9, total: 1, pages: 1 });
    httpMock.expectNone((r) => r.url === '/api/albums/a1/cards');
  });

  // ------------------------------------------------- ajout et retrait

  it('carte ajoutée : SnackBar, compteur +1, page contenant la nouvelle carte', () => {
    showAlbum('owner', [], { ...ALBUM, cardCount: 9 });
    vi.spyOn(component['dialog'], 'open').mockReturnValue({ afterClosed: () => of(card('c10', 'Nouvelle')) } as never);
    const snack = vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);

    component.addCard();

    expect(snack).toHaveBeenCalledWith('« Nouvelle » ajoutée au classeur.', 'OK', expect.objectContaining({ panelClass: 'snack-success' }));
    expect(component.album()?.cardCount).toBe(10);
    // 10e carte : page 2 du classeur.
    const req = cardsRequest();
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('category')).toBe(false);
    req.flush({ items: [card('c10', 'Nouvelle')], page: 2, limit: 9, total: 10, pages: 2 });
  });

  it('retrait depuis le zoom : confirmation, DELETE de la carte, compteur -1, rechargement', () => {
    showAlbum('owner', [card('c1', 'Dracaufeu-ex')]);
    vi.spyOn(component['dialog'], 'open')
      .mockReturnValueOnce({ afterClosed: () => of('delete') } as never) // zoom
      .mockReturnValueOnce({ afterClosed: () => of(true) } as never); // confirmation
    vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);

    component.openCard(component.cards()[0]);
    const del = httpMock.expectOne('/api/cards/c1');
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });

    expect(component.album()?.cardCount).toBe(2);
    flushCards([]);
  });

  it('zoom fermé sans demande de retrait : aucune requête', () => {
    showAlbum('owner', [card('c1', 'Dracaufeu-ex')]);
    vi.spyOn(component['dialog'], 'open').mockReturnValue({ afterClosed: () => of(undefined) } as never);

    component.openCard(component.cards()[0]);

    httpMock.expectNone('/api/cards/c1');
  });

  // ------------------------------------------------------ album (étape 2)

  it('suppression de l’album confirmée : DELETE, SnackBar, retour à « Mes albums »', () => {
    showAlbum('owner');
    vi.spyOn(component['dialog'], 'open').mockReturnValue({ afterClosed: () => of(true) } as never);
    const snack = vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    component.confirmDelete();
    const req = httpMock.expectOne('/api/albums/a1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(snack).toHaveBeenCalledWith('Album « Mes Dracaufeu » supprimé.', 'OK', expect.objectContaining({ panelClass: 'snack-success' }));
    expect(navigate).toHaveBeenCalledWith('/albums');
  });

  it('suppression de l’album annulée : aucune requête', () => {
    showAlbum('owner');
    vi.spyOn(component['dialog'], 'open').mockReturnValue({ afterClosed: () => of(false) } as never);

    component.confirmDelete();

    httpMock.expectNone('/api/albums/a1');
  });

  it('modification enregistrée : la page se met à jour sans rechargement', () => {
    showAlbum('owner');
    vi.spyOn(component['dialog'], 'open').mockReturnValue({
      afterClosed: () => of({ ...ALBUM, title: 'Nouveau titre', visibility: 'private' }),
    } as never);
    vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);

    component.edit();
    fixture.detectChanges();

    expect(text('h1')).toContain('Nouveau titre');
    expect(text('.eyebrow')).toContain('Album privé');
    expect(text('.eyebrow')).toContain('par Sacha');
  });
});
