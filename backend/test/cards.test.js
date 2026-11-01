import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import sharp from "sharp";
import { UPLOADS } from "../src/config.js";
import { Album } from "../src/models/Album.js";
import { Card } from "../src/models/Card.js";
import { User } from "../src/models/User.js";
import { clearCatalogCache } from "../src/services/tcgdex.js";
import { deletePhotoFiles, MAX_PHOTO_SIZE, verifyImageSignature } from "../src/services/images.js";
import { authHeaders, mockTcgdex, newId, realFetch, startServer, tokenFor } from "./helpers.js";

// Cartes, photos et images signées (V2, étape 3). Sans MongoDB (modèles
// simulés) ni vrai TCGdex (faux catalogue de helpers.js) ; les photos sont
// de vraies images traitées par sharp, supprimées après chaque test.
let server;
const alice = newId();
const bob = newId();
let jpeg;
const written = [];

test.before(async () => {
  server = await startServer();
  jpeg = await sharp({ create: { width: 630, height: 880, channels: 3, background: "#c9a24d" } }).jpeg().toBuffer();
});
test.after(() => server.close());
test.afterEach(async () => {
  mock.restoreAll();
  clearCatalogCache();
  for (const photo of written.splice(0)) await deletePhotoFiles(photo);
});

const get = (urlPath, user) => realFetch(server.base + urlPath, { headers: user ? authHeaders(user) : {} });

