import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { tap } from 'rxjs';
import { Friend, FriendActionResult, FriendRequests, UserSearchResult } from '../models/friend.model';
import { AuthService } from './auth.service';

/** Amis et invitations (V2, étape 4). Seul point d'appel HTTP des amis. */
@Injectable({ providedIn: 'root' })
export class FriendService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** Nombre d'invitations reçues en attente : badge de la barre du haut. */
  readonly receivedCount = signal(0);

  search(query: string) {
    const params = new HttpParams().set('q', query);
    return this.http.get<UserSearchResult[]>('/api/users/search', { params });
  }

  friends() {
    return this.http.get<Friend[]>('/api/friends');
  }

  /** Invitations reçues et envoyées ; met à jour le badge au passage. */
  requests() {
    return this.http
      .get<FriendRequests>('/api/friends/requests')
      .pipe(tap((requests) => this.receivedCount.set(requests.received.length)));
  }

  /** Recharge le badge (à chaque page, après une action) ; 0 sans session. */
  refreshCount(): void {
    if (!this.auth.token()) {
      this.receivedCount.set(0);
      return;
    }
    this.requests().subscribe({ error: () => {} });
  }

  /** Invite un utilisateur (ou accepte son invitation s'il m'avait invité). */
  invite(userId: string) {
    return this.http.post<FriendActionResult>('/api/friends/requests', { userId });
  }

  accept(userId: string) {
    return this.http.post<FriendActionResult>(`/api/friends/requests/${encodeURIComponent(userId)}/accept`, {});
  }

  /** Refuse l'invitation reçue de `userId`, ou annule celle que je lui ai envoyée. */
  deleteRequest(userId: string) {
    return this.http.delete<void>(`/api/friends/requests/${encodeURIComponent(userId)}`);
  }

  remove(userId: string) {
    return this.http.delete<void>(`/api/friends/${encodeURIComponent(userId)}`);
  }
}
