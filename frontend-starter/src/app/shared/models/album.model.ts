import { PublicUser, Relation } from './friend.model';

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
  /** Nombre d'amis destinataires (étape 5) : pour le propriétaire seulement, sinon null. */
  sharedCount: number | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/albums/:id ajoute le propriétaire et ma relation avec lui (étape 4). */
export interface AlbumDetail extends Album {
  owner: { id: string; name: string; relation: Relation };
}

/** GET /api/albums/shared : album privé partagé avec moi, avec son propriétaire (étape 5). */
export interface SharedAlbum extends Album {
  owner: PublicUser;
}

/** GET /api/albums/:id/shares : un de mes amis, et l'album lui est-il partagé ? */
export interface AlbumShare {
  user: PublicUser;
  shared: boolean;
}

/** Corps envoyé à POST / PUT /api/albums. */
export interface AlbumInput {
  title: string;
  description: string;
  visibility: Visibility;
  theme: { type?: string; serieId?: string; setId?: string };
}
