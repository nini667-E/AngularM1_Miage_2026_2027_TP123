import { HttpError } from "../errors.js";

/*
 * Accès au catalogue public TCGdex (https://tcgdex.dev), en français.
 * C'est le backend qui l'interroge, jamais Angular : le contrôle de
 * cohérence entre une carte et le thème d'un album doit être fait par le
 * serveur, sinon un client modifié pourrait mentir sur le type ou la série.
 */
const BASE_URL = "https://api.tcgdex.net/v2/fr";
const TIMEOUT_MS = 8000;

// Les listes (types, séries, extensions) ne changent qu'à la sortie d'une
// nouvelle extension : une mémoire de 24 h évite d'interroger TCGdex à
// chaque affichage d'un formulaire.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

// Cartes numériques du jeu mobile : impossibles à photographier.
const EXCLUDED_SERIES = new Set(["tcgp"]);

// Les identifiants TCGdex sont du type "swsh3.5" : on refuse tout le reste
// avant de les injecter dans une URL.
const ID_PATTERN = /^[a-z0-9.-]{1,40}$/i;

/** Vide la mémoire du catalogue (utilisé par les tests). */
export function clearCatalogCache() {
  cache.clear();
}

/**
 * GET sur l'API TCGdex, avec mémoire. Renvoie `null` si la ressource
 * n'existe pas (404) ; lève une HttpError 502 si TCGdex est injoignable ou
 * répond une erreur.
 */
async function get(path) {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let response;
  try {
    response = await fetch(BASE_URL + path, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    console.error(`[tcgdex] Catalogue injoignable pour ${path}`, error);
    throw new HttpError(502, "Catalogue de cartes indisponible");
  }

  if (response.status === 404) return null;
  if (!response.ok) {
    console.error(`[tcgdex] Réponse ${response.status} pour ${path}`);
    throw new HttpError(502, "Catalogue de cartes indisponible");
  }

  const value = await response.json();
  cache.set(path, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  console.log(`[tcgdex] ${path} chargé et mis en mémoire`);
  return value;
}

// TCGdex fournit l'adresse des logos sans extension de fichier.
export const imageUrl = (base) => (base ? `${base}.png` : null);

/** Les 11 types de cartes, en français (« Feu », « Eau »…). */
export async function getTypes() {
  return (await get("/types")) ?? [];
}

/** Les séries photographiables (Pocket exclue). */
export async function getSeries() {
  const series = (await get("/series")) ?? [];
  return series
    .filter((serie) => !EXCLUDED_SERIES.has(serie.id))
    .map((serie) => ({ id: serie.id, name: serie.name, logo: imageUrl(serie.logo) }));
}

/**
 * Les extensions d'une série, ou `null` si la série n'existe pas, est
 * exclue ou a un identifiant invalide.
 */
export async function getSeriesSets(serieId) {
  if (!ID_PATTERN.test(serieId) || EXCLUDED_SERIES.has(serieId)) return null;
  const serie = await get(`/series/${serieId}`);
  if (!serie) return null;
  return (serie.sets ?? []).map((set) => ({
    id: set.id,
    name: set.name,
    logo: imageUrl(set.logo),
    cardCount: set.cardCount?.official ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Cartes (V2, étape 3)
// ---------------------------------------------------------------------------

export const SEARCH_LIMIT = 20;

/** Extension d'une carte : tout ce qui précède le dernier tiret de son id
 *  (« sv03.5-006 » -> « sv03.5 », « P-A-009 » -> « P-A »). */
export function setIdOf(cardId) {
  const index = cardId.lastIndexOf("-");
  return index > 0 ? cardId.slice(0, index) : cardId;
}

/** Les 202 extensions (une seule requête), indexées par id. */
export async function getSetIndex() {
  const sets = (await get("/sets")) ?? [];
  return new Map(sets.map((set) => [set.id, { id: set.id, name: set.name, logo: imageUrl(set.logo) }]));
}

/** Identifiants des extensions des séries exclues (Pocket). */
async function excludedSetIds() {
  const ids = new Set();
  for (const serieId of EXCLUDED_SERIES) {
    for (const set of (await get(`/series/${serieId}`))?.sets ?? []) ids.add(set.id);
  }
  return ids;
}

/**
 * Recherche par nom (partielle, insensible à la casse côté TCGdex), limitée
 * aux SEARCH_LIMIT premiers résultats, éventuellement dans une extension.
 * Les cartes Pocket sont retirées. Fiches courtes : id, numéro, nom, image.
 */
export async function searchCards(name, { setId } = {}) {
  if (setId && !ID_PATTERN.test(setId)) return [];
  const params = new URLSearchParams({ name, "pagination:page": "1", "pagination:itemsPerPage": String(SEARCH_LIMIT) });
  if (setId) params.set("set.id", setId);
  const [cards, excluded] = await Promise.all([get(`/cards?${params}`), excludedSetIds()]);
  return (cards ?? []).filter((card) => !excluded.has(setIdOf(card.id)));
}

/** Détail d'une carte, ou `null` si elle n'existe pas (ou est Pocket). */
export async function getCard(cardId) {
  if (!ID_PATTERN.test(cardId)) return null;
  if ((await excludedSetIds()).has(setIdOf(cardId))) return null;
  return get(`/cards/${cardId}`);
}

/** Détail d'une extension, avec sa série (absente du détail d'une carte). */
export async function getSet(setId) {
  if (!ID_PATTERN.test(setId)) return null;
  return get(`/sets/${setId}`);
}

/** Image officielle TCGdex (base sans extension) -> vignette ou grand format. */
export function officialImage(base, quality = "low") {
  return base ? `${base}/${quality}.webp` : null;
}
