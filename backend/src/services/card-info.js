import { HttpError } from "../errors.js";
import { getCard, getSet, imageUrl, officialImage } from "./tcgdex.js";

/*
 * Description d'une carte et contrôle de cohérence avec le thème d'un album
 * (V2, étape 3). Tout est calculé ici, côté serveur, à partir des données
 * TCGdex : jamais à partir de ce qu'envoie le client.
 */

// Mots (sans accents, en minuscules) qui désignent chaque type dans les noms
// d'Énergies TCGdex, y compris les noms anglais des anciennes extensions
// (« Énergie Fire Chaleur », « Énergie Lightning de base »…). Liste établie à
// partir des 130 noms d'Énergies distincts du catalogue (01/11/2026).
const ENERGY_WORDS = {
  Feu: ["feu", "fire"],
  Eau: ["eau", "water", "aqua"],
  Plante: ["plante", "grass", "phyto"],
  "Électrique": ["electrique", "electrik", "lightning"],
  Psy: ["psy", "psychic"],
  Combat: ["combat", "fighting"],
  "Obscurité": ["obscurite", "darkness"],
  "Métal": ["metal"],
  "Fée": ["fee", "fairy"],
  Dragon: ["dragon"],
  Incolore: ["incolore", "colorless"],
};

/**
 * Découpe un nom en mots : aux espaces et tirets, mais aussi aux majuscules
 * (« GrassFireWater » -> grass, fire, water), sans accents, en minuscules.
 * Comparer des mots entiers évite les faux positifs : « Énergie Cadeau »
 * contient les lettres « eau » mais n'est pas une Énergie Eau.
 */
export function nameWords(name) {
  return name
    .replace(/([a-zà-ÿ])([A-ZÀ-Ý])/g, "$1 $2")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Type d'une Énergie déduit de son nom : le type si un seul est reconnu,
 * sinon `null` (aucun type, ou plusieurs comme « Énergie Unitaire
 * GrassFireWater », qui fournit trois types).
 */
export function energyTypeFromName(name) {
  const words = new Set(nameWords(name));
  const found = Object.keys(ENERGY_WORDS).filter((type) => ENERGY_WORDS[type].some((word) => words.has(word)));
  return found.length === 1 ? found[0] : null;
}

/** Types retenus pour une carte : `types` TCGdex, sinon déduit du nom (Énergies). */
export function cardTypes(card) {
  if (Array.isArray(card.types) && card.types.length) return card.types;
  if (card.category === "Énergie") {
    const type = energyTypeFromName(card.name ?? "");
    return type ? [type] : [];
  }
  return [];
}

/**
 * Fiche normalisée d'une carte TCGdex (+ son extension, qui donne la série).
 * C'est ce qui est enregistré avec la carte dans l'album.
 */
export function describeCard(card, set) {
  return {
    tcgdexId: card.id,
    name: card.name,
    localId: card.localId ?? null,
    category: card.category ?? null,
    subCategory: card.trainerType ?? card.energyType ?? null,
    types: cardTypes(card),
    rarity: card.rarity ?? null,
    officialImage: card.image ?? null,
    set: { id: card.set?.id ?? set?.id, name: card.set?.name ?? set?.name ?? null, logo: imageUrl(card.set?.logo ?? set?.logo) },
    serie: set?.serie ? { id: set.serie.id, name: set.serie.name } : null,
  };
}

/** Récupère et décrit une carte ; 400 si elle n'existe pas (ou est Pocket). */
export async function loadCardInfo(cardId) {
  const card = typeof cardId === "string" ? await getCard(cardId.trim()) : null;
  if (!card) throw new HttpError(400, "Carte inconnue");
  const set = card.set?.id ? await getSet(card.set.id) : null;
  return describeCard(card, set);
}

/**
 * Compare une carte décrite au thème d'un album. Règles (décidées le
 * 01/11/2026) :
 * - type : vérifié pour les Pokémon et les Énergies typées ; Dresseurs et
 *   Énergies sans type toujours acceptés ;
 * - série et extension : vérifiées pour toutes les cartes.
 * Renvoie { compatible, reasons[] }.
 */
export function checkTheme(info, theme = {}) {
  const reasons = [];
  const typed = (info.category === "Pokémon" || info.category === "Énergie") && info.types.length > 0;

  if (theme.type && typed && !info.types.includes(theme.type)) {
    reasons.push(`Type ${info.types.join(" / ")} : l'album est réservé au type ${theme.type}`);
  }
  if (theme.serie?.id && info.serie?.id !== theme.serie.id) {
    reasons.push(`Série ${info.serie?.name ?? "inconnue"} : l'album est réservé à la série ${theme.serie.name ?? theme.serie.id}`);
  }
  if (theme.set?.id && info.set?.id !== theme.set.id) {
    reasons.push(`Extension ${info.set?.name ?? "inconnue"} : l'album est réservé à l'extension ${theme.set.name ?? theme.set.id}`);
  }
  return { compatible: reasons.length === 0, reasons };
}

/** Fiche publique (pour Angular) avec les deux tailles d'image officielle. */
export function publicCardInfo(info) {
  return {
    ...info,
    officialImage: { small: officialImage(info.officialImage, "low"), large: officialImage(info.officialImage, "high") },
  };
}