function fakeAlbum(fields) {
  const album = new Album({ title: "Classeur", ownerId: alice, ...fields });
  album.save = mock.fn(async () => album);
  return album;
}
function mockAlbum(album) {
  mock.method(Album, "findById", async (id) => (String(id) === album.id ? album : null));
  return mock.method(Album, "updateOne", async () => ({ modifiedCount: 1 }));
}
/** Card.create simulé : vrai document non sauvegardé, fichiers mémorisés pour nettoyage. */
function mockCardCreate() {
  return mock.method(Card, "create", async (values) => {
    written.push(values.photo);
    return new Card(values);
  });
}
function postCard(albumId, user, { tcgdexId, photo = jpeg, type = "image/jpeg", crop, rotation } = {}) {
  const body = new FormData();
  if (tcgdexId !== undefined) body.append("tcgdexId", tcgdexId);
  if (crop !== undefined) body.append("crop", crop);
  if (rotation !== undefined) body.append("rotation", rotation);
  if (photo) body.append("photo", new Blob([photo], { type }), "carte.jpg");
  return realFetch(`${server.base}/api/albums/${albumId}/cards`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFor(user)}` },
    body,
  });
}
const uploadsCount = () => fs.readdirSync(UPLOADS).length;

// ------------------------------------------------------------- recherche

test("recherche : 2 caractères minimum", async () => {
  mockTcgdex();
  const r = await get("/api/catalog/cards?name=d", alice);
  assert.equal(r.status, 400);
});

test("recherche : nom de l'extension ajouté, Pocket retirée, vignette officielle", async () => {
  mockTcgdex();
  const r = await get("/api/catalog/cards?name=dracau", alice);
  assert.equal(r.status, 200);
  const cards = await r.json();
  assert.deepEqual(cards.map((c) => c.id), ["sv03.5-006", "swsh3-020"]);
  assert.equal(cards[0].set.name, "151");
  assert.equal(cards[0].image, "https://assets.tcgdex.net/fr/sv/sv03.5/006/low.webp");
  assert.equal(cards[1].image, null);
  assert.ok(cards.every((c) => c.compatible));
});

test("recherche pour un album de série : incompatibles marquées (pas masquées)", async () => {
  mockTcgdex();
  const album = fakeAlbum({ theme: { serie: { id: "sv", name: "Écarlate et Violet" } } });
  mockAlbum(album);
  const cards = await (await get(`/api/catalog/cards?name=dracau&albumId=${album.id}`, alice)).json();
  assert.deepEqual(
    cards.map((c) => [c.id, c.compatible, c.reason]),
    [
      ["sv03.5-006", true, null],
      ["swsh3-020", false, "Hors de la série Écarlate et Violet"],
    ],
  );
});

test("recherche : cartes compatibles en tête de liste, ordre TCGdex conservé ensuite", async () => {
  mockTcgdex();
  // TCGdex renvoie sv03.5-006 avant swsh3-020 ; pour un album Épée et
  // Bouclier, la seule carte acceptée (swsh3-020) doit passer en premier.
  const album = fakeAlbum({ theme: { serie: { id: "swsh", name: "Épée et Bouclier" } } });
  mockAlbum(album);
  const cards = await (await get(`/api/catalog/cards?name=dracau&albumId=${album.id}`, alice)).json();
  assert.deepEqual(cards.map((c) => [c.id, c.compatible]), [["swsh3-020", true], ["sv03.5-006", false]]);
});

test("recherche pour un album d'extension : filtre transmis à TCGdex", async () => {
  const calls = mockTcgdex();
  const album = fakeAlbum({ theme: { serie: { id: "sv" }, set: { id: "sv03.5", name: "151" } } });
  mockAlbum(album);
  const cards = await (await get(`/api/catalog/cards?name=dracau&albumId=${album.id}`, alice)).json();
  assert.deepEqual(cards.map((c) => c.id), ["sv03.5-006"]);
  assert.ok(calls.some((p) => p.startsWith("/cards?") && p.includes("set.id=sv03.5")));
});

test("recherche avec l'album d'un autre : 404", async () => {
  mockTcgdex();
  const album = fakeAlbum({ ownerId: alice });
  mockAlbum(album);
  const r = await get(`/api/catalog/cards?name=dracau&albumId=${album.id}`, bob);
  assert.equal(r.status, 404);
});

// ---------------------------------------------------------------- détail

test("détail : fiche calculée (Énergie typée par son nom) et verdict pour l'album", async () => {
  mockTcgdex();
  const album = fakeAlbum({ theme: { type: "Feu" } });
  mockAlbum(album);

  const energy = await (await get(`/api/catalog/cards/sv01-257?albumId=${album.id}`, alice)).json();
  assert.deepEqual(energy.types, ["Électrique"]);
  assert.equal(energy.subCategory, "De base");
  assert.deepEqual(energy.serie, { id: "sv", name: "Écarlate et Violet" });
  assert.equal(energy.verdict.compatible, false);

  const trainer = await (await get(`/api/catalog/cards/sv01-196?albumId=${album.id}`, alice)).json();
  assert.equal(trainer.verdict.compatible, true);
});

test("détail : carte inconnue ou Pocket -> 404", async () => {
  mockTcgdex();
  for (const id of ["zz-999", "A1-036"]) {
    const r = await get(`/api/catalog/cards/${id}`, alice);
    assert.equal(r.status, 404, id);
  }
});

// ----------------------------------------------------------------- ajout

test("ajout : 201, fiche recopiée, photo traitée, URL signées sans nom de fichier", async () => {
  mockTcgdex();
  const album = fakeAlbum({ theme: { type: "Feu", serie: { id: "sv", name: "EV" } } });
  const updateOne = mockAlbum(album);
  const create = mockCardCreate();

  const r = await postCard(album.id, alice, { tcgdexId: "sv03.5-006" });

  assert.equal(r.status, 201);
  const card = await r.json();
  assert.equal(card.name, "Dracaufeu-ex");
  assert.deepEqual(card.types, ["Feu"]);
  assert.equal(card.set.name, "151");
  assert.equal(card.officialImage.large, "https://assets.tcgdex.net/fr/sv/sv03.5/006/high.webp");
  // Propriétaire = token ; fichiers bien écrits ; compteur incrémenté.
  const values = create.mock.calls[0].arguments[0];
  assert.equal(String(values.ownerId), alice);
  assert.ok(fs.existsSync(path.join(UPLOADS, values.photo.thumb)));
  assert.deepEqual(updateOne.mock.calls[0].arguments[1], { $inc: { cardCount: 1 } });
  // URL signées valides, sans révéler les noms de fichiers sur le disque.
  const thumb = new URL(card.photo.thumb, "http://x");
  assert.equal(thumb.pathname, `/api/images/${card.id}/thumb`);
  assert.ok(verifyImageSignature(card.id, "thumb", thumb.searchParams.get("exp"), thumb.searchParams.get("sig")));
  assert.ok(!JSON.stringify(card).includes(values.photo.thumb));
});

test("ajout refusé (thème) : 400 avec la raison, aucun fichier écrit", async () => {
  mockTcgdex();
  const album = fakeAlbum({ theme: { type: "Feu" } });
  mockAlbum(album);
  const create = mockCardCreate();
  const before = uploadsCount();

  const r = await postCard(album.id, alice, { tcgdexId: "sv03.5-007" });

  assert.equal(r.status, 400);
  assert.equal((await r.json()).message, "Type Eau : l'album est réservé au type Feu");
  assert.equal(create.mock.callCount(), 0);
  assert.equal(uploadsCount(), before);
});

test("ordre des contrôles : le thème est vérifié AVANT de traiter la photo", async () => {
  mockTcgdex();
  const album = fakeAlbum({ theme: { type: "Feu" } });
  mockAlbum(album);
  // Carte hors thème ET fichier invalide : si la photo était traitée en
  // premier, le message parlerait de l'image (travail inutile pour une
  // carte de toute façon refusée).
  const r = await postCard(album.id, alice, { tcgdexId: "sv03.5-007", photo: Buffer.from("pas une image") });
  assert.equal((await r.json()).message, "Type Eau : l'album est réservé au type Feu");
});

test("ajout refusé (400) : sans photo, carte inconnue, fichier qui n'est pas une image", async () => {
  mockTcgdex();
  const album = fakeAlbum({});
  mockAlbum(album);
  const create = mockCardCreate();
  const before = uploadsCount();
  const cases = [
    [{ tcgdexId: "sv03.5-006", photo: null }, "Photo de la carte requise"],
    [{ tcgdexId: "zz-999" }, "Carte inconnue"],
    [{ tcgdexId: undefined }, "Carte inconnue"],
    [{ tcgdexId: "sv03.5-006", photo: Buffer.from("pas une image"), type: "image/jpeg" }, "Le fichier n'est pas une image valide (JPEG, PNG ou WebP)"],
  ];
  for (const [options, message] of cases) {
    const r = await postCard(album.id, alice, options);
    assert.equal(r.status, 400, message);
    assert.equal((await r.json()).message, message);
  }
  assert.equal(create.mock.callCount(), 0);
  assert.equal(uploadsCount(), before);
});

test("ajout avec recadrage : la photo enregistrée a la taille du cadre", async () => {
  mockTcgdex();
  const album = fakeAlbum({});
  mockAlbum(album);
  mockCardCreate();

  const r = await postCard(album.id, alice, { tcgdexId: "sv03.5-006", crop: JSON.stringify({ x: 15, y: 20, width: 315, height: 440 }) });

  assert.equal(r.status, 201);
  const meta = await sharp(fs.readFileSync(path.join(UPLOADS, written[0].full))).metadata();
  assert.deepEqual([meta.width, meta.height], [315, 440]);
});

test("ajout avec recadrage invalide : 400, aucun fichier écrit, rien d'enregistré", async () => {
  mockTcgdex();
  const album = fakeAlbum({});
  mockAlbum(album);
  const create = mockCardCreate();
  const before = uploadsCount();
  // La photo de test fait 630×880 : ce cadre déborde.
  for (const options of [{ crop: JSON.stringify({ x: 400, y: 0, width: 315, height: 440 }) }, { crop: "{" }, { rotation: "7" }]) {
    const r = await postCard(album.id, alice, { tcgdexId: "sv03.5-006", ...options });
    assert.equal(r.status, 400, JSON.stringify(options));
    assert.equal((await r.json()).message, "Recadrage invalide");
  }
  assert.equal(create.mock.callCount(), 0);
  assert.equal(uploadsCount(), before);
});

test("ajout refusé : photo de plus de 10 Mo (400)", async () => {
  mockTcgdex();
  const album = fakeAlbum({});
  mockAlbum(album);
  const r = await postCard(album.id, alice, { tcgdexId: "sv03.5-006", photo: Buffer.alloc(MAX_PHOTO_SIZE + 1) });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).message, "Photo trop volumineuse (10 Mo maximum)");
});

test("ajout dans l'album d'un autre (même public) : 404, rien de traité", async () => {
  const calls = mockTcgdex();
  const album = fakeAlbum({ ownerId: alice, visibility: "public" });
  mockAlbum(album);
  const create = mockCardCreate();

  const r = await postCard(album.id, bob, { tcgdexId: "sv03.5-006" });

  assert.equal(r.status, 404);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(calls.length, 0, "aucune requête au catalogue");
});

// ------------------------------------------------------------ classeur

function mockCardList(cards) {
  const queries = [];
  mock.method(Card, "find", (filter) => {
    const query = { filter };
    queries.push(query);
    const chain = {
      sort: (v) => ((query.sort = v), chain),
      skip: (v) => ((query.skip = v), chain),
      limit: async (v) => ((query.limit = v), cards),
    };
    return chain;
  });
  mock.method(Card, "countDocuments", async () => cards.length);
  return queries;
}
const storedCard = (fields = {}) =>
  new Card({ albumId: newId(), ownerId: alice, tcgdexId: "sv03.5-006", name: "Dracaufeu-ex", category: "Pokémon", types: ["Feu"], photo: { thumb: "t.webp", full: "f.webp" }, ...fields });

test("classeur : page de 9 par défaut, ordre d'ajout, URL signées", async () => {
  const album = fakeAlbum({ visibility: "private" });
  mockAlbum(album);
  const queries = mockCardList([storedCard({ albumId: album._id })]);

  const page = await (await get(`/api/albums/${album.id}/cards?page=2`, alice)).json();

  assert.deepEqual(queries[0], { filter: { albumId: album._id }, sort: { createdAt: 1 }, skip: 9, limit: 9 });
  assert.match(page.items[0].photo.thumb, /^\/api\/images\/[0-9a-f]{24}\/thumb\?exp=\d+&sig=/);
});

test("classeur : filtre par catégorie ; catégorie inconnue -> 400", async () => {
  const album = fakeAlbum({});
  mockAlbum(album);
  const queries = mockCardList([]);

  await get(`/api/albums/${album.id}/cards?category=${encodeURIComponent("Dresseur")}`, alice);
  assert.equal(queries[0].filter.category, "Dresseur");
  const r = await get(`/api/albums/${album.id}/cards?category=Objet`, alice);
  assert.equal(r.status, 400);
});

test("classeur d'un album privé d'un autre : 404 (aucune URL délivrée)", async () => {
  const album = fakeAlbum({ ownerId: alice, visibility: "private" });
  mockAlbum(album);
  const queries = mockCardList([storedCard()]);

  const r = await get(`/api/albums/${album.id}/cards`, bob);

  assert.equal(r.status, 404);
  assert.equal(queries.length, 0);
});

// ------------------------------------------------------------- images

test("image : URL signée -> 200 image/webp en cache privé ; modifiée -> 403", async () => {
  mockTcgdex();
  const album = fakeAlbum({});
  mockAlbum(album);
  mockCardCreate();
  const card = await (await postCard(album.id, alice, { tcgdexId: "sv03.5-006" })).json();
  const stored = written[0];
  mock.method(Card, "findById", (id) => ({
    select: async () => (id === card.id ? { photo: stored } : null),
  }));

  // Pas de JWT : c'est la signature qui fait foi.
  const ok = await realFetch(server.base + card.photo.thumb);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/webp");
  assert.match(ok.headers.get("cache-control"), /^private, max-age=\d+$/);
  assert.equal((await sharp(Buffer.from(await ok.arrayBuffer())).metadata()).format, "webp");

  const forged = card.photo.thumb.replace("/thumb?", "/full?");
  assert.equal((await realFetch(server.base + forged)).status, 403);
  const noSig = card.photo.thumb.split("?")[0];
  assert.equal((await realFetch(server.base + noSig)).status, 403);
});

// ---------------------------------------------------------- suppressions

test("suppression d'une carte : propriétaire seulement, fichiers effacés, compteur décrémenté", async () => {
  mockTcgdex();
  const album = fakeAlbum({});
  const updateOne = mockAlbum(album);
  mockCardCreate();
  const card = await (await postCard(album.id, alice, { tcgdexId: "sv03.5-006" })).json();
  const stored = written[0];
  const deleteCall = mock.method(Card, "findOneAndDelete", (filter) => ({
    select: async () =>
      String(filter._id) === card.id && String(filter.ownerId) === alice
        ? { id: card.id, albumId: album._id, photo: stored }
        : null,
  }));

  const byBob = await realFetch(`${server.base}/api/cards/${card.id}`, { method: "DELETE", headers: authHeaders(bob) });
  assert.equal(byBob.status, 404);
  assert.ok(fs.existsSync(path.join(UPLOADS, stored.thumb)));

  const byAlice = await realFetch(`${server.base}/api/cards/${card.id}`, { method: "DELETE", headers: authHeaders(alice) });
  assert.equal(byAlice.status, 204);
  assert.equal(fs.existsSync(path.join(UPLOADS, stored.thumb)), false);
  assert.equal(fs.existsSync(path.join(UPLOADS, stored.full)), false);
  assert.deepEqual(updateOne.mock.calls.at(-1).arguments[1], { $inc: { cardCount: -1 } });
  assert.equal(String(deleteCall.mock.calls[0].arguments[0].ownerId), bob);
});

test("suppression d'un album : ses cartes et leurs fichiers aussi", async () => {
  mockTcgdex();
  const album = fakeAlbum({});
  mockAlbum(album);
  mockCardCreate();
  await postCard(album.id, alice, { tcgdexId: "sv03.5-006" });
  const stored = written[0];
  mock.method(Album, "findOneAndDelete", async () => album);
  mock.method(Card, "find", () => ({ select: async () => [{ photo: stored }] }));
  const deleteMany = mock.method(Card, "deleteMany", async () => ({ deletedCount: 1 }));

  const r = await realFetch(`${server.base}/api/albums/${album.id}`, { method: "DELETE", headers: authHeaders(alice) });

  assert.equal(r.status, 204);
  assert.deepEqual(deleteMany.mock.calls[0].arguments[0], { albumId: album._id });
  assert.equal(fs.existsSync(path.join(UPLOADS, stored.thumb)), false);
});

// ------------------------------------------------- changement de thème

test("changement de thème : refusé (409) si des cartes ne le respectent plus, accepté sinon", async () => {
  mockTcgdex();
  const album = fakeAlbum({ cardCount: 2 });
  mockAlbum(album);
  mock.method(Card, "find", () => ({
    select: async () => [
      { name: "Dracaufeu-ex", category: "Pokémon", types: ["Feu"], set: { id: "sv03.5" }, serie: { id: "sv" } },
      { name: "Hyper Ball", category: "Dresseur", types: [], set: { id: "sv01" }, serie: { id: "sv" } },
    ],
  }));
  mock.method(User, "findById", async () => ({ name: "Alice" }));

  const put = (theme) =>
    realFetch(`${server.base}/api/albums/${album.id}`, { method: "PUT", headers: authHeaders(alice), body: JSON.stringify({ theme }) });

  const refused = await put({ type: "Eau" });
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).message, "Thème refusé : 1 carte(s) de l'album ne le respectent pas (ex. Dracaufeu-ex)");
  assert.equal(album.save.mock.callCount(), 0);

  const accepted = await put({ type: "Feu", serieId: "sv" });
  assert.equal(accepted.status, 200);
  assert.equal(album.save.mock.callCount(), 1);
});
