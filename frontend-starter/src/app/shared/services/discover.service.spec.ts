import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DiscoverService } from './discover.service';

describe('DiscoverService', () => {
  let service: DiscoverService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DiscoverService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('récents et activité : GET sur leurs routes', () => {
    service.recent().subscribe();
    service.activity().subscribe();
    expect(httpMock.expectOne('/api/discover/recent').request.method).toBe('GET');
    expect(httpMock.expectOne('/api/discover/activity').request.method).toBe('GET');
  });

  it('recherche d’albums : seuls les critères renseignés sont envoyés, jamais la catégorie', () => {
    service.searchAlbums({ q: '  psy ', type: 'Psy', serieId: '', setId: '', category: 'Pokémon' }, 2).subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/discover/albums');
    const params = req.request.params;
    expect(params.keys().sort()).toEqual(['limit', 'page', 'q', 'type']);
    expect([params.get('q'), params.get('type'), params.get('page'), params.get('limit')]).toEqual(['psy', 'Psy', '2', '12']);
  });

  it('recherche de cartes : la catégorie est envoyée', () => {
    service.searchCards({ q: 'mew', category: 'Pokémon', setId: 'sv03.5' }).subscribe();
    const params = httpMock.expectOne((r) => r.url === '/api/discover/cards').request.params;
    expect([params.get('q'), params.get('category'), params.get('setId'), params.get('type')]).toEqual(['mew', 'Pokémon', 'sv03.5', null]);
  });
});
