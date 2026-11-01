import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginPageComponent } from './login-page';

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let httpMock: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // `?? ''` : si le message n'est pas affiché, on compare une chaîne vide
  // (le test échoue) au lieu de undefined, que toContain laisse passer.
  function errorText(): string {
    return (fixture.nativeElement as HTMLElement).querySelector('.error')?.textContent ?? '';
  }

  function submit(): void {
    (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  it("après une connexion réussie, redirige vers l'accueil /", () => {
    submit();
    httpMock.expectOne('/api/auth/login').flush({
      token: 'jwt',
      user: { id: 'u1', name: 'Demo', email: 'demo@example.com', createdAt: '2026-11-01' },
    });

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('identifiants refusés : affiche le message du backend, sans redirection', () => {
    submit();
    httpMock
      .expectOne('/api/auth/login')
      .flush({ message: 'Identifiants incorrects' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(errorText()).toContain('Identifiants incorrects');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('backend injoignable : message de repli (pas « Failed to fetch »)', () => {
    submit();
    httpMock.expectOne('/api/auth/login').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(errorText()).toContain('Erreur de connexion');
  });
});
