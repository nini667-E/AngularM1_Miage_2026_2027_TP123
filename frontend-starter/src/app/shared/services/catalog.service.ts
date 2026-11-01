import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { CatalogSerie, CatalogSet } from '../models/catalog.model';

/**
 * Listes du catalogue TCGdex, servies par notre backend (V2, étape 2).
 * Chaque liste n'est demandée qu'une fois par session : shareReplay(1)
 * rejoue la dernière réponse aux abonnés suivants.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<unknown>>();

  types() {
    return this.cached<string[]>('/api/catalog/types');
  }

  series() {
    return this.cached<CatalogSerie[]>('/api/catalog/series');
  }

  sets(serieId: string) {
    return this.cached<CatalogSet[]>(`/api/catalog/series/${encodeURIComponent(serieId)}/sets`);
  }

  private cached<T>(url: string): Observable<T> {
    let request = this.cache.get(url) as Observable<T> | undefined;
    if (!request) {
      request = this.http.get<T>(url).pipe(shareReplay(1));
      this.cache.set(url, request);
    }
    return request;
  }
}
