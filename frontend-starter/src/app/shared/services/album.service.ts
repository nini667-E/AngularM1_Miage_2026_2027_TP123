import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Album, AlbumDetail, AlbumInput } from '../models/album.model';
import { Page } from '../models/page.model';

/** Albums de l'utilisateur (V2, étape 2). Seul point d'appel HTTP des albums. */
@Injectable({ providedIn: 'root' })
export class AlbumService {
  private readonly http = inject(HttpClient);

  mine(page = 1, limit = 12) {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<Page<Album>>('/api/albums/mine', { params });
  }

  get(id: string) {
    return this.http.get<AlbumDetail>(`/api/albums/${encodeURIComponent(id)}`);
  }

  create(input: AlbumInput) {
    return this.http.post<Album>('/api/albums', input);
  }

  update(id: string, changes: Partial<AlbumInput>) {
    return this.http.put<Album>(`/api/albums/${encodeURIComponent(id)}`, changes);
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/albums/${encodeURIComponent(id)}`);
  }
}
