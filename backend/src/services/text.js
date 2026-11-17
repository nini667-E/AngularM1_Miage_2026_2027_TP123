/*
 * Recherche de texte (V2, étapes 4 et 7) : la saisie de l'utilisateur est
 * toujours cherchée telle quelle (jamais interprétée comme une expression
 * régulière), sans tenir compte de la casse ni des accents.
 */

/** Échappe les caractères spéciaux des expressions régulières. */
export const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Lettre de base -> toutes ses variantes accentuées (français, et « ñ »).
const VARIANTS = {
  a: "aàâäá",
  c: "cç",
  e: "eéèêë",
  i: "iîïí",
  n: "nñ",
  o: "oôöó",
  u: "uùûüú",
  y: "yÿ",
};

/**
 * Motif `$regex` (à utiliser avec `$options: "i"`) qui trouve `text` quels
 * que soient les accents : « energie » trouve « Énergie », « pokemon »
 * trouve « Pokémon ».
 */
export function textPattern(text) {
  const plain = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return [...plain].map((char) => (VARIANTS[char] ? `[${VARIANTS[char]}]` : escapeRegExp(char))).join("");
}
