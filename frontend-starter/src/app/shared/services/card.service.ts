import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AlbumCard, CardCategory, CardDetail, CardSearchResult, PhotoAdjustments } from '../models/card.model';
import { Page } from '../models/page.model';

/** Cartes (V2, étape 3) : catalogue, classeur, ajout avec photo, suppression. */
@Injectable({ providedIn: 'root' })
export class CardService {
  private readonly http = inject(HttpClient);

  /** Recherche dans le catalogue, avec la compatibilité pour l'album. */
  search(name: string, albumId: string) {
    const params = new HttpParams().set('name', name).set('albumId', albumId);
    return this.http.get<CardSearchResult[]>('/api/catalog/cards', { params });
  }

  /** Détail d'une carte + verdict de cohérence avec l'album. */
  detail(tcgdexId: string, albumId: string) {
    const params = new HttpParams().set('albumId', albumId);
    return this.http.get<CardDetail>(`/api/catalog/cards/${encodeURIComponent(tcgdexId)}`, { params });
  }

  /** Une page du classeur (9 cartes), éventuellement filtrée par catégorie. */
  list(albumId: string, page = 1, limit = 9, category?: CardCategory) {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (category) params = params.set('category', category);
    return this.http.get<Page<AlbumCard>>(`/api/albums/${encodeURIComponent(albumId)}/cards`, { params });
  }

  /**
   * Ajoute une carte avec sa photo d'origine et, facultativement, le
   * recadrage et la rotation choisis : c'est le serveur qui découpe
   * l'original (pleine qualité). Comme l'upload de la V1 (TP3) :
   * reportUploadProgress + observe 'events' pour suivre la progression
   * (nécessite withXhr() dans main.ts).
   */
  add(albumId: string, tcgdexId: string, photo: File, adjustments?: PhotoAdjustments) {
    const body = new FormData();
    body.append('tcgdexId', tcgdexId);
    body.append('photo', photo);
    if (adjustments) {
      body.append('crop', JSON.stringify(adjustments.crop));
      body.append('rotation', String(adjustments.rotation));
    }
    return this.http.post<AlbumCard>(`/api/albums/${encodeURIComponent(albumId)}/cards`, body, {
      reportUploadProgress: true,
      observe: 'events',
    });
  }

  delete(cardId: string) {
    return this.http.delete<void>(`/api/cards/${encodeURIComponent(cardId)}`);
  }
}
