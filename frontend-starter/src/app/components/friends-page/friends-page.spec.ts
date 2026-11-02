import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { Friend, FriendRequest, FriendRequests } from '../../shared/models/friend.model';
import { FriendsPageComponent } from './friends-page';

const friend = (id: string, name: string): Friend => ({ user: { id, name }, since: '2026-11-02' });
const request = (id: string, name: string): FriendRequest => ({ user: { id, name }, createdAt: '2026-11-01' });

describe('FriendsPageComponent (Amis)', () => {
  let fixture: ComponentFixture<FriendsPageComponent>;
  let component: FriendsPageComponent;
  let httpMock: HttpTestingController;
  let el: HTMLElement;
  let snack: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FriendsPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FriendsPageComponent);
    component = fixture.componentInstance;
    snack = vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    httpMock.verify();
  });

  const text = (selector: string) => el.querySelector(selector)?.textContent ?? '';
  const names = (selector: string) =>
    Array.from(el.querySelectorAll(`${selector} .name`)).map((n) => (n.firstChild?.textContent ?? '').trim());

  /** Répond au chargement des listes (amis + invitations). */
  function flushLists(friends: Friend[] = [], requests: FriendRequests = { received: [], sent: [] }): void {
    httpMock.expectOne('/api/friends').flush(friends);
    httpMock.expectOne((r) => r.method === 'GET' && r.url === '/api/friends/requests').flush(requests);
    fixture.detectChanges();
  }

  async function showTab(index: number): Promise<void> {
    component.tab.set(index);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // ------------------------------------------------------------- listes

  it('affiche mes amis et le nombre d’éléments de chaque onglet', () => {
    flushLists([friend('u2', 'Ondine'), friend('u3', 'Pierre')], {
      received: [request('u4', 'Flora')],
      sent: [request('u5', 'Régis'), request('u6', 'Iris')],
    });

    expect(names('.friends')).toEqual(['Ondine', 'Pierre']);
    const labels = Array.from(el.querySelectorAll('[role="tab"]')).map((t) => (t.textContent ?? '').trim());
    expect(labels).toEqual(['Amis (2)', 'Reçues (1)', 'Envoyées (2)']);
  });

  it('aucun ami : message d’invitation à chercher un collectionneur', () => {
    flushLists();
    expect(text('.empty')).toContain('Pas encore d’amis');
  });

  it('erreur de chargement : message, pas d’état vide trompeur', () => {
    httpMock.expectOne('/api/friends').error(new ProgressEvent('error'));
    httpMock.expectOne('/api/friends/requests');
    fixture.detectChanges();

    expect(text('.lists-error')).toContain('Impossible de charger tes amis');
    expect(el.querySelector('.empty')).toBeNull();
  });

  // ---------------------------------------------------------- recherche

  it('recherche : rien sous 2 caractères, une seule requête après 300 ms de pause', () => {
    flushLists();
    vi.useFakeTimers();

    component.query.setValue(' o ');
    vi.advanceTimersByTime(300);
    httpMock.expectNone((r) => r.url === '/api/users/search');

    component.query.setValue('on');
    component.query.setValue('ond');
    vi.advanceTimersByTime(299);
    httpMock.expectNone((r) => r.url === '/api/users/search');
    vi.advanceTimersByTime(1);
    const req = httpMock.expectOne((r) => r.url === '/api/users/search');
    expect(req.request.params.get('q')).toBe('ond');
    req.flush([{ id: 'u2', name: 'Ondine', relation: 'none' }]);
    fixture.detectChanges();

    expect(names('.results')).toEqual(['Ondine']);
    expect(text('.results app-friend-button')).toContain('Inviter');
  });

  it('recherche : la relation affichée suit les listes (ex. invitation reçue -> « Accepter »)', () => {
    flushLists([friend('u3', 'Pierre')], { received: [request('u2', 'Ondine')], sent: [] });
    vi.useFakeTimers();
    component.query.setValue('on');
    vi.advanceTimersByTime(300);
    httpMock.expectOne((r) => r.url === '/api/users/search').flush([
      { id: 'u2', name: 'Ondine', relation: 'none' },
      { id: 'u3', name: 'Pierre', relation: 'none' },
    ]);
    fixture.detectChanges();

    const buttons = Array.from(el.querySelectorAll('.results app-friend-button')).map((b) => b.textContent ?? '');
    expect(buttons[0]).toContain('Accepter');
    expect(buttons[1]).toContain('Ami');
  });

  it('recherche : aucun résultat, ou erreur du serveur', () => {
    flushLists();
    vi.useFakeTimers();
    component.query.setValue('zz');
    vi.advanceTimersByTime(300);
    httpMock.expectOne((r) => r.url === '/api/users/search').flush([]);
    fixture.detectChanges();
    expect(text('.no-result')).toContain('Aucun collectionneur ne correspond à « zz »');

    component.query.setValue('zzz');
    vi.advanceTimersByTime(300);
    httpMock
      .expectOne((r) => r.url === '/api/users/search')
      .flush({ message: 'Tape au moins 2 caractères' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(text('.search-error')).toContain('Tape au moins 2 caractères');
    expect(el.querySelector('.no-result')).toBeNull();
  });

  // ------------------------------------------------------------ actions

  it('invitation reçue : Accepter -> POST, SnackBar, listes rechargées', async () => {
    flushLists([], { received: [request('u4', 'Flora')], sent: [] });
    await showTab(1);

    el.querySelector<HTMLButtonElement>('.received .accept')!.click();
    httpMock.expectOne('/api/friends/requests/u4/accept').flush({ user: { id: 'u4', name: 'Flora' }, relation: 'friend' });
    flushLists([friend('u4', 'Flora')]);

    expect(snack).toHaveBeenCalledWith('Flora et toi êtes maintenant amis.', 'OK', expect.objectContaining({ panelClass: 'snack-success' }));
    expect(component.friends().map((f) => f.user.name)).toEqual(['Flora']);
    expect(component.received()).toEqual([]);
  });

  it('invitation reçue : Refuser -> DELETE de l’invitation', async () => {
    flushLists([], { received: [request('u4', 'Flora')], sent: [] });
    await showTab(1);

    el.querySelector<HTMLButtonElement>('.received .refuse')!.click();
    const req = httpMock.expectOne('/api/friends/requests/u4');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    flushLists();

    expect(snack).toHaveBeenCalledWith('Invitation refusée.', 'OK', expect.anything());
  });

  it('invitation envoyée : Annuler -> DELETE de l’invitation', async () => {
    flushLists([], { received: [], sent: [request('u5', 'Régis')] });
    await showTab(2);

    el.querySelector<HTMLButtonElement>('.sent .cancel')!.click();
    const req = httpMock.expectOne('/api/friends/requests/u5');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    flushLists();

    expect(snack).toHaveBeenCalledWith('Invitation annulée.', 'OK', expect.anything());
  });

  it('retirer un ami : confirmation, puis DELETE ; annulé -> aucune requête', () => {
    flushLists([friend('u2', 'Ondine')]);
    const open = vi
      .spyOn(component['dialog'], 'open')
      .mockReturnValueOnce({ afterClosed: () => of(false) } as never)
      .mockReturnValueOnce({ afterClosed: () => of(true) } as never);

    el.querySelector<HTMLButtonElement>('.friends .remove')!.click();
    httpMock.expectNone('/api/friends/u2');

    el.querySelector<HTMLButtonElement>('.friends .remove')!.click();
    const req = httpMock.expectOne('/api/friends/u2');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    flushLists();

    expect(open).toHaveBeenCalledTimes(2);
    expect(snack).toHaveBeenCalledWith('Ondine a été retiré de tes amis.', 'OK', expect.anything());
  });

  it('action refusée (404) : message du serveur, bouton réactivé, listes rechargées', async () => {
    flushLists([], { received: [request('u4', 'Flora')], sent: [] });
    await showTab(1);

    el.querySelector<HTMLButtonElement>('.received .accept')!.click();
    fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('.received .accept')?.disabled).toBe(true);
    // Second clic pendant l'action : ignoré.
    component.accept(request('u4', 'Flora'));
    httpMock
      .expectOne('/api/friends/requests/u4/accept')
      .flush({ message: 'Invitation inconnue' }, { status: 404, statusText: 'Not Found' });
    flushLists();

    expect(snack).toHaveBeenCalledWith('Invitation inconnue', 'OK', expect.objectContaining({ panelClass: 'snack-error' }));
    expect(component.isBusy('u4')).toBe(false);
  });
});
