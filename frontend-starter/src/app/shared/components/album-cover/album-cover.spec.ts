import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Album } from '../../models/album.model';
import { AlbumCoverComponent } from './album-cover';

const base: Album = {
  id: 'a1',
  ownerId: 'u1',
  title: 'Mes Eau',
  description: '',
  visibility: 'private',
  theme: { type: null, serie: null, set: null },
  cardCount: 0,
  sharedCount: 0,
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01',
};

describe('AlbumCoverComponent', () => {
  let fixture: ComponentFixture<AlbumCoverComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AlbumCoverComponent], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(AlbumCoverComponent);
    el = fixture.nativeElement;
  });

  function render(album: Partial<Album>): void {
    fixture.componentRef.setInput('album', { ...base, ...album });
    fixture.detectChanges();
  }
  const text = (selector: string) => el.querySelector(selector)?.textContent ?? '';

  it('nombre de cartes accordé : aucune / 1 carte / N cartes', () => {
    render({ cardCount: 0 });
    expect(text('.count')).toBe('Aucune carte');
    render({ cardCount: 1 });
    expect(text('.count')).toBe('1 carte');
    render({ cardCount: 12 });
    expect(text('.count')).toBe('12 cartes');
  });

  it('visibilité annoncée aux lecteurs d’écran (pas seulement par une icône)', () => {
    render({ visibility: 'private' });
    expect(text('.visibility .sr-only')).toBe('Album privé');
    render({ visibility: 'public' });
    expect(text('.visibility .sr-only')).toBe('Album public');
  });

  it('emblème : logo de l’extension, sinon de la série, sinon icône du type', () => {
    render({
      theme: {
        type: 'Eau',
        serie: { id: 'sv', name: 'EV', logo: 'serie.png' },
        set: { id: 'sv01', name: 'EV', logo: 'set.png' },
      },
    });
    expect(el.querySelector('.emblem-logo')?.getAttribute('src')).toBe('set.png');

    render({ theme: { type: 'Eau', serie: { id: 'sv', name: 'EV', logo: 'serie.png' }, set: null } });
    expect(el.querySelector('.emblem-logo')?.getAttribute('src')).toBe('serie.png');

    render({ theme: { type: 'Eau', serie: null, set: null } });
    expect(el.querySelector('.emblem-logo')).toBeNull();
    expect(text('.emblem-icon')).toBe('water_drop');
  });

  it('sans thème : puce « Collection libre »', () => {
    render({});
    expect(text('app-theme-chips')).toContain('Collection libre');
  });

  it('partage (étape 5) : nombre d’amis destinataires pour le propriétaire', () => {
    render({ visibility: 'private', sharedCount: 2 });
    expect(text('.visibility .sr-only')).toBe('Album privé, partagé avec 2 amis');
    expect(text('.visibility mat-icon')).toBe('group');
    render({ visibility: 'private', sharedCount: 1 });
    expect(text('.visibility .sr-only')).toBe('Album privé, partagé avec 1 ami');
    // Liste conservée mais inactive si l'album est public.
    render({ visibility: 'public', sharedCount: 2 });
    expect(text('.visibility .sr-only')).toBe('Album public');
    expect(el.querySelector('.owner')).toBeNull();
  });

  it('album partagé avec moi : « par » son propriétaire, « partagé avec toi »', () => {
    fixture.componentRef.setInput('owner', { id: 'u9', name: 'Ondine' });
    render({ visibility: 'private', sharedCount: null });
    expect(text('.owner')).toBe('par Ondine');
    expect(text('.visibility .sr-only')).toBe('Album privé, partagé avec toi');
  });
});
