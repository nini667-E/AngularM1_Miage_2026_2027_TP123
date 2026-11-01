/** Extension ou série d'une carte. */
export interface CardSetRef {
  id: string;
  name: string | null;
  logo?: string | null;
}

/** Résultat de recherche (GET /api/catalog/cards?name=). */
export interface CardSearchResult {
  id: string;
  name: string;
  localId: string | null;
  /** Vignette officielle TCGdex, ou null si TCGdex n'en a pas. */
  image: string | null;
  set: CardSetRef;
  /** Compatible avec la série / l'extension de l'album (le type est vérifié au détail). */
  compatible: boolean;
  reason: string | null;
}

/** Verdict de cohérence avec le thème de l'album, calculé par le serveur. */
export interface ThemeVerdict {
  compatible: boolean;
  reasons: string[];
}

interface CardInfo {
  tcgdexId: string;
  name: string;
  localId: string | null;
  category: 'Pokémon' | 'Dresseur' | 'Énergie' | null;
  subCategory: string | null;
  types: string[];
  rarity: string | null;
  set: CardSetRef | null;
  serie: CardSetRef | null;
  officialImage: { small: string | null; large: string | null };
}

/** Détail d'une carte du catalogue (GET /api/catalog/cards/:id?albumId=). */
export interface CardDetail extends CardInfo {
  verdict: ThemeVerdict | null;
}

/** Carte rangée dans un album, avec les URL signées de sa photo. */
export interface AlbumCard extends CardInfo {
  id: string;
  albumId: string;
  photo: { thumb: string; full: string };
  createdAt: string;
}

export type CardCategory = 'Pokémon' | 'Dresseur' | 'Énergie';

/**
 * Réglages de la photo envoyés au serveur : cadre en pixels de la photo
 * redressée puis tournée, et nombre de quarts de tour (sens horaire).
 */
export interface PhotoAdjustments {
  crop: { x: number; y: number; width: number; height: number };
  rotation: number;
}
