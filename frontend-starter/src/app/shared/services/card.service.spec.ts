import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CardService } from './card.service';

describe('CardService', () => {
  let service: CardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('search / detail : catalogue avec l’album cible', () => {
    service.search('dracau', 'a1').subscribe();
    service.detail('sv03.5-006', 'a1').subscribe();

    const search = httpMock.expectOne((r) => r.url === '/api/catalog/cards');
    expect(search.request.params.get('name')).toBe('dracau');
    expect(search.request.params.get('albumId')).toBe('a1');
    const detail = httpMock.expectOne((r) => r.url === '/api/catalog/cards/sv03.5-006');
    expect(detail.request.params.get('albumId')).toBe('a1');
  });

  it('list : page, 9 par page, catégorie seulement si demandée', () => {
    service.list('a1', 2).subscribe();
    service.list('a1', 1, 9, 'Énergie').subscribe();

    const [all, filtered] = httpMock.match((r) => r.url === '/api/albums/a1/cards');
    expect(all.request.params.get('page')).toBe('2');
    expect(all.request.params.get('limit')).toBe('9');
    expect(all.request.params.has('category')).toBe(false);
    expect(filtered.request.params.get('category')).toBe('Énergie');
  });

  it('add : multipart (tcgdexId + photo) avec progression d’envoi', () => {
    const photo = new File(['x'], 'carte.jpg', { type: 'image/jpeg' });
    const types: HttpEventType[] = [];
    service.add('a1', 'sv03.5-006', photo).subscribe((event) => types.push(event.type));

    const req = httpMock.expectOne('/api/albums/a1/cards');
    expect(req.request.method).toBe('POST');
    expect(req.request.reportUploadProgress).toBe(true);
    const body = req.request.body as FormData;
    expect(body.get('tcgdexId')).toBe('sv03.5-006');
    expect(body.get('photo')).toBe(photo);
    req.event({ type: HttpEventType.UploadProgress, loaded: 1, total: 2 });
    req.flush({ id: 'c1' });
    expect(types).toContain(HttpEventType.UploadProgress);
    // Sans réglages, ni crop ni rotation ne partent.
    expect(body.has('crop')).toBe(false);
    expect(body.has('rotation')).toBe(false);
  });

  it('add avec recadrage : cadre en JSON et quarts de tour', () => {
    const photo = new File(['x'], 'carte.jpg', { type: 'image/jpeg' });
    service.add('a1', 'sv03.5-006', photo, { crop: { x: 10, y: 20, width: 315, height: 440 }, rotation: 3 }).subscribe();

    const body = httpMock.expectOne('/api/albums/a1/cards').request.body as FormData;
    expect(JSON.parse(String(body.get('crop')))).toEqual({ x: 10, y: 20, width: 315, height: 440 });
    expect(body.get('rotation')).toBe('3');
  });

  it('delete : DELETE /api/cards/:id', () => {
    service.delete('c1').subscribe();
    expect(httpMock.expectOne('/api/cards/c1').request.method).toBe('DELETE');
  });
});
