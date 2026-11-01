import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { clearCatalogCache } from "../src/services/tcgdex.js";
import { authHeaders, mockTcgdex, newId, realFetch, startServer } from "./helpers.js";

// Routes /api/catalog (V2, étape 2). TCGdex est simulé : aucun appel réseau
// réel, aucune dépendance au contenu du vrai catalogue.
let server;
const user = newId();

test.before(async () => {
  server = await startServer();
});
test.after(() => server.close());
test.afterEach(() => {
  mock.restoreAll();
  clearCatalogCache();
});

const get = (path, headers = authHeaders(user)) => realFetch(server.base + path, { headers });

test("catalogue réservé aux utilisateurs connectés : 401 sans JWT", async () => {
  const calls = mockTcgdex();
  const r = await get("/api/catalog/series", {});
  assert.equal(r.status, 401);
  assert.equal(calls.length, 0);
});

test("séries : Pocket exclue, logos complétés en .png", async () => {
  mockTcgdex();
  const r = await get("/api/catalog/series");
  assert.equal(r.status, 200);
  const series = await r.json();
  assert.deepEqual(series.map((s) => s.id), ["swsh", "sv"]);
  assert.equal(series[1].logo, "https://assets.tcgdex.net/fr/sv/sv01/logo.png");
});

test("mémoire : deux demandes, un seul appel à TCGdex", async () => {
  const calls = mockTcgdex();
  await get("/api/catalog/types");
  const r = await get("/api/catalog/types");
  assert.deepEqual(await r.json(), ["Eau", "Feu", "Plante", "Psy"]);
  assert.deepEqual(calls, ["/types"]);
});

test("extensions d'une série : nom, logo (ou null), nombre de cartes", async () => {
  mockTcgdex();
  const r = await get("/api/catalog/series/sv/sets");
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), [
    { id: "sv01", name: "Écarlate et Violet", logo: "https://assets.tcgdex.net/fr/sv/sv01/logo.png", cardCount: 198 },
    { id: "sv03.5", name: "151", logo: null, cardCount: 165 },
  ]);
});

test("extensions : série inconnue, Pocket ou identifiant invalide -> 404", async () => {
  const calls = mockTcgdex();
  for (const id of ["zzz", "tcgp", "a%20b"]) {
    const r = await get(`/api/catalog/series/${id}/sets`);
    assert.equal(r.status, 404, id);
    assert.equal((await r.json()).message, "Série inconnue");
  }
  // Pocket et l'identifiant invalide sont refusés sans interroger TCGdex.
  assert.deepEqual(calls, ["/series/zzz"]);
});

test("TCGdex injoignable : 502 avec un message clair", async () => {
  mockTcgdex({ down: true });
  const r = await get("/api/catalog/types");
  assert.equal(r.status, 502);
  assert.equal((await r.json()).message, "Catalogue de cartes indisponible");
});
