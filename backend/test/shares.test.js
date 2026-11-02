import test, { mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { canView, isSharedWith } from "../src/access.js";
import { Album } from "../src/models/Album.js";
import { Friendship, pairKey } from "../src/models/Friendship.js";
import { User } from "../src/models/User.js";
import { authHeaders, newId, realFetch, startServer } from "./helpers.js";

// Partage des albums privés avec des amis (V2, étape 5). Sans MongoDB :
// méthodes des modèles simulées, vrais documents Album non sauvegardés.
let server;
const alice = newId();
const bob = newId();
const carol = newId();
const dave = newId();

test.before(async () => {
  server = await startServer();
});
test.after(() => server.close());
test.afterEach(() => mock.restoreAll());

const call = (method, path, user, body) =>
  realFetch(server.base + path, {
    method,
    headers: authHeaders(user),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

function fakeAlbum(fields) {
  const album = new Album({ title: "Mes Psy", ownerId: alice, visibility: "private", ...fields });
  album.save = mock.fn(async () => album);
  return album;
}

function mockFindById(album) {
  mock.method(Album, "findById", async (id) => {
    if (!mongoose.isValidObjectId(id)) throw new mongoose.Error.CastError("ObjectId", id, "_id");
    return String(album._id) === String(id) ? album : null;
  });
}

const NAMES = { [alice]: "Alice", [bob]: "Bob", [carol]: "Carol", [dave]: "Dave" };

/** Amis d'Alice : Carol et Bob (Dave n'est pas son ami). Utilisateurs avec email. */
function mockFriendsOfAlice() {
  mock.method(Friendship, "find", async () => [
    new Friendship({ requester: alice, recipient: carol, status: "accepted", pair: pairKey(alice, carol) }),
    new Friendship({ requester: bob, recipient: alice, status: "accepted", pair: pairKey(alice, bob) }),
  ]);
  mock.method(User, "find", async (filter) =>
    filter._id.$in.map(String).map((id) => new User({ _id: id, name: NAMES[id], email: `${id}@example.com` })),
  );
}

// ------------------------------------------------------- règle d'accès

test("canView : album privé visible par les amis avec qui il est partagé, pas par les autres", () => {
  const album = { ownerId: new mongoose.Types.ObjectId(alice), visibility: "private", sharedWith: [new mongoose.Types.ObjectId(bob)] };
  assert.equal(isSharedWith(album, bob), true);
  assert.equal(canView(album, bob), true);
  assert.equal(canView(album, carol), false);
  assert.equal(canView(album, alice), true);
  assert.equal(canView({ ...album, sharedWith: [] }, bob), false, "partage arrêté");
  assert.equal(canView({ ...album, sharedWith: undefined }, bob), false);
  assert.equal(isSharedWith(null, bob), false);
});

test("toPublic : sharedCount pour le propriétaire seulement, jamais la liste", () => {
  const album = fakeAlbum({ sharedWith: [bob, carol] });
  assert.equal(album.toPublic(alice).sharedCount, 2);
  assert.equal(album.toPublic(bob).sharedCount, null);
  assert.equal(album.toPublic().sharedCount, null);
  assert.equal("sharedWith" in album.toPublic(alice), false);
});

// ------------------------------------------------------- lecture

test("lecture d'un album privé partagé : 200 pour l'ami destinataire, 404 pour les autres et après l'arrêt", async () => {
  const album = fakeAlbum({ sharedWith: [bob] });
  mockFindById(album);
  mock.method(User, "findById", async () => ({ name: "Alice" }));
  mock.method(Friendship, "findOne", async () => null);

  const r = await call("GET", `/api/albums/${album.id}`, bob);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).sharedCount, null, "le destinataire ne voit pas le partage");
  assert.equal((await call("GET", `/api/albums/${album.id}`, carol)).status, 404);

  album.sharedWith = [];
  assert.equal((await call("GET", `/api/albums/${album.id}`, bob)).status, 404);
});

// ------------------------------------------------------- liste de partage

test("liste de partage : mes amis par ordre alphabétique, cochés s'ils reçoivent l'album, sans email", async () => {
  const album = fakeAlbum({ sharedWith: [carol] });
  mockFindById(album);
  mockFriendsOfAlice();

  const r = await call("GET", `/api/albums/${album.id}/shares`, alice);

  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), [
    { user: { id: bob, name: "Bob" }, shared: false },
    { user: { id: carol, name: "Carol" }, shared: true },
  ]);
});

