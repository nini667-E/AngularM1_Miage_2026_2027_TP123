/** Identité publique d'un autre utilisateur : jamais son email. */
export interface PublicUser {
  id: string;
  name: string;
}

/**
 * Relation entre l'utilisateur connecté et un autre (V2, étape 4) :
 * `sent` = je l'ai invité, `received` = il m'a invité, `self` = moi-même.
 */
export type Relation = 'self' | 'none' | 'sent' | 'received' | 'friend';

/** GET /api/users/search. */
export interface UserSearchResult extends PublicUser {
  relation: Exclude<Relation, 'self'>;
}

/** GET /api/friends. */
export interface Friend {
  user: PublicUser;
  since: string;
}

/** Une invitation en attente. */
export interface FriendRequest {
  user: PublicUser;
  createdAt: string;
}

/** GET /api/friends/requests. */
export interface FriendRequests {
  received: FriendRequest[];
  sent: FriendRequest[];
}

/** Réponse d'une invitation ou d'une acceptation. */
export interface FriendActionResult {
  user: PublicUser;
  relation: 'sent' | 'friend';
}
