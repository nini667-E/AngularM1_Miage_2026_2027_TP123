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
 * Vrai si `userId` peut voir l'album : son propriétaire, ou tout le monde
 * quand l'album est public.
 * Étape 5 : un album privé deviendra aussi visible par les amis avec qui il
 * est partagé (`sharedWith`).
 */
export function canView(album, userId) {
  if (!album) return false;
  return isOwner(album, userId) || album.visibility === "public";
}