test("liste de partage : réservée au propriétaire (404, même pour un destinataire)", async () => {
  const album = fakeAlbum({ sharedWith: [bob] });
  mockFindById(album);
  mockFriendsOfAlice();

  for (const id of [album.id, newId(), "pas-un-id"]) {
    assert.equal((await call("GET", `/api/albums/${id}/shares`, bob)).status, 404, id);
  }
});

// ------------------------------------------------------- partager

test("partager : la liste est remplacée (doublons retirés), sharedCount renvoyé", async () => {
  const album = fakeAlbum({ sharedWith: [carol] });
  mockFindById(album);
  mockFriendsOfAlice();

  const r = await call("PUT", `/api/albums/${album.id}/shares`, alice, { userIds: [bob, bob] });

  assert.equal(r.status, 200);
  assert.equal((await r.json()).sharedCount, 1);
  assert.deepEqual(album.sharedWith.map(String), [bob]);
  assert.equal(album.save.mock.callCount(), 1);
});

test("arrêter tous les partages : liste vide -> sharedCount 0", async () => {
  const album = fakeAlbum({ sharedWith: [bob, carol] });
  mockFindById(album);
  mockFriendsOfAlice();

  const r = await call("PUT", `/api/albums/${album.id}/shares`, alice, { userIds: [] });

  assert.equal(r.status, 200);
  assert.equal((await r.json()).sharedCount, 0);
  assert.deepEqual(album.sharedWith, []);
});

test("partager refusé : avec un non-ami ou soi-même (400), corps invalide (400), rien enregistré", async () => {
  const album = fakeAlbum({ sharedWith: [] });
  mockFindById(album);
  mockFriendsOfAlice();

  for (const body of [{ userIds: [bob, dave] }, { userIds: [alice] }, {}, { userIds: bob }, { userIds: [42] }]) {
    const r = await call("PUT", `/api/albums/${album.id}/shares`, alice, body);
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  assert.equal(album.save.mock.callCount(), 0);
  assert.deepEqual(album.sharedWith, []);
});

test("partager l'album d'un autre : 404, même pour un destinataire du partage", async () => {
  const album = fakeAlbum({ sharedWith: [bob] });
  mockFindById(album);
  mockFriendsOfAlice();

  const r = await call("PUT", `/api/albums/${album.id}/shares`, bob, { userIds: [] });

  assert.equal(r.status, 404);
  assert.equal(album.save.mock.callCount(), 0);
});

// ------------------------------------------------------- partagés avec moi

test("partagés avec moi : albums privés où je figure, plus récents d'abord, avec le propriétaire", async () => {
  const queries = [];
  const albums = [fakeAlbum({ ownerId: alice, sharedWith: [bob, carol] }), fakeAlbum({ ownerId: carol, title: "Feu", sharedWith: [bob] })];
  mock.method(Album, "find", (filter) => {
    const query = { filter };
    queries.push(query);
    const chain = {
      sort: (v) => ((query.sort = v), chain),
      skip: (v) => ((query.skip = v), chain),
      limit: async (v) => ((query.limit = v), albums),
    };
    return chain;
  });
  mock.method(Album, "countDocuments", async () => 2);
  mock.method(User, "find", async (filter) => filter._id.$in.map((id) => new User({ _id: id, name: NAMES[id], email: "x@example.com" })));

  const r = await call("GET", "/api/albums/shared?page=1&limit=12", bob);

  assert.equal(r.status, 200);
  const page = await r.json();
  assert.deepEqual(queries[0], { filter: { visibility: "private", sharedWith: bob }, sort: { updatedAt: -1 }, skip: 0, limit: 12 });
  assert.equal(page.total, 2);
  assert.deepEqual(page.items.map((a) => a.owner), [{ id: alice, name: "Alice" }, { id: carol, name: "Carol" }]);
  assert.deepEqual(page.items.map((a) => a.sharedCount), [null, null], "le destinataire ne voit pas les autres destinataires");
  assert.equal(JSON.stringify(page).includes("@"), false);
});

test("routes de partage : 401 sans token", async () => {
  for (const [method, path] of [
    ["GET", "/api/albums/shared"],
    ["GET", `/api/albums/${newId()}/shares`],
    ["PUT", `/api/albums/${newId()}/shares`],
  ]) {
    assert.equal((await realFetch(server.base + path, { method })).status, 401, `${method} ${path}`);
  }
});
