/** Série ou extension TCGdex recopiée dans l'album (nom et logo). */
export interface CatalogRef {
  id: string;
  name: string | null;
  logo: string | null;
}

/** Thème facultatif d'un album : type et/ou série (+ extension). */
export interface AlbumTheme {
  type: string | null;
  serie: CatalogRef | null;
  set: CatalogRef | null;
}

export type Visibility = 'private' | 'public';

/** Album tel que renvoyé par l'API. */
export interface Album {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: Visibility;
  theme: AlbumTheme;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/albums/:id ajoute le propriétaire. */
export interface AlbumDetail extends Album {
  owner: { id: string; name: string };
}

/** Corps envoyé à POST / PUT /api/albums. */
export interface AlbumInput {
  title: string;
  description: string;
  visibility: Visibility;
  theme: { type?: string; serieId?: string; setId?: string };
}
