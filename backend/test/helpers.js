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
};

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
    const body = FAKE_TCGDEX[path];
    return body === undefined
      ? new Response(JSON.stringify({ status: 404 }), { status: 404 })
      : new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  return calls;
}
