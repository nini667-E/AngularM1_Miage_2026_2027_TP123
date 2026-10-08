import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Page } from '../models/page.model';
import { Track } from '../models/track.model';

/** Encapsulates all HTTP operations for backing tracks. */
@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);

  list(page = 1, limit = 5, title = '') {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (title) params = params.set('title', title);

    return this.http.get<Page<Track>>('/api/tracks', { params });
  }

  // observe: 'events' + reportUploadProgress : l'Observable n'émet plus une
  // seule réponse finale mais une suite d'HttpEvent (Sent, UploadProgress...,
  // Response) ; c'est au composant de trier selon event.type.
  // Nécessite withXhr() dans main.ts (fetch ne remonte pas la progression
  // d'envoi ; sans XHR, Angular lève une erreur explicite).
  upload(file: File, title: string) {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    return this.http.post<Track>('/api/tracks', body, {
      reportUploadProgress: true,
      observe: 'events',
    });
  }

  audio(id: string) {
    return this.http.get(`/api/tracks/${id}/audio`, {
      responseType: 'blob',
    });
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/tracks/${id}`);
  }
}
