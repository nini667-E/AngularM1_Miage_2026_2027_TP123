import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('ajoute Authorization: Bearer <token> quand un token existe', () => {
    auth.token.set('mon-jwt');

    http.get('/api/tracks').subscribe();

    const req = httpMock.expectOne('/api/tracks');
    expect(req.request.headers.get('Authorization')).toBe('Bearer mon-jwt');
    req.flush({});
  });

  it("n'ajoute aucun header Authorization en l'absence de token", () => {
    // token() vaut déjà null par défaut ici (localStorage vidé dans beforeEach).
    http.post('/api/auth/login', { email: 'a@b.c', password: 'x' }).subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ message: 'Identifiants invalides' }, { status: 401, statusText: 'Unauthorized' });
  });
});
