import { mock } from "node:test";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";

// Même règle que app.js : `npm test` ne charge pas .env, donc c'est le
// secret de développement qui signe et vérifie les tokens.
const SECRET = process.env.JWT_SECRET || "tp1-development-secret";

export const newId = () => new mongoose.Types.ObjectId().toString();

export const tokenFor = (sub, secret = SECRET, options = { expiresIn: "1h" }) =>
  jwt.sign({ sub, email: `${sub}@example.com` }, secret, options);

export const authHeaders = (sub) => ({
  Authorization: `Bearer ${tokenFor(sub)}`,
  "Content-Type": "application/json",
});

/** Démarre l'API sur un port libre ; renvoie { base, close }. */
export async function startServer() {
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => server.close(),
  };
}

// Le vrai fetch, capturé avant toute simulation : les tests l'utilisent
// pour interroger notre propre serveur.
export const realFetch = globalThis.fetch;

/** Faux catalogue TCGdex (extrait réaliste des vraies réponses). */
export const FAKE_TCGDEX = {
  "/types": ["Eau", "Feu", "Plante", "Psy"],
  "/series": [
    { id: "swsh", name: "Épée et Bouclier", logo: "https://assets.tcgdex.net/fr/swsh/swsh1/logo" },
    { id: "sv", name: "Écarlate et Violet", logo: "https://assets.tcgdex.net/fr/sv/sv01/logo" },
    { id: "tcgp", name: "Jeu de Cartes à Collectionner Pokémon Pocket" },
  ],
  "/series/sv": {
    id: "sv",
    sets: [
      { id: "sv01", name: "Écarlate et Violet", logo: "https://assets.tcgdex.net/fr/sv/sv01/logo", cardCount: { official: 198 } },
      { id: "sv03.5", name: "151", cardCount: { official: 165 } },
    ],
  },
  "/series/swsh": { id: "swsh", sets: [{ id: "swsh3", name: "Ténèbres Embrasées", cardCount: { official: 189 } }] },
  "/series/tcgp": { id: "tcgp", sets: [{ id: "A1", name: "Puissance Génétique" }] },
  // Cartes (étape 3) : détail, et extensions avec leur série.
  "/sets": [
    { id: "sv01", name: "Écarlate et Violet", logo: "https://assets.tcgdex.net/fr/sv/sv01/logo" },
    { id: "sv03.5", name: "151", logo: "https://assets.tcgdex.net/fr/sv/sv03.5/logo" },
    { id: "swsh3", name: "Ténèbres Embrasées" },
  ],
  "/sets/sv01": { id: "sv01", name: "Écarlate et Violet", serie: { id: "sv", name: "Écarlate et Violet" } },
  "/sets/sv03.5": { id: "sv03.5", name: "151", serie: { id: "sv", name: "Écarlate et Violet" } },
  "/sets/swsh3": { id: "swsh3", name: "Ténèbres Embrasées", serie: { id: "swsh", name: "Épée et Bouclier" } },
  "/cards/sv03.5-006": {
    id: "sv03.5-006", localId: "006", name: "Dracaufeu-ex", category: "Pokémon", types: ["Feu"], rarity: "Double rare",
    image: "https://assets.tcgdex.net/fr/sv/sv03.5/006", set: { id: "sv03.5", name: "151", logo: "https://assets.tcgdex.net/fr/sv/sv03.5/logo" },
  },
  "/cards/sv03.5-007": {
    id: "sv03.5-007", localId: "007", name: "Carapuce", category: "Pokémon", types: ["Eau"], rarity: "Commune",
    image: "https://assets.tcgdex.net/fr/sv/sv03.5/007", set: { id: "sv03.5", name: "151" },
  },
  "/cards/sv01-196": {
    id: "sv01-196", localId: "196", name: "Hyper Ball", category: "Dresseur", trainerType: "Objet", rarity: "Peu Commune",
    set: { id: "sv01", name: "Écarlate et Violet" },
  },
  // Énergie sans « types » dans les données : type déduit du nom.
  "/cards/sv01-257": {
    id: "sv01-257", localId: "257", name: "Énergie Lightning de base", category: "Énergie", energyType: "De base",
    set: { id: "sv01", name: "Écarlate et Violet" },
  },
  "/cards/swsh3-020": {
    id: "swsh3-020", localId: "020", name: "Dracaufeu V", category: "Pokémon", types: ["Feu"], rarity: "Holo Rare V",
    set: { id: "swsh3", name: "Ténèbres Embrasées" },
  },
};

/** Fiches courtes renvoyées par la recherche /cards?name= (dont une Pocket). */
export const FAKE_SEARCH = [
  { id: "sv03.5-006", localId: "006", name: "Dracaufeu-ex", image: "https://assets.tcgdex.net/fr/sv/sv03.5/006" },
  { id: "swsh3-020", localId: "020", name: "Dracaufeu V" },
  { id: "A1-036", localId: "036", name: "Dracaufeu" },
  { id: "sv03.5-007", localId: "007", name: "Carapuce", image: "https://assets.tcgdex.net/fr/sv/sv03.5/007" },
];

/**
 * Remplace fetch : les URL TCGdex reçoivent le faux catalogue (404 si
 * absent), toutes les autres passent au vrai fetch. `down: true` simule
 * un TCGdex injoignable. Renvoie la liste des chemins TCGdex demandés.
 */
export function mockTcgdex({ down = false } = {}) {
  const calls = [];
  mock.method(globalThis, "fetch", async (url, options) => {
    const text = String(url);
    if (!text.startsWith("https://api.tcgdex.net/v2/fr")) return realFetch(url, options);
    const path = text.slice("https://api.tcgdex.net/v2/fr".length);
    calls.push(path);
    if (down) throw new TypeError("fetch failed");
    let body = FAKE_TCGDEX[path];
    if (path.startsWith("/cards?")) {
      // Recherche : nom partiel insensible à la casse, extension facultative.
      const params = new URLSearchParams(path.slice("/cards?".length));
      const name = (params.get("name") ?? "").toLowerCase();
      const setId = params.get("set.id");
      body = FAKE_SEARCH.filter(
        (card) => card.name.toLowerCase().includes(name) && (!setId || card.id.startsWith(`${setId}-`)),
      );
    }
    return body === undefined
      ? new Response(JSON.stringify({ status: 404 }), { status: 404 })
      : new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  return calls;
}
