import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Album } from '../../shared/models/album.model';
import { AlbumsPageComponent } from './albums-page';

const album = (id: string, title: string): Album => ({
  id,
  ownerId: 'u1',
  title,
  description: '',
  visibility: 'private',
  theme: { type: null, serie: null, set: null },
  cardCount: 0,
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01',
});

describe('AlbumsPageComponent (Mes albums)', () => {
  let fixture: ComponentFixture<AlbumsPageComponent>;
  let httpMock: HttpTestingController;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AlbumsPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AlbumsPageComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  const flushPage = (items: Album[], total = items.length) =>
    httpMock
      .expectOne((r) => r.url === '/api/albums/mine')
      .flush({ items, page: 1, limit: 12, total, pages: 1 });

  it('affiche une couverture par album, chacune menant à sa page', () => {
    flushPage([album('a1', 'Mes Feu'), album('a2', 'Mes Eau')]);
    fixture.detectChanges();

    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('app-album-cover a'));
    expect(links.map((a) => a.textContent ?? '')).toEqual([
      expect.stringContaining('Mes Feu'),
      expect.stringContaining('Mes Eau'),
    ]);
    expect(links[0].getAttribute('href')).toBe('/albums/a1');
    expect(el.querySelector('.subtitle')?.textContent ?? '').toContain('2 albums');
  });

  it('aucun album : état vide avec un bouton de création', () => {
    flushPage([]);
    fixture.detectChanges();

    expect(el.querySelector('.empty h2')?.textContent ?? '').toContain('Ton coffre est encore vide');
    expect(el.querySelector('app-album-cover')).toBeNull();
  });

  it('erreur de chargement : message, pas d’état vide trompeur', () => {
    httpMock.expectOne((r) => r.url === '/api/albums/mine').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(el.querySelector('.error')?.textContent ?? '').toContain('Impossible de charger tes albums');
    expect(el.querySelector('.empty')).toBeNull();
  });

  it('création réussie : SnackBar puis rechargement de la page 1', () => {
    flushPage([]);
    const component = fixture.componentInstance;
    vi.spyOn(component['dialog'], 'open').mockReturnValue({ afterClosed: () => of(album('a9', 'Nouveau')) } as never);
    const snack = vi.spyOn(component['snackBar'], 'open').mockReturnValue(undefined as never);

    component.create();

    expect(snack).toHaveBeenCalledWith('Album « Nouveau » créé.', 'OK', expect.objectContaining({ panelClass: 'snack-success' }));
    flushPage([album('a9', 'Nouveau')]);
  });

  it('création annulée : rien ne se passe', () => {
    flushPage([]);
    const component = fixture.componentInstance;
    vi.spyOn(component['dialog'], 'open').mockReturnValue({ afterClosed: () => of(undefined) } as never);

    component.create();

    httpMock.expectNone((r) => r.url === '/api/albums/mine');
  });
});
