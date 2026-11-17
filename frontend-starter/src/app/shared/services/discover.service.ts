import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivityResponse, AlbumWithOwner, DiscoveredCard, RecentResponse, SearchCriteria } from '../models/discover.model';
import { Page } from '../models/page.model';

/** Découverte (V2, étape 7) : récents, activité des amis, recherche. Seul point d'appel HTTP de la découverte. */
@Injectable({ providedIn: 'root' })
export class DiscoverService {
  private readonly http = inject(HttpClient);

  recent() {
    return this.http.get<RecentResponse>('/api/discover/recent');
  }

  activity() {
    return this.http.get<ActivityResponse>('/api/discover/activity');
  }

  searchAlbums(criteria: Partial<SearchCriteria>, page = 1, limit = 12) {
    return this.http.get<Page<AlbumWithOwner>>('/api/discover/albums', { params: this.params(criteria, page, limit, false) });
  }

  searchCards(criteria: Partial<SearchCriteria>, page = 1, limit = 12) {
    return this.http.get<Page<DiscoveredCard>>('/api/discover/cards', { params: this.params(criteria, page, limit, true) });
  }

  /** Seuls les critères renseignés sont envoyés ; la catégorie ne concerne que les cartes. */
  private params(criteria: Partial<SearchCriteria>, page: number, limit: number, cards: boolean): HttpParams {
    let params = new HttpParams().set('page', page).set('limit', limit);
    const keys: (keyof SearchCriteria)[] = cards ? ['q', 'type', 'serieId', 'setId', 'category'] : ['q', 'type', 'serieId', 'setId'];
    for (const key of keys) {
      const value = criteria[key]?.trim();
      if (value) params = params.set(key, value);
    }
    return params;
  }
}
