import test, { mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Album } from "../src/models/Album.js";
import { Card } from "../src/models/Card.js";
import { Comment } from "../src/models/Comment.js";
import { Like } from "../src/models/Like.js";
import { Friendship, pairKey } from "../src/models/Friendship.js";
import { User } from "../src/models/User.js";
import { clearCatalogCache } from "../src/services/tcgdex.js";
import { authHeaders, mockTcgdex, newId, realFetch, startServer } from "./helpers.js";

// Routes /api/albums (V2, étape 2). Sans MongoDB : les méthodes des modèles
// sont simulées, et de vrais documents Album (non sauvegardés) servent de
// « base » pour profiter de leur méthode toPublic().
let server;
const alice = newId();
const bob = newId();

test.before(async () => {
  server = await startServer();
});
test.after(() => server.close());
test.afterEach(() => {
  mock.restoreAll();
  clearCatalogCache();
});

const call = (method, path, user, body) =>
  realFetch(server.base + path, {
    method,
    headers: authHeaders(user),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** Album en mémoire ; save() simulé. */
function fakeAlbum(fields) {
  const album = new Album({ title: "Mes Dracaufeu", ...fields });
  album.save = mock.fn(async () => album);
  return album;
}

/** Album.create simulé : renvoie le document construit, sans base. */
function mockCreate() {
  return mock.method(Album, "create", async (values) => fakeAlbum(values));
}

// ---------------------------------------------------------------- création

test("création : 201, propriétaire = token, privé par défaut, thème complété", async () => {
  mockTcgdex();
  const create = mockCreate();

  const r = await call("POST", "/api/albums", alice, {
    title: "  Mes Dracaufeu  ",
    theme: { type: "Feu", serieId: "sv", setId: "sv01" },
  });

  assert.equal(r.status, 201);
  const album = await r.json();
  assert.equal(album.title, "Mes Dracaufeu");
  assert.equal(album.visibility, "private");
  assert.equal(album.ownerId, alice);
  assert.deepEqual(album.theme, {
    type: "Feu",
    serie: { id: "sv", name: "Écarlate et Violet", logo: "https://assets.tcgdex.net/fr/sv/sv01/logo.png" },
    set: { id: "sv01", name: "Écarlate et Violet", logo: "https://assets.tcgdex.net/fr/sv/sv01/logo.png" },
  });
  // L'identité vient du token, jamais du corps de la requête.
  assert.equal(create.mock.calls[0].arguments[0].ownerId, alice);
});

test("création sans thème : collection libre, aucun appel au catalogue", async () => {
  const calls = mockTcgdex();
  mockCreate();

  const r = await call("POST", "/api/albums", alice, { title: "Vrac", visibility: "public" });

  assert.equal(r.status, 201);
  const album = await r.json();
  assert.deepEqual(album.theme, { type: null, serie: null, set: null });
  assert.equal(album.visibility, "public");
  assert.equal(calls.length, 0);
});

test("création refusée (400) pour chaque donnée invalide, rien n'est enregistré", async () => {
  mockTcgdex();
  const create = mockCreate();
  const cases = [
    [{}, "Titre requis (60 caractères maximum)"],
    [{ title: "   " }, "Titre requis (60 caractères maximum)"],
    [{ title: "x".repeat(61) }, "Titre requis (60 caractères maximum)"],
    [{ title: "A", description: "x".repeat(501) }, "Description trop longue (500 caractères maximum)"],
    [{ title: "A", visibility: "friends" }, "Visibilité invalide (private ou public)"],
    [{ title: "A", theme: { type: "Lumière" } }, "Type inconnu : Lumière"],
    [{ title: "A", theme: { setId: "sv01" } }, "Une extension nécessite de choisir sa série"],
    [{ title: "A", theme: { serieId: "tcgp" } }, "Série inconnue"],
    [{ title: "A", theme: { serieId: "zzz" } }, "Série inconnue"],
    [{ title: "A", theme: { serieId: "sv", setId: "swsh3" } }, "Extension inconnue pour cette série"],
  ];

  for (const [body, message] of cases) {
    const r = await call("POST", "/api/albums", alice, body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal((await r.json()).message, message, JSON.stringify(body));
  }
  assert.equal(create.mock.callCount(), 0);
});

test("création avec thème alors que TCGdex est injoignable : 502", async () => {
  mockTcgdex({ down: true });
  const create = mockCreate();

  const r = await call("POST", "/api/albums", alice, { title: "A", theme: { type: "Feu" } });

  assert.equal(r.status, 502);
  assert.equal(create.mock.callCount(), 0);
});

// ------------------------------------------------------------- Mes albums

test("mes albums : filtrés par propriétaire, triés, paginés et bornés", async () => {
  const queries = [];
  mock.method(Album, "find", (filter) => {
    const query = { filter };
    queries.push(query);
    const chain = {
      sort: (v) => ((query.sort = v), chain),
      skip: (v) => ((query.skip = v), chain),
      limit: async (v) => ((query.limit = v), [fakeAlbum({ ownerId: alice })]),
    };
    return chain;
  });
  mock.method(Album, "countDocuments", async () => 30);

  const r = await call("GET", "/api/albums/mine?page=2&limit=999", alice);

  assert.equal(r.status, 200);
  const page = await r.json();
  assert.deepEqual({ page: page.page, limit: page.limit, total: page.total, pages: page.pages }, { page: 2, limit: 48, total: 30, pages: 1 });
  assert.equal(page.items.length, 1);
  assert.deepEqual(queries[0], { filter: { ownerId: alice }, sort: { updatedAt: -1 }, skip: 48, limit: 48 });
});

// ------------------------------------------------------------ lecture

/** findById simulé sur un seul album ; CastError pour un id invalide. */
function mockFindById(album) {
  mock.method(Album, "findById", async (id) => {
    if (!mongoose.isValidObjectId(id)) throw new mongoose.Error.CastError("ObjectId", id, "_id");
    return album && String(album._id) === String(id) ? album : null;
  });
}

test("lecture : le propriétaire voit son album privé, avec le nom du propriétaire (relation self)", async () => {
  const album = fakeAlbum({ ownerId: alice, visibility: "private" });
  mockFindById(album);
  mock.method(User, "findById", async () => ({ name: "Alice" }));
  const findLink = mock.method(Friendship, "findOne", async () => null);

  const r = await call("GET", `/api/albums/${album.id}`, alice);

  assert.equal(r.status, 200);
  const body = await r.json();
  assert.deepEqual(body.owner, { id: alice, name: "Alice", relation: "self" });
  // Pas de lien d'amitié à chercher avec soi-même.
  assert.equal(findLink.mock.callCount(), 0);
});

test("lecture : album privé d'un autre -> 404 (indiscernable d'un album inexistant)", async () => {
  const album = fakeAlbum({ ownerId: alice, visibility: "private" });
  mockFindById(album);
  // Simulé aussi : si la règle d'accès cassait, la route irait jusqu'ici, et
  // le test échouerait immédiatement au lieu d'attendre une base absente.
  mock.method(User, "findById", async () => ({ name: "Alice" }));
  mock.method(Friendship, "findOne", async () => null);

  for (const id of [album.id, newId(), "pas-un-id"]) {
    const r = await call("GET", `/api/albums/${id}`, bob);
    assert.equal(r.status, 404, id);
  }
});

test("lecture : album public d'un autre -> 200, avec ma relation avec le propriétaire (étape 4)", async () => {
  const album = fakeAlbum({ ownerId: alice, visibility: "public" });
  mockFindById(album);
  mock.method(User, "findById", async () => ({ name: "Alice" }));
  const cases = [
    [null, "none"],
    [{ requester: bob, recipient: alice, status: "pending" }, "sent"],
    [{ requester: alice, recipient: bob, status: "pending" }, "received"],
    [{ requester: alice, recipient: bob, status: "accepted" }, "friend"],
  ];

  for (const [link, relation] of cases) {
    const findLink = mock.method(Friendship, "findOne", async () => link);
    const r = await call("GET", `/api/albums/${album.id}`, bob);
    assert.equal(r.status, 200);
    assert.deepEqual((await r.json()).owner, { id: alice, name: "Alice", relation }, relation);
    assert.deepEqual(findLink.mock.calls[0].arguments[0], { pair: pairKey(alice, bob) });
  }
});

// ------------------------------------------------------- modification

test("modification partielle par le propriétaire : seul le champ envoyé change", async () => {
  const calls = mockTcgdex();
  const album = fakeAlbum({ ownerId: alice, title: "Avant", theme: { type: "Feu" } });
  mockFindById(album);

  const r = await call("PUT", `/api/albums/${album.id}`, alice, { visibility: "public" });

  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.visibility, "public");
  assert.equal(body.title, "Avant");
  assert.equal(body.theme.type, "Feu");
  assert.equal(album.save.mock.callCount(), 1);
  // Thème non envoyé : pas de revalidation auprès du catalogue.
  assert.equal(calls.length, 0);
});

test("modification d'un album public d'un autre : 404, rien n'est enregistré", async () => {
  const album = fakeAlbum({ ownerId: alice, visibility: "public" });
  mockFindById(album);

  const r = await call("PUT", `/api/albums/${album.id}`, bob, { title: "Piraté" });

  assert.equal(r.status, 404);
  assert.equal(album.save.mock.callCount(), 0);
  assert.equal(album.title, "Mes Dracaufeu");
});

test("modification invalide (titre vide) : 400", async () => {
  const album = fakeAlbum({ ownerId: alice });
  mockFindById(album);

  const r = await call("PUT", `/api/albums/${album.id}`, alice, { title: "" });

  assert.equal(r.status, 400);
  assert.equal(album.save.mock.callCount(), 0);
});

// ---------------------------------------------------------- suppression

test("suppression : filtre { _id, ownerId du token } -> 204 pour le propriétaire, 404 sinon", async () => {
  const album = fakeAlbum({ ownerId: alice });
  const deleteCall = mock.method(Album, "findOneAndDelete", async (filter) =>
    String(filter._id) === album.id && String(filter.ownerId) === alice ? album : null,
  );
  // Album sans carte (la suppression en cascade est testée dans cards.test.js).
  mock.method(Card, "find", () => ({ select: async () => [] }));
  mock.method(Card, "deleteMany", async () => ({ deletedCount: 0 }));
  mock.method(Like, "deleteMany", async () => ({ deletedCount: 0 }));
  mock.method(Comment, "deleteMany", async () => ({ deletedCount: 0 }));

  const byBob = await call("DELETE", `/api/albums/${album.id}`, bob);
  const byAlice = await call("DELETE", `/api/albums/${album.id}`, alice);

  assert.equal(byBob.status, 404);
  assert.equal(byAlice.status, 204);
  assert.equal(deleteCall.mock.calls[0].arguments[0].ownerId, bob);
});
