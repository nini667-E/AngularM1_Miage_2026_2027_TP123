import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AlbumService } from './album.service';
import { AlbumInput } from '../models/album.model';

describe('AlbumService', () => {
  let service: AlbumService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AlbumService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('mine() : GET /api/albums/mine avec page et limit', () => {
    service.mine(2, 24).subscribe();
    const req = httpMock.expectOne((r) => r.url === '/api/albums/mine');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('24');
    req.flush({ items: [], page: 2, limit: 24, total: 0, pages: 1 });
  });

  it('create() : POST /api/albums avec le corps tel quel', () => {
    const input: AlbumInput = { title: 'Feu', description: '', visibility: 'private', theme: { type: 'Feu' } };
    service.create(input).subscribe();
    const req = httpMock.expectOne('/api/albums');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush({});
  });

  it('get / update / delete : URL de l’album, identifiant encodé', () => {
    service.get('a/b').subscribe();
    service.update('a1', { visibility: 'public' }).subscribe();
    service.delete('a1').subscribe();

    expect(httpMock.expectOne('/api/albums/a%2Fb').request.method).toBe('GET');
    const put = httpMock.expectOne((r) => r.method === 'PUT');
    expect(put.request.url).toBe('/api/albums/a1');
    expect(put.request.body).toEqual({ visibility: 'public' });
    expect(httpMock.expectOne((r) => r.method === 'DELETE').request.url).toBe('/api/albums/a1');
  });

  it('partage (étape 5) : shared() paginé, shares() et setShares() sur l’album', () => {
    service.shared(2, 12).subscribe();
    service.shares('a1').subscribe();
    service.setShares('a1', ['u2', 'u3']).subscribe();

    const shared = httpMock.expectOne((r) => r.url === '/api/albums/shared');
    expect(shared.request.params.get('page')).toBe('2');
    expect(httpMock.expectOne((r) => r.method === 'GET' && r.url === '/api/albums/a1/shares').request.url).toBe('/api/albums/a1/shares');
    const put = httpMock.expectOne((r) => r.method === 'PUT');
    expect(put.request.url).toBe('/api/albums/a1/shares');
    expect(put.request.body).toEqual({ userIds: ['u2', 'u3'] });
  });
});
