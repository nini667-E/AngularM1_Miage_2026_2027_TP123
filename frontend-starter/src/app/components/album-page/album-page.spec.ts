import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AlbumDetail } from '../../shared/models/album.model';
import { AlbumCard } from '../../shared/models/card.model';
import { ReactionSummary } from '../../shared/models/reaction.model';
import { AuthService } from '../../shared/services/auth.service';
import { AlbumPageComponent } from './album-page';

const ALBUM: AlbumDetail = {
  id: 'a1',
  ownerId: 'owner',
  owner: { id: 'owner', name: 'Sacha', relation: 'self' },
  title: 'Mes Dracaufeu',
  description: 'Les plus beaux',
  visibility: 'public',
  theme: { type: 'Feu', serie: null, set: null },
  cardCount: 3,
  sharedCount: 0,
  likeCount: 0,
  commentCount: 0,
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

  afterEach(() => {
    // Réactions (étape 6) : demandées dès que l'album est affiché ; les tests
    // qui ne passent pas par showAlbum() n'y répondent pas.
    httpMock.match((r) => r.url === '/api/albums/a1/reactions' || r.url === '/api/albums/a1/comments');
    httpMock.verify();
  });

  const text = (selector: string) => el.querySelector(selector)?.textContent ?? '';
  const cardsRequest = (): TestRequest => httpMock.expectOne((r) => r.url === '/api/albums/a1/cards');
  const flushCards = (items: AlbumCard[], total = items.length) =>
    cardsRequest().flush({ items, page: 1, limit: 9, total, pages: Math.max(1, Math.ceil(total / 9)) });

  /** Réactions selon la personne : propriétaire (commente), visiteur non ami (lit seulement). */
  const summaryFor = (owner: boolean, fields: Partial<ReactionSummary> = {}): ReactionSummary => ({
    likeCount: 0,
    likedByMe: false,
    likers: [],
    commentCount: 0,
    canLike: false,
    canComment: false,
    canReply: owner,
    canRemoveLikes: owner,
    ...fields,
  });

  /** Album affiché pour un utilisateur donné, avec une première page de cartes, ses réactions et ses commentaires. */
  function showAlbum(currentUserId: string, cards: AlbumCard[] = [], album = ALBUM, summary?: ReactionSummary): void {
    TestBed.inject(AuthService).currentUser.set({ id: currentUserId, name: 'X', email: 'x@x', createdAt: '' });
    // Comme le backend : relation « self » pour le propriétaire seulement.
    if (currentUserId !== album.ownerId && album.owner.relation === 'self') {
      album = { ...album, owner: { ...album.owner, relation: 'none' } };
    }
    httpMock.expectOne('/api/albums/a1').flush(album);
    flushCards(cards, Math.max(cards.length, 0));
    httpMock.expectOne('/api/albums/a1/reactions').flush(summary ?? summaryFor(currentUserId === album.ownerId));
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === '/api/albums/a1/comments').flush({ items: [], page: 1, limit: 10, total: 0, pages: 1 });
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

    expect(text('.actions')).not.toContain('Modifier');
    expect(el.querySelector(`.actions button[aria-label="Supprimer l'album"]`)).toBeNull();
    expect(text('.binder-toolbar')).not.toContain('Ajouter une carte');
    expect(text('.binder-note')).toContain('Ce classeur est encore vide');
  });

  it('propriétaire : Modifier, Supprimer et « Ajouter une carte », pas de bouton d’amitié', () => {
    showAlbum('owner');

    expect(el.querySelector('app-friend-button')).toBeNull();
    expect(text('.actions')).toContain('Modifier');
    expect(el.querySelector('.actions button[aria-label="Supprimer l\'album"]')).not.toBeNull();
    expect(text('.binder-toolbar')).toContain('Ajouter une carte');
    expect(text('.binder-note')).toContain('ajoute ta première carte');
  });

  it('propriétaire, profil pas encore rechargé (après F5) : pas de bouton d’amitié (relation self)', () => {
    TestBed.inject(AuthService).currentUser.set(null);
    httpMock.expectOne('/api/albums/a1').flush(ALBUM);
    flushCards([]);
    fixture.detectChanges();

    expect(el.querySelector('app-friend-button')).toBeNull();
  });

  it('visiteur : bouton d’amitié selon la relation avec le propriétaire (étape 4)', () => {
    showAlbum('someone-else', [], { ...ALBUM, owner: { ...ALBUM.owner, relation: 'received' } });
    TestBed.inject(AuthService).token.set('jwt-de-test');

    const button = el.querySelector<HTMLButtonElement>('.actions app-friend-button button');
    expect(button?.textContent ?? '').toContain('Accepter');
    button!.click();
    const accept = httpMock.expectOne('/api/friends/requests/owner/accept');
    expect(accept.request.method).toBe('POST');
    accept.flush({ user: { id: 'owner', name: 'Sacha' }, relation: 'friend' });
    // L'invitation acceptée change le badge de la barre du haut.
    httpMock.expectOne('/api/friends/requests').flush({ received: [], sent: [] });
    fixture.detectChanges();

    expect(text('.actions')).toContain('Ami');
    expect(el.querySelector('.actions button')).toBeNull();
  });

  // ------------------------------------------------- partage (étape 5)

  it('propriétaire d’un album privé : « Partager » et nombre d’amis destinataires', () => {
    showAlbum('owner', [], { ...ALBUM, visibility: 'private', sharedCount: 2 });

    expect(el.querySelector('.actions button.share')).not.toBeNull();
    expect(text('.eyebrow')).toContain('Album privé · partagé avec 2 amis');
  });

  it('album public, ou album d’un autre : pas de « Partager »', () => {
    showAlbum('owner');
    expect(el.querySelector('button.share')).toBeNull();
  });

  it('album privé partagé avec moi : « partagé avec toi », ni Partager ni Modifier', () => {
    showAlbum('someone-else', [], { ...ALBUM, visibility: 'private', sharedCount: null });

    expect(text('.eyebrow')).toContain('Album privé · partagé avec toi');
    expect(el.querySelector('button.share')).toBeNull();
    expect(text('.actions')).not.toContain('Modifier');
  });

  it('partage enregistré : nombre mis à jour et SnackBar ; tout décoché : « Partage arrêté »', () => {
    showAlbum('owner', [], { ...ALBUM, visibility: 'private', sharedCount: 1 });
    const open = vi.spyOn(component['dialog'], 'open');
    const snack = vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);

    open.mockReturnValueOnce({ afterClosed: () => of({ ...ALBUM, visibility: 'private', sharedCount: 3 }) } as never);
    el.querySelector<HTMLButtonElement>('button.share')!.click();
    fixture.detectChanges();
    expect(component.album()?.sharedCount).toBe(3);
    expect(text('.eyebrow')).toContain('partagé avec 3 amis');
    expect(snack).toHaveBeenLastCalledWith('Album partagé avec 3 amis.', 'OK', expect.anything());

    open.mockReturnValueOnce({ afterClosed: () => of({ ...ALBUM, visibility: 'private', sharedCount: 0 }) } as never);
    component.share();
    fixture.detectChanges();
    expect(text('.eyebrow')).not.toContain('partagé');
    expect(snack).toHaveBeenLastCalledWith('Partage arrêté : l’album est visible par toi seul.', 'OK', expect.anything());

    // Fenêtre annulée : rien ne change.
    open.mockReturnValueOnce({ afterClosed: () => of(undefined) } as never);
    component.share();
    expect(snack).toHaveBeenCalledTimes(2);
  });

  // ------------------------------------------- réactions (étape 6)

  it('réactions : barre de likes et commentaires affichées ; visiteur non ami en lecture seule', () => {
    showAlbum('someone-else', [], ALBUM, summaryFor(false, { likeCount: 2, likers: [{ id: 'u2', name: 'Ondine' }, { id: 'u3', name: 'Pierre' }] }));

    expect(text('app-like-bar .count')).toContain('2 j’aime');
    expect(el.querySelector('app-like-bar .heart')).toBeNull();
    expect(text('app-like-bar .hint')).toContain('Seuls les amis de Sacha peuvent aimer et commenter');
    expect(el.querySelector('app-album-comments')).not.toBeNull();
    expect(el.querySelector('app-album-comments form')).toBeNull();
  });

  it('réactions : un ami peut aimer (cœur) et commenter (formulaire)', () => {
    showAlbum('someone-else', [], { ...ALBUM, owner: { ...ALBUM.owner, relation: 'friend' } }, summaryFor(false, { canLike: true, canComment: true }));

    expect(el.querySelector('app-like-bar .heart')).not.toBeNull();
    expect(el.querySelector('app-like-bar .hint')).toBeNull();
    expect(el.querySelector('app-album-comments form')).not.toBeNull();
  });

  it('réactions : le propriétaire ne commente pas son album (pas de formulaire), il répondra aux commentaires', () => {
    showAlbum('owner');

    expect(el.querySelector('app-like-bar .heart')).toBeNull();
    expect(el.querySelector('app-like-bar .hint')).toBeNull();
    expect(el.querySelector('app-album-comments form')).toBeNull();
    expect(text('app-album-comments .empty')).toContain('tu pourras leur répondre');
  });

  it('réactions indisponibles : l’album reste affiché, sans barre de likes', () => {
    TestBed.inject(AuthService).currentUser.set({ id: 'owner', name: 'X', email: 'x@x', createdAt: '' });
    httpMock.expectOne('/api/albums/a1').flush(ALBUM);
    flushCards([]);
    httpMock.expectOne('/api/albums/a1/reactions').flush({ message: 'x' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(text('h1')).toContain('Mes Dracaufeu');
    expect(el.querySelector('app-like-bar')).toBeNull();
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

  it('zoom : la photo est « la mienne » dans mon album, celle du propriétaire sinon', () => {
    showAlbum('someone-else', [card('c1', 'Dracaufeu-ex')]);
    const open = vi.spyOn(component['dialog'], 'open').mockReturnValue({ afterClosed: () => of(undefined) } as never);

    component.openCard(component.cards()[0]);
    expect(open.mock.calls[0][1]?.data).toEqual(expect.objectContaining({ canDelete: false, ownerName: 'Sacha' }));

    component.album.set({ ...component.album()!, owner: { ...ALBUM.owner, relation: 'self' } });
    component.openCard(component.cards()[0]);
    expect(open.mock.calls[1][1]?.data).toEqual(expect.objectContaining({ ownerName: null }));
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
