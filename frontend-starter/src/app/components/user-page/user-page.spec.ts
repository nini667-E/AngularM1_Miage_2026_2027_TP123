import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Album } from '../../shared/models/album.model';
import { UserProfile } from '../../shared/models/user.model';
import { UserPageComponent } from './user-page';

const profile = (fields: Partial<UserProfile> = {}): UserProfile => ({
  id: 'u2',
  name: 'Ondine',
  bio: 'Fan de Psy depuis 1999',
  avatar: { tcgdexId: 'sv03.5-150', name: 'Mewtwo', image: '/mewtwo/low.webp' },
  createdAt: '2026-11-01',
  relation: 'friend',
  stats: { albums: 2, cards: 1, likes: 3, friends: 4 },
  ...fields,
});
const album = (id: string, title: string): Album => ({
  id,
  ownerId: 'u2',
  title,
  description: '',
  visibility: 'public',
  theme: { type: null, serie: null, set: null },
  cardCount: 1,
  likeCount: 0,
  commentCount: 0,
  sharedCount: null,
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01',
});

describe('UserPageComponent (profil public)', () => {
  let fixture: ComponentFixture<UserPageComponent>;
  let httpMock: HttpTestingController;
  let el: HTMLElement;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ id: 'u2' }));
    TestBed.configureTestingModule({
      imports: [UserPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UserPageComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  const text = (selector: string) => (el.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function show(p = profile(), albums: Album[] = [album('a1', 'Mes Psy'), album('a2', 'Feu')], total = albums.length): void {
    httpMock.expectOne('/api/users/u2').flush(p);
    httpMock.expectOne((r) => r.url === `/api/users/${p.id}/albums`).flush({ items: albums, page: 1, limit: 12, total, pages: 1 });
    fixture.detectChanges();
  }

  it('en-tête : avatar, pseudo, carte fétiche, bio, chiffres accordés, bouton d’amitié ; titre de l’onglet', () => {
    show(profile({ stats: { albums: 2, cards: 1, likes: 3, friends: 1 } }));

    expect(text('h1')).toBe('Ondine');
    expect(el.querySelector('header app-avatar img')?.getAttribute('src')).toBe('/mewtwo/low.webp');
    expect(text('.favorite')).toContain('Carte fétiche : Mewtwo');
    expect(text('.bio')).toBe('Fan de Psy depuis 1999');
    expect(Array.from(el.querySelectorAll('.stats li')).map((li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim())).toEqual([
      '2 albums',
      '1 carte',
      '3 likes reçus',
      '1 ami',
    ]);
    expect(text('app-friend-button')).toContain('Ami');
    expect(el.querySelector('a.edit')).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Ondine · Card Vault');
  });

  it('ses albums visibles : couvertures, message expliquant ce qu’on voit', () => {
    show();
    expect(el.querySelectorAll('.grid app-album-cover').length).toBe(2);
    expect(text('.albums-section h2')).toBe('Ses albums (2)');
    expect(text('.albums-section .hint')).toContain('ceux que Ondine partage avec toi');
  });

  it('mon propre profil : « Modifier mon profil » au lieu du bouton d’amitié, « Mes albums »', () => {
    show(profile({ relation: 'self', bio: '' }), []);
    expect(el.querySelector('a.edit')?.getAttribute('href')).toBe('/profile');
    expect(el.querySelector('app-friend-button')).toBeNull();
    expect(text('.bio.empty')).toContain('pas encore écrit de présentation');
    expect(text('.albums-section .empty')).toBe('Tu n’as pas encore d’album.');
  });

  it('aucun album visible chez un autre : message', () => {
    show(profile({ relation: 'none' }), []);
    expect(text('.albums-section .empty')).toBe('Ondine n’a pas encore d’album que tu peux voir.');
  });

  it('profil inconnu (404) : « Collectionneur introuvable », pas de demande d’albums', () => {
    httpMock.expectOne('/api/users/u2').flush({ message: 'Utilisateur inconnu' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(text('.message h1')).toBe('Collectionneur introuvable');
    httpMock.expectNone((r) => r.url.endsWith('/albums'));
  });

  it('autre profil depuis la même page (changement d’identifiant) : rechargé', () => {
    show();
    params.next(convertToParamMap({ id: 'u3' }));
    httpMock.expectOne('/api/users/u3').flush(profile({ id: 'u3', name: 'Pierre' }));
    httpMock.expectOne((r) => r.url === '/api/users/u3/albums').flush({ items: [], page: 1, limit: 12, total: 0, pages: 1 });
    fixture.detectChanges();
    expect(text('h1')).toBe('Pierre');
  });
});
