import { Friendship, pairKey } from "../models/Friendship.js";
import { User } from "../models/User.js";

/*
 * Relations d'amitié (V2, étape 4), réutilisées par le partage (étape 5),
 * les réactions (étape 6) et l'activité (étape 7).
 */

/**
 * Relation entre `userId` et l'autre membre d'un lien :
 * `none` (aucun lien), `friend`, `sent` (j'ai invité), `received` (on m'a invité).
 */
export function relationOf(friendship, userId) {
  if (!friendship) return "none";
  if (friendship.status === "accepted") return "friend";
  return String(friendship.requester) === String(userId) ? "sent" : "received";
}

/** Le lien entre deux utilisateurs, ou null. */
export function findBetween(a, b) {
  return Friendship.findOne({ pair: pairKey(a, b) });
}

/** Relation de `userId` envers `otherId` ; `self` pour soi-même. */
export async function relationBetween(userId, otherId) {
  if (String(userId) === String(otherId)) return "self";
  return relationOf(await findBetween(userId, otherId), userId);
}

/** Vrai si les deux utilisateurs sont amis (invitation acceptée). */
export async function areFriends(a, b) {
  return (await relationBetween(a, b)) === "friend";
}

/** Identifiants (chaînes) des amis de `userId`. */
export async function friendIds(userId) {
  const links = await Friendship.find({
    status: "accepted",
    $or: [{ requester: userId }, { recipient: userId }],
  });
  return links.map((link) => link.otherThan(userId));
}

/**
 * Identité publique ({ id, name }, jamais l'email) des utilisateurs `ids`,
 * dans le même ordre.
 */
export async function publicUsers(ids) {
  const users = await User.find({ _id: { $in: ids } }, "name");
  const names = new Map(users.map((user) => [String(user._id), user.name]));
  return ids.map((id) => ({ id: String(id), name: names.get(String(id)) ?? "Utilisateur supprimé" }));
}

/** Tri alphabétique d'éléments { user: { name } }. */
export const byName = (a, b) => a.user.name.localeCompare(b.user.name, "fr");
