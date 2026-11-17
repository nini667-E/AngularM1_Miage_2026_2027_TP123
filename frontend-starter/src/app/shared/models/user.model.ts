import { Relation } from './friend.model';

/** Avatar : une carte du catalogue choisie par le collectionneur (V2, étape 8). */
export interface UserAvatar {
  tcgdexId: string;
  name: string;
  /** Vignette officielle de la carte. */
  image: string;
}

/** Mon profil, tel que renvoyé par /api/users/me. */
export interface User {
  id: string;
  name: string;
  email: string;
  bio: string;
  avatar: UserAvatar | null;
  createdAt: string;
}

/** Champs modifiables de mon profil (PUT /api/users/me) ; avatarId null = retirer l'avatar. */
export interface ProfileChanges {
  name?: string;
  bio?: string;
  avatarId?: string | null;
}

/** Profil public d'un collectionneur (GET /api/users/:id), jamais son email. */
export interface UserProfile {
  id: string;
  name: string;
  bio: string;
  avatar: UserAvatar | null;
  createdAt: string;
  relation: Relation;
  /** Calculés sur ses albums que je peux voir (sauf le nombre d'amis). */
  stats: { albums: number; cards: number; likes: number; friends: number };
}
