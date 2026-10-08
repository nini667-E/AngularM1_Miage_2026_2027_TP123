import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("login() appelle POST /api/auth/login avec exactement { email, password }", () => {
    service.login('demo@example.com', 'Demo1234!').subscribe();

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'demo@example.com', password: 'Demo1234!' });

    req.flush({
      token: 'fake-jwt',
      user: { id: '1', name: 'Demo', email: 'demo@example.com', createdAt: '2026-01-01' },
    });
  });

  it('login() met à jour les Signals token/currentUser après une réponse réussie', () => {
    service.login('demo@example.com', 'Demo1234!').subscribe();

    httpMock.expectOne('/api/auth/login').flush({
      token: 'fake-jwt',
      user: { id: '1', name: 'Demo', email: 'demo@example.com', createdAt: '2026-01-01' },
    });

    expect(service.token()).toBe('fake-jwt');
    expect(service.currentUser()?.name).toBe('Demo');
    expect(localStorage.getItem('gpc_token')).toBe('fake-jwt');
  });
});
