import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Page } from '../models/page.model';
import { AlbumComment, LikeResult, ReactionSummary } from '../models/reaction.model';

/** Likes et commentaires (V2, étape 6). Seul point d'appel HTTP des réactions. */
@Injectable({ providedIn: 'root' })
export class ReactionService {
  private readonly http = inject(HttpClient);

  private album(albumId: string) {
    return `/api/albums/${encodeURIComponent(albumId)}`;
  }

  summary(albumId: string) {
    return this.http.get<ReactionSummary>(`${this.album(albumId)}/reactions`);
  }

  like(albumId: string) {
    return this.http.put<LikeResult>(`${this.album(albumId)}/likes/me`, {});
  }

  unlike(albumId: string) {
    return this.http.delete<LikeResult>(`${this.album(albumId)}/likes/me`);
  }

  /** Le propriétaire retire un like reçu. */
  removeLike(albumId: string, userId: string) {
    return this.http.delete<void>(`${this.album(albumId)}/likes/${encodeURIComponent(userId)}`);
  }

  comments(albumId: string, page = 1, limit = 10) {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<Page<AlbumComment>>(`${this.album(albumId)}/comments`, { params });
  }

  /** Commente l'album, ou répond au commentaire `parentId` (propriétaire). */
  addComment(albumId: string, text: string, parentId?: string) {
    const body = parentId ? { text, parentId } : { text };
    return this.http.post<AlbumComment>(`${this.album(albumId)}/comments`, body);
  }

  deleteComment(id: string) {
    return this.http.delete<void>(`/api/comments/${encodeURIComponent(id)}`);
  }
}
