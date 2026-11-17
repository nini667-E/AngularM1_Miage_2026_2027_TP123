import test, { mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { visibleAlbumsFilter } from "../src/access.js";
import { Album } from "../src/models/Album.js";
import { Friendship, pairKey } from "../src/models/Friendship.js";
import { User } from "../src/models/User.js";
import { readProfileInput } from "../src/routes/profiles.js";
import { publicUser, publicUsers } from "../src/services/friends.js";
import { clearCatalogCache } from "../src/services/tcgdex.js";
import { authHeaders, mockTcgdex, newId, realFetch, startServer } from "./helpers.js";

// Profils (V2, étape 8) : mon profil (pseudo, bio, avatar = une carte) et la
// page publique d'un collectionneur. Sans MongoDB ni vrai TCGdex.
let server;
const alice = newId();
const bob = newId();
const DRACAUFEU = "https://assets.tcgdex.net/fr/sv/sv03.5/006";

test.before(async () => {
  server = await startServer();
});
test.after(() => server.close());
test.afterEach(() => {
  mock.restoreAll();
  clearCatalogCache();
});

const call = (method, path, user, body) =>
  realFetch(server.base + path, { method, headers: authHeaders(user), body: body === undefined ? undefined : JSON.stringify(body) });

const userDoc = (id, fields = {}) =>
  new User({ _id: id, name: "Bob", email: "bob@example.com", bio: "Collectionneur de Psy", createdAt: new Date("2026-11-01"), ...fields });

// ------------------------------------------------------- mon profil

test("readProfileInput : seuls les champs envoyés, nettoyés et bornés", async () => {
  assert.deepEqual(await readProfileInput({}), {});
  assert.deepEqual(await readProfileInput({ name: "  Sacha  ", bio: "  Fan de Psy  " }), { name: "Sacha", bio: "Fan de Psy" });
  assert.deepEqual(await readProfileInput({ bio: "" }), { bio: "" });
  assert.deepEqual(await readProfileInput({ avatarId: null }), { avatar: null });
  for (const body of [{ name: "S" }, { name: "x".repeat(31) }, { name: 42 }, { bio: "x".repeat(301) }, { bio: 42 }]) {
    await assert.rejects(readProfileInput(body), { status: 400 }, JSON.stringify(body).slice(0, 30));
  }
});

test("readProfileInput : avatar = une carte du catalogue avec illustration, sinon 400", async () => {
  mockTcgdex();
  assert.deepEqual(await readProfileInput({ avatarId: "sv03.5-006" }), {
    avatar: { tcgdexId: "sv03.5-006", name: "Dracaufeu-ex", image: DRACAUFEU },
  });
  // Hyper Ball n'a pas d'image dans le faux catalogue ; une carte inconnue ou Pocket est refusée.
  await assert.rejects(readProfileInput({ avatarId: "sv01-196" }), { status: 400, message: "Cette carte n'a pas d'illustration officielle" });
  for (const avatarId of ["xx-000", "A1-001", 42, "../etc"]) {
    await assert.rejects(readProfileInput({ avatarId }), { status: 400 }, String(avatarId));
  }
});

test("PUT /users/me : pseudo, bio et avatar enregistrés pour l'utilisateur du token", async () => {
  mockTcgdex();
  const update = mock.method(User, "findByIdAndUpdate", async (id, changes) =>
    userDoc(id, { name: "Alice", email: "alice@example.com", ...changes.$set }),
  );

  const r = await call("PUT", "/api/users/me", alice, { name: "Alice", bio: "Fan de Feu", avatarId: "sv03.5-006" });

  assert.equal(r.status, 200);
  const me = await r.json();
  const [id, changes, options] = update.mock.calls[0].arguments;
  assert.equal(id, alice);
  assert.deepEqual(changes.$set.avatar, { tcgdexId: "sv03.5-006", name: "Dracaufeu-ex", image: DRACAUFEU });
  assert.equal(options.runValidators, true);
  assert.deepEqual([me.name, me.bio, me.email], ["Alice", "Fan de Feu", "alice@example.com"]);
  assert.deepEqual(me.avatar, { tcgdexId: "sv03.5-006", name: "Dracaufeu-ex", image: `${DRACAUFEU}/low.webp` });
});

test("PUT /users/me : données invalides -> 400, rien enregistré", async () => {
  const update = mock.method(User, "findByIdAndUpdate", async () => userDoc(alice));
  for (const body of [{ name: "" }, { bio: "x".repeat(301) }]) {
    assert.equal((await call("PUT", "/api/users/me", alice, body)).status, 400, JSON.stringify(body).slice(0, 20));
  }
  assert.equal(update.mock.callCount(), 0);
});

test("identité publique : avatar (URL) seulement s'il existe, jamais d'email", () => {
  assert.deepEqual(publicUser(userDoc(bob)), { id: bob, name: "Bob" });
  assert.deepEqual(publicUser(userDoc(bob, { avatar: { tcgdexId: "sv03.5-006", name: "Dracaufeu-ex", image: DRACAUFEU } })), {
    id: bob,
    name: "Bob",
    avatar: `${DRACAUFEU}/low.webp`,
  });
});

test("publicUsers : lit le pseudo ET l'avatar en base, dans l'ordre demandé", async () => {
  const find = mock.method(User, "find", async () => [
    userDoc(bob, { avatar: { tcgdexId: "sv03.5-006", name: "Dracaufeu-ex", image: DRACAUFEU } }),
    userDoc(alice, { name: "Alice" }),
  ]);

  const users = await publicUsers([alice, bob, newId()]);

  assert.equal(find.mock.calls[0].arguments[1], "name avatar");
  assert.deepEqual(users.slice(0, 2), [{ id: alice, name: "Alice" }, { id: bob, name: "Bob", avatar: `${DRACAUFEU}/low.webp` }]);
  assert.equal(users[2].name, "Utilisateur supprimé");
});

// ------------------------------------------------------- profil public

test("profil public : identité, relation et chiffres sur les albums que JE peux voir, sans email", async () => {
  mock.method(User, "findById", async (id) => (String(id) === bob ? userDoc(bob) : null));
  mock.method(Friendship, "findOne", async () => new Friendship({ requester: alice, recipient: bob, status: "accepted", pair: pairKey(alice, bob) }));
  const albums = mock.method(Album, "find", async () => [
    new Album({ title: "A", ownerId: bob, cardCount: 6, likeCount: 2 }),
    new Album({ title: "B", ownerId: bob, cardCount: 2, likeCount: 1 }),
  ]);
  const friends = mock.method(Friendship, "countDocuments", async () => 3);

  const r = await call("GET", `/api/users/${bob}`, alice);

  assert.equal(r.status, 200);
  const profile = await r.json();
  assert.deepEqual(
    { ...profile, createdAt: undefined },
    { id: bob, name: "Bob", bio: "Collectionneur de Psy", avatar: null, createdAt: undefined, relation: "friend", stats: { albums: 2, cards: 8, likes: 3, friends: 3 } },
  );
  assert.equal(JSON.stringify(profile).includes("@"), false);
  const [filter] = albums.mock.calls[0].arguments;
  assert.deepEqual(filter.$and[1], visibleAlbumsFilter(alice));
  assert.equal(String(filter.$and[0].ownerId), bob);
  assert.deepEqual(friends.mock.calls[0].arguments[0].status, "accepted");
});

test("profil public : mon propre profil -> relation self ; inconnu ou identifiant invalide -> 404", async () => {
  mock.method(User, "findById", async (id) => (String(id) === alice ? userDoc(alice, { name: "Alice" }) : null));
  mock.method(Album, "find", async () => []);
  mock.method(Friendship, "countDocuments", async () => 0);

  assert.equal((await (await call("GET", `/api/users/${alice}`, alice)).json()).relation, "self");
  assert.equal((await call("GET", `/api/users/${newId()}`, alice)).status, 404);
  assert.equal((await call("GET", "/api/users/pas-un-id", alice)).status, 404);
});

test("albums d'un collectionneur : ses albums visibles par moi, paginés, sans sharedCount", async () => {
  const calls = [];
  mock.method(Album, "find", async (filter, projection, options) => {
    calls.push({ filter, options });
    return [new Album({ title: "Mes Psy", ownerId: bob, sharedWith: [alice] })];
  });
  mock.method(Album, "countDocuments", async () => 13);

  const r = await call("GET", `/api/users/${bob}/albums?page=2`, alice);

  assert.equal(r.status, 200);
  const page = await r.json();
  assert.deepEqual(calls[0].filter, { $and: [{ ownerId: bob }, visibleAlbumsFilter(alice)] });
  assert.deepEqual(calls[0].options, { sort: { updatedAt: -1 }, skip: 12, limit: 12 });
  assert.deepEqual([page.total, page.pages, page.items[0].sharedCount], [13, 2, null]);
  assert.equal((await call("GET", "/api/users/pas-un-id/albums", alice)).status, 404);
});

test("profils : 401 sans token ; /users/me et /users/search toujours servis par leurs routes", async () => {
  for (const path of [`/api/users/${bob}`, `/api/users/${bob}/albums`]) {
    assert.equal((await realFetch(server.base + path)).status, 401, path);
  }
  // /me n'est pas pris pour un identifiant de profil.
  mock.method(User, "findById", async (id) => (String(id) === alice ? userDoc(alice, { name: "Alice", email: "alice@example.com" }) : null));
  const me = await (await call("GET", "/api/users/me", alice)).json();
  assert.equal(me.email, "alice@example.com");
});

test("modèle : pseudo de 30 caractères et bio de 300 caractères au plus", async () => {
  await assert.rejects(userDoc(bob, { name: "x".repeat(31) }).validate(["name"]));
  await assert.rejects(userDoc(bob, { bio: "x".repeat(301) }).validate(["bio"]));
  assert.equal(mongoose.isValidObjectId(bob), true);
});
