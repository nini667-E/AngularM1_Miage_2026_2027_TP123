import { PublicUser } from './friend.model';

/** GET /api/albums/:id/reactions : likes et droits de l'utilisateur (étape 6). */
export interface ReactionSummary {
  likeCount: number;
  likedByMe: boolean;
  /** Qui aime l'album, les plus récents d'abord. */
  likers: PublicUser[];
  commentCount: number;
  /** Ami du propriétaire (le propriétaire n'aime pas son propre album). */
  canLike: boolean;
  /** Ami du propriétaire (le propriétaire ne commente pas son album). */
  canComment: boolean;
  /** Propriétaire : répond aux commentaires de ses amis. */
  canReply: boolean;
  /** Propriétaire : peut retirer les likes reçus. */
  canRemoveLikes: boolean;
}

/** Réponse de PUT / DELETE /api/albums/:id/likes/me. */
export interface LikeResult {
  likeCount: number;
  likedByMe: boolean;
}

/** Un commentaire d'album, ou une réponse du propriétaire (`parentId`). */
export interface AlbumComment {
  id: string;
  albumId: string;
  /** Commentaire auquel celui-ci répond ; null pour un commentaire principal. */
  parentId: string | null;
  author: PublicUser;
  text: string;
  createdAt: string;
  /** Son auteur, ou le propriétaire de l'album. */
  canDelete: boolean;
  /** Réponses du propriétaire (commentaire principal), dans l'ordre chronologique. */
  replies: AlbumComment[];
}
