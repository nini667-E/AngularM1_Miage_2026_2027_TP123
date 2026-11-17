import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

describe('UserService et AuthService.update (profils, étape 8)', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('profil et albums d’un collectionneur : bonnes URL, identifiant encodé, page', () => {
    const service = TestBed.inject(UserService);
    service.profile('a/b').subscribe();
    service.albums('u2', 3).subscribe();

    expect(httpMock.expectOne('/api/users/a%2Fb').request.method).toBe('GET');
    const albums = httpMock.expectOne((r) => r.url === '/api/users/u2/albums');
    expect([albums.request.params.get('page'), albums.request.params.get('limit')]).toEqual(['3', '12']);
  });

  it('mon profil : PUT avec les seuls champs fournis, utilisateur courant mis à jour', () => {
    const auth = TestBed.inject(AuthService);
    auth.update({ bio: 'Fan de Psy', avatarId: null }).subscribe();

    const req = httpMock.expectOne('/api/users/me');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ bio: 'Fan de Psy', avatarId: null });
    req.flush({ id: 'me', name: 'Sacha', email: 'x@x', bio: 'Fan de Psy', avatar: null, createdAt: '' });
    expect(auth.currentUser()?.bio).toBe('Fan de Psy');
  });
});
