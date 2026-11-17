import { Album } from './album.model';
import { AlbumCard } from './card.model';
import { PublicUser } from './friend.model';

/** Album accompagné de son propriétaire (récents, recherche). */
export interface AlbumWithOwner extends Album {
  owner: PublicUser;
}

/** Carte trouvée dans un album que je peux voir, avec cet album et son propriétaire. */
export interface DiscoveredCard extends AlbumCard {
  album: { id: string; title: string };
  owner: PublicUser;
}

/** GET /api/discover/recent : dernières cartes et derniers albums publics. */
export interface RecentResponse {
  cards: DiscoveredCard[];
  albums: AlbumWithOwner[];
}

export type ActivityType = 'album' | 'cards' | 'comment' | 'like';

/** Un événement de l'activité de mes amis. */
export interface ActivityItem {
  id: string;
  type: ActivityType;
  date: string;
  /** L'ami qui a agi. */
  actor: PublicUser;
  album: { id: string; title: string; owner: PublicUser };
  /** type 'cards' : nombre de cartes ajoutées ce jour-là et 3 vignettes au plus. */
  cards?: { count: number; previews: { id: string; name: string; thumb: string }[] };
  /** type 'comment' : extrait du commentaire, et s'il s'agit d'une réponse du propriétaire. */
  comment?: { text: string; isReply: boolean };
}

/** GET /api/discover/activity. */
export interface ActivityResponse {
  hasFriends: boolean;
  items: ActivityItem[];
}

/** Critères de recherche (vides = non utilisés). */
export interface SearchCriteria {
  q: string;
  type: string;
  serieId: string;
  setId: string;
  /** Recherche de cartes seulement. */
  category: string;
}
