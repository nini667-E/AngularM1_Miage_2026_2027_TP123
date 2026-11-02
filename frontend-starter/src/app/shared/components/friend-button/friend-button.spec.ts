import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Relation } from '../../models/friend.model';
import { AuthService } from '../../services/auth.service';
import { FriendButtonComponent } from './friend-button';

describe('FriendButtonComponent', () => {
  let fixture: ComponentFixture<FriendButtonComponent>;
  let httpMock: HttpTestingController;
  let el: HTMLElement;
  let snack: ReturnType<typeof vi.spyOn>;
  let changed: Relation[];

  function render(relation: Relation): void {
    fixture = TestBed.createComponent(FriendButtonComponent);
    fixture.componentRef.setInput('userId', 'u2');
    fixture.componentRef.setInput('userName', 'Ondine');
    fixture.componentRef.setInput('relation', relation);
    snack = vi.spyOn(fixture.componentInstance['snackBar'], 'open').mockReturnValue(undefined as never);
    changed = [];
    fixture.componentInstance.changed.subscribe((value) => changed.push(value));
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FriendButtonComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).token.set('jwt-de-test');
  });

  afterEach(() => httpMock.verify());

  const button = () => el.querySelector<HTMLButtonElement>('button');

  it('aucun lien : « Inviter » envoie l’invitation, puis « Invitation envoyée »', () => {
    render('none');
    expect(button()?.textContent ?? '').toContain('Inviter');

    button()!.click();
    const req = httpMock.expectOne('/api/friends/requests');
    expect(req.request.body).toEqual({ userId: 'u2' });
    req.flush({ user: { id: 'u2', name: 'Ondine' }, relation: 'sent' });
    fixture.detectChanges();

    expect(el.textContent ?? '').toContain('Invitation envoyée');
    expect(button()).toBeNull();
    expect(snack).toHaveBeenCalledWith('Invitation envoyée à Ondine.', 'OK', expect.objectContaining({ panelClass: 'snack-success' }));
    expect(changed).toEqual(['sent']);
    // Pas d'invitation reçue en jeu : badge inchangé, aucune requête.
    httpMock.expectNone('/api/friends/requests');
  });

  it('invitations croisées : l’invitation devient une amitié, le badge est rechargé', () => {
    render('none');
    button()!.click();
    httpMock.expectOne('/api/friends/requests').flush({ user: { id: 'u2', name: 'Ondine' }, relation: 'friend' });
    httpMock.expectOne((r) => r.method === 'GET' && r.url === '/api/friends/requests').flush({ received: [], sent: [] });
    fixture.detectChanges();

    expect(el.textContent ?? '').toContain('Ami');
    expect(snack).toHaveBeenCalledWith('Ondine et toi êtes maintenant amis.', 'OK', expect.anything());
    expect(changed).toEqual(['friend']);
  });

  it('invitation reçue : « Accepter » appelle la route d’acceptation', () => {
    render('received');
    expect(button()?.textContent ?? '').toContain('Accepter');

    button()!.click();
    httpMock.expectOne('/api/friends/requests/u2/accept').flush({ user: { id: 'u2', name: 'Ondine' }, relation: 'friend' });
    httpMock.expectOne('/api/friends/requests').flush({ received: [], sent: [] });
    fixture.detectChanges();

    expect(el.textContent ?? '').toContain('Ami');
    expect(button()).toBeNull();
  });

  it('erreur (409) : message du serveur, relation inchangée, bouton réactivé', () => {
    render('none');
    button()!.click();
    fixture.detectChanges();
    expect(button()?.disabled).toBe(true);

    httpMock.expectOne('/api/friends/requests').flush({ message: 'Invitation déjà envoyée' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(snack).toHaveBeenCalledWith('Invitation déjà envoyée', 'OK', expect.objectContaining({ panelClass: 'snack-error' }));
    expect(button()?.textContent ?? '').toContain('Inviter');
    expect(button()?.disabled).toBe(false);
    expect(changed).toEqual([]);
  });

  it('double clic : une seule requête', () => {
    render('none');
    fixture.componentInstance.invite();
    fixture.componentInstance.invite();
    httpMock.expectOne('/api/friends/requests').flush({ user: { id: 'u2', name: 'Ondine' }, relation: 'sent' });
  });

  it('déjà amis, invitation envoyée, soi-même : aucun bouton', () => {
    render('friend');
    expect(button()).toBeNull();
    expect(el.textContent ?? '').toContain('Ami');

    fixture.componentRef.setInput('relation', 'sent');
    fixture.detectChanges();
    expect(button()).toBeNull();
    expect(el.textContent ?? '').toContain('Invitation envoyée');

    fixture.componentRef.setInput('relation', 'self');
    fixture.detectChanges();
    expect((el.textContent ?? '').trim()).toBe('');
  });
});
