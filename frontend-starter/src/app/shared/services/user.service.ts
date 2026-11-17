import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Album } from '../models/album.model';
import { Page } from '../models/page.model';
import { UserProfile } from '../models/user.model';

/** Profils publics des collectionneurs (V2, étape 8). */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  profile(id: string) {
    return this.http.get<UserProfile>(`/api/users/${encodeURIComponent(id)}`);
  }

  /** Ses albums que je peux voir. */
  albums(id: string, page = 1, limit = 12) {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<Page<Album>>(`/api/users/${encodeURIComponent(id)}/albums`, { params });
  }
}
