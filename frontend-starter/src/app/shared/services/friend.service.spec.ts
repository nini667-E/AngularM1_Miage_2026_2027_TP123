import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { FriendService } from './friend.service';

const request = (id: string, name: string) => ({ user: { id, name }, createdAt: '2026-11-02' });

describe('FriendService', () => {
  let service: FriendService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FriendService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('search() : GET /api/users/search avec q', () => {
    service.search('sa cha').subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/users/search');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('sa cha');
    req.flush([]);
  });

  it('requests() : met à jour le nombre d’invitations reçues (badge)', () => {
    service.requests().subscribe();
    httpMock.expectOne('/api/friends/requests').flush({ received: [request('u1', 'A'), request('u2', 'B')], sent: [request('u3', 'C')] });
    expect(service.receivedCount()).toBe(2);
  });

  it('refreshCount() : sans session, 0 et aucune requête ; connecté, une requête', () => {
    service.receivedCount.set(5);
    service.refreshCount();
    httpMock.expectNone('/api/friends/requests');
    expect(service.receivedCount()).toBe(0);

    TestBed.inject(AuthService).token.set('jwt-de-test');
    service.refreshCount();
    httpMock.expectOne('/api/friends/requests').flush({ received: [request('u1', 'A')], sent: [] });
    expect(service.receivedCount()).toBe(1);
  });

  it('refreshCount() : une erreur ne casse rien (badge inchangé)', () => {
    TestBed.inject(AuthService).token.set('jwt-de-test');
    service.receivedCount.set(3);
    service.refreshCount();
    httpMock.expectOne('/api/friends/requests').flush({ message: 'x' }, { status: 500, statusText: 'Error' });
    expect(service.receivedCount()).toBe(3);
  });

  it('invite / accept / deleteRequest / remove : bonnes méthodes et URL, identifiant encodé', () => {
    service.friends().subscribe();
    service.invite('u1').subscribe();
    service.accept('a/b').subscribe();
    service.deleteRequest('u2').subscribe();
    service.remove('u3').subscribe();

    expect(httpMock.expectOne('/api/friends').request.method).toBe('GET');
    const invite = httpMock.expectOne('/api/friends/requests');
    expect(invite.request.method).toBe('POST');
    expect(invite.request.body).toEqual({ userId: 'u1' });
    expect(httpMock.expectOne('/api/friends/requests/a%2Fb/accept').request.method).toBe('POST');
    expect(httpMock.expectOne('/api/friends/requests/u2').request.method).toBe('DELETE');
    expect(httpMock.expectOne('/api/friends/u3').request.method).toBe('DELETE');
  });
});
