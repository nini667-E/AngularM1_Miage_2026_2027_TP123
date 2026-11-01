import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('une seule requête par liste pour toute la session', () => {
    const received: string[][] = [];
    service.types().subscribe((t) => received.push(t));
    httpMock.expectOne('/api/catalog/types').flush(['Eau', 'Feu']);

    // Deuxième demande (ex. réouverture du formulaire) : aucune requête.
    service.types().subscribe((t) => received.push(t));
    httpMock.expectNone('/api/catalog/types');

    expect(received).toEqual([['Eau', 'Feu'], ['Eau', 'Feu']]);
  });

  it('extensions : une requête par série, identifiant encodé', () => {
    service.sets('sv').subscribe();
    service.sets('swsh3.5/x').subscribe();
    service.sets('sv').subscribe();

    httpMock.expectOne('/api/catalog/series/sv/sets').flush([]);
    httpMock.expectOne('/api/catalog/series/swsh3.5%2Fx/sets').flush([]);
  });
});
