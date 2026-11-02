/*
 * Règles d'accès aux albums, centralisées ici pour qu'aucune route ne les
 * réécrive (et ne les oublie). Testées unitairement dans test/access.test.js.
 * L'identité vient toujours du JWT vérifié (`req.auth.sub`), jamais d'une
 * donnée envoyée par le client.
 */

/** Vrai si `userId` est le propriétaire de l'album. */
export function isOwner(album, userId) {
  return Boolean(album && userId) && String(album.ownerId) === String(userId);
}

/**
 * Droits de réaction sur un album que `userId` peut déjà voir (étape 6).
 * `isFriend` : `userId` est ami du propriétaire (calculé par l'appelant,
 * qui seul accède à la base). Les amis aiment et commentent ; le
 * propriétaire ne fait ni l'un ni l'autre sur son album, mais **répond** aux
 * commentaires de ses amis ; un visiteur qui n'est pas ami lit sans réagir.
 */
export function reactionRights(album, userId, isFriend) {
  const owner = isOwner(album, userId);
  const friend = !owner && Boolean(isFriend);
  return { canLike: friend, canComment: friend, canReply: owner };
}

/** Vrai si l'album est partagé avec `userId` (étape 5). */
export function isSharedWith(album, userId) {
  return Boolean(album && userId) && (album.sharedWith ?? []).some((id) => String(id) === String(userId));
}

/**
 * Vrai si `userId` peut voir l'album : son propriétaire, tout le monde
 * quand l'album est public, et, quand il est privé, les amis avec qui il
 * est partagé (`sharedWith`, étape 5). Retirer un ami le retire de
 * `sharedWith` (routes/friends.js) : pas besoin de revérifier l'amitié ici.
 */
export function canView(album, userId) {
  if (!album) return false;
  return isOwner(album, userId) || album.visibility === "public" || isSharedWith(album, userId);
}
