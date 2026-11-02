import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AppComponent } from './app';
import { AuthService } from '../../shared/services/auth.service';

// Barre de navigation de Card Vault (V2, étape 1).
describe('AppComponent (barre du haut)', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('visiteur : propose Connexion / Inscription, sans navigation ni appel au profil', () => {
    const el = render();

    const labels = Array.from(el.querySelectorAll('.topbar a')).map((a) => a.textContent?.trim());
    expect(labels).toContain('Connexion');
    expect(labels).toContain('Inscription');
    expect(el.querySelector('nav.links')).toBeNull();
    httpMock.expectNone('/api/users/me');
  });

  it('connecté : recharge le profil et affiche Accueil, Mes albums, Recherche, Amis et l’avatar', () => {
    localStorage.setItem('gpc_token', 'jwt-de-test');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    httpMock
      .expectOne('/api/users/me')
      .flush({ id: 'u1', name: 'sacha', email: 'sacha@example.com', createdAt: '2026-11-01' });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    const links = Array.from(el.querySelectorAll('nav.links a')).map((a) => a.textContent?.trim());
    expect(links).toEqual([
      expect.stringContaining('Accueil'),
      expect.stringContaining('Mes albums'),
      expect.stringContaining('Recherche'),
      expect.stringContaining('Amis'),
    ]);
    // Initiale en majuscule, même si le pseudo est en minuscules.
    expect(el.querySelector('.avatar')?.textContent?.trim()).toBe('S');
  });

  it('badge d’invitations : rechargé à chaque page, affiché sur « Amis » seulement s’il y en a', async () => {
    localStorage.setItem('gpc_token', 'jwt-de-test');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    httpMock
      .expectOne('/api/users/me')
      .flush({ id: 'u1', name: 'Sacha', email: 'sacha@example.com', createdAt: '2026-11-01' });
    const router = TestBed.inject(Router);
    const el = fixture.nativeElement as HTMLElement;
    const friendsLink = () =>
      Array.from(el.querySelectorAll('nav.links a')).find((a) => (a.textContent ?? '').includes('Amis'))!;

    await router.navigateByUrl('/');
    httpMock.expectOne('/api/friends/requests').flush({
      received: [{ user: { id: 'u2', name: 'A' }, createdAt: '' }, { user: { id: 'u3', name: 'B' }, createdAt: '' }],
      sent: [],
    });
    fixture.detectChanges();

    const badges = Array.from(el.querySelectorAll('nav.links mat-icon:not(.mat-badge-hidden)'));
    expect(badges.length).toBe(1);
    expect(friendsLink().querySelector('.mat-badge-content')?.textContent ?? '').toBe('2');
    expect(friendsLink().querySelector('.cv-visually-hidden')?.textContent ?? '').toContain('2 invitations reçues');

    // Page suivante : nouvelle lecture ; plus d'invitation -> badge masqué.
    await router.navigateByUrl('/?page=2');
    httpMock.expectOne('/api/friends/requests').flush({ received: [], sent: [] });
    fixture.detectChanges();
    expect(el.querySelectorAll('nav.links mat-icon:not(.mat-badge-hidden)').length).toBe(0);
    expect(friendsLink().querySelector('.cv-visually-hidden')).toBeNull();
  });

  it('Déconnexion (menu profil) : vide la session et redirige vers /login', async () => {
    localStorage.setItem('gpc_token', 'jwt-de-test');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    httpMock
      .expectOne('/api/users/me')
      .flush({ id: 'u1', name: 'Sacha', email: 'sacha@example.com', createdAt: '2026-11-01' });
    fixture.detectChanges();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    // Ouvre le menu profil (rendu dans un overlay, hors du composant) puis
    // clique sur « Déconnexion », comme le ferait l'utilisateur.
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.avatar-button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const logout = Array.from(document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item')).find(
      (item) => item.textContent?.includes('Déconnexion'),
    );
    expect(logout).toBeDefined();
    logout!.click();

    const auth = TestBed.inject(AuthService);
    expect(auth.token()).toBeNull();
    expect(auth.currentUser()).toBeNull();
    expect(localStorage.getItem('gpc_token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
