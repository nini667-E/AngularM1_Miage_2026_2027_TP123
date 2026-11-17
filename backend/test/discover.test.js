import test, { mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { canView, visibleAlbumsFilter } from "../src/access.js";
import { Album } from "../src/models/Album.js";
import { Card } from "../src/models/Card.js";
import { Comment } from "../src/models/Comment.js";
import { Friendship, pairKey } from "../src/models/Friendship.js";
import { Like } from "../src/models/Like.js";
import { User } from "../src/models/User.js";
import { verifyImageSignature } from "../src/services/images.js";
import { textPattern } from "../src/services/text.js";
import { authHeaders, newId, realFetch, startServer } from "./helpers.js";

// Découverte (V2, étape 7) : récents, activité des amis, recherche. Sans
// MongoDB : méthodes des modèles simulées. Alice consulte ; Bob est son ami ;
// Carol ne l'est pas.
let server;
const alice = newId();
const bob = newId();
const carol = newId();
const NAMES = { [alice]: "Alice", [bob]: "Bob", [carol]: "Carol" };

test.before(async () => {
  server = await startServer();
});
test.after(() => server.close());
test.afterEach(() => mock.restoreAll());

const get = (path, user = alice) => realFetch(server.base + path, { headers: authHeaders(user) });

const album = (fields) => new Album({ title: "Album", visibility: "public", ...fields });
const card = (albumDoc, fields) =>
  new Card({ albumId: albumDoc._id, ownerId: albumDoc.ownerId, tcgdexId: "sv03.5-150", name: "Mewtwo", photo: { thumb: "t.webp", full: "f.webp" }, ...fields });

/** Utilisateurs simulés (avec email : il ne doit jamais ressortir). */
function mockUsers() {
  return mock.method(User, "find", async (filter) => {
    if (filter.name) return [new User({ _id: bob, name: "Bob", email: "bob@example.com" })];
    return filter._id.$in.map(String).map((id) => new User({ _id: id, name: NAMES[id] ?? "?", email: `${id}@example.com` }));
  });
}

// ------------------------------------------------------- outils

test("textPattern : insensible à la casse et aux accents, caractères spéciaux cherchés tels quels", () => {
  const matches = (q, text) => new RegExp(textPattern(q), "i").test(text);
  assert.equal(matches("energie", "Énergie Feu de base"), true);
  assert.equal(matches("pokemon", "Pokémon"), true);
  assert.equal(matches("DRACAU", "Dracaufeu-ex"), true);
  assert.equal(matches("éclair", "Eclair"), true);
  assert.equal(matches(".*", "Mewtwo"), false);
  assert.equal(matches("a+", "aaa"), false);
});

test("visibleAlbumsFilter : même règle que canView (les miens, les publics, ceux partagés avec moi)", () => {
  assert.deepEqual(visibleAlbumsFilter(alice), { $or: [{ ownerId: alice }, { visibility: "public" }, { sharedWith: alice }] });
  // Chaque branche du filtre correspond à un cas accepté par canView.
  const owner = new mongoose.Types.ObjectId(bob);
  assert.equal(canView({ ownerId: alice, visibility: "private" }, alice), true);
  assert.equal(canView({ ownerId: owner, visibility: "public" }, alice), true);
  assert.equal(canView({ ownerId: owner, visibility: "private", sharedWith: [alice] }, alice), true);
  assert.equal(canView({ ownerId: owner, visibility: "private", sharedWith: [] }, alice), false);
});

// ------------------------------------------------------- récents

test("récents : dernières cartes et derniers albums PUBLICS, avec album et propriétaire, photos signées, sans email", async () => {
  const a1 = album({ ownerId: bob, title: "Mes Psy" });
  const a2 = album({ ownerId: carol, title: "Feu" });
  const queries = [];
  mock.method(Album, "find", async (filter, projection, options) => {
    queries.push({ filter, projection, options });
    return projection ? [a1, a2] : [a2, a1];
  });
  const cardQuery = mock.method(Card, "find", async () => [card(a1, { name: "Mewtwo" }), card(a2, { name: "Dracaufeu-ex" })]);
  mockUsers();

  const r = await get("/api/discover/recent");

  assert.equal(r.status, 200);
  const body = await r.json();
  assert.deepEqual(queries.map((q) => q.filter), [{ visibility: "public" }, { visibility: "public" }]);
  assert.deepEqual(queries[1].options, { sort: { createdAt: -1 }, limit: 8 });
  const [cardFilter, , cardOptions] = cardQuery.mock.calls[0].arguments;
  assert.deepEqual(cardFilter.albumId.$in.map(String), [a1.id, a2.id]);
  assert.deepEqual(cardOptions, { sort: { createdAt: -1 }, limit: 12 });

  assert.deepEqual(body.cards.map((c) => [c.name, c.album.title, c.owner.name]), [["Mewtwo", "Mes Psy", "Bob"], ["Dracaufeu-ex", "Feu", "Carol"]]);
  const url = new URL(body.cards[0].photo.thumb, server.base);
  assert.equal(verifyImageSignature(body.cards[0].id, "thumb", url.searchParams.get("exp"), url.searchParams.get("sig")), true);
  assert.deepEqual(body.albums.map((a) => [a.title, a.owner.name, a.sharedCount]), [["Feu", "Carol", null], ["Mes Psy", "Bob", null]]);
  assert.equal(JSON.stringify(body).includes("@"), false);
});

// ------------------------------------------------------- activité

test("activité sans ami : hasFriends false, aucune autre requête", async () => {
  mock.method(Friendship, "find", async () => []);
  const albums = mock.method(Album, "find", async () => []);

  const body = await (await get("/api/discover/activity")).json();

  assert.deepEqual(body, { hasFriends: false, items: [] });
  assert.equal(albums.mock.callCount(), 0);
});

test("activité : albums, cartes regroupées, commentaires et likes de mes amis, seulement sur ce que je vois, du plus récent au plus ancien", async () => {
  mock.method(Friendship, "find", async () => [
    new Friendship({ requester: alice, recipient: bob, status: "accepted", pair: pairKey(alice, bob) }),
  ]);
  const created = album({ ownerId: bob, title: "Mes Psy", createdAt: new Date("2026-11-10T08:00:00Z") });
  const carolAlbum = album({ ownerId: carol, title: "Feu de Carol" });
  const hidden = album({ ownerId: bob, visibility: "private", title: "Secret" });
  const albumQueries = [];
  mock.method(Album, "find", async (filter) => {
    albumQueries.push(filter);
    // 1er appel : albums créés par mes amis ; 2e : albums référencés et visibles.
    return albumQueries.length === 1 ? [created] : [created, carolAlbum];
  });
  const day = (h) => new Date(`2026-11-11T${h}:00:00Z`);
  mock.method(Card, "find", async () => [
    card(created, { name: "Mewtwo", createdAt: day("12") }),
    card(created, { name: "Alakazam", createdAt: day("11") }),
    card(created, { name: "Kadabra", createdAt: day("10") }),
    card(created, { name: "Abra", createdAt: day("09") }),
    card(hidden, { name: "Caché", createdAt: day("13") }),
  ]);
  mock.method(Comment, "find", async () => [
    new Comment({ albumId: carolAlbum._id, authorId: bob, text: "x".repeat(200), createdAt: day("14") }),
  ]);
  mock.method(Like, "find", async () => [
    new Like({ albumId: carolAlbum._id, userId: bob, createdAt: day("15") }),
    new Like({ albumId: hidden._id, userId: bob, createdAt: day("16") }),
  ]);
  mockUsers();

  const body = await (await get("/api/discover/activity")).json();

  assert.equal(body.hasFriends, true);
  assert.deepEqual(body.items.map((i) => i.type), ["like", "comment", "cards", "album"]);
  const [like, comment, cards, createdItem] = body.items;
  assert.deepEqual([like.actor.name, like.album.title, like.album.owner.name], ["Bob", "Feu de Carol", "Carol"]);
  assert.equal(comment.comment.text.length, 140);
  assert.equal(comment.comment.text.endsWith("…"), true);
  assert.equal(comment.comment.isReply, false);
  assert.deepEqual([cards.cards.count, cards.cards.previews.map((p) => p.name)], [4, ["Mewtwo", "Alakazam", "Kadabra"]]);
  assert.equal(cards.date, day("12").toISOString());
  assert.deepEqual([createdItem.actor.name, createdItem.album.title], ["Bob", "Mes Psy"]);
  // Rien sur l'album privé non partagé (ni la carte, ni le like).
  assert.equal(JSON.stringify(body).includes("Secret") || JSON.stringify(body).includes("Caché"), false);
  // Les deux requêtes d'albums passent par la règle de visibilité.
  assert.deepEqual(albumQueries.map((f) => f.$and[1]), [visibleAlbumsFilter(alice), visibleAlbumsFilter(alice)]);
  assert.deepEqual(albumQueries[0].$and[0], { ownerId: { $in: [bob] } });
  assert.equal(JSON.stringify(body).includes("@"), false);
});

test("activité : les cartes sont regroupées par album ET par jour", async () => {
  mock.method(Friendship, "find", async () => [
    new Friendship({ requester: alice, recipient: bob, status: "accepted", pair: pairKey(alice, bob) }),
  ]);
  const psy = album({ ownerId: bob, title: "Mes Psy" });
  const feu = album({ ownerId: bob, title: "Feu" });
  mock.method(Album, "find", async (filter) => (filter.$and[0].ownerId ? [] : [psy, feu]));
  mock.method(Card, "find", async () => [
    card(psy, { createdAt: new Date("2026-11-11T18:00:00Z") }),
    card(feu, { createdAt: new Date("2026-11-11T17:00:00Z") }),
    card(psy, { createdAt: new Date("2026-11-11T09:00:00Z") }),
    card(psy, { createdAt: new Date("2026-11-10T20:00:00Z") }),
  ]);
  for (const model of [Comment, Like]) mock.method(model, "find", async () => []);
  mockUsers();

  const body = await (await get("/api/discover/activity")).json();

  assert.deepEqual(
    body.items.map((i) => [i.album.title, i.cards.count]),
    [["Mes Psy", 2], ["Feu", 1], ["Mes Psy", 1]],
  );
});

test("activité : au plus 30 événements", async () => {
  mock.method(Friendship, "find", async () => [
    new Friendship({ requester: alice, recipient: bob, status: "accepted", pair: pairKey(alice, bob) }),
  ]);
  const albums = Array.from({ length: 40 }, (_, i) => album({ ownerId: bob, title: `A${i}`, createdAt: new Date(2026, 10, 1, i) }));
  mock.method(Album, "find", async () => albums);
  for (const model of [Card, Comment, Like]) mock.method(model, "find", async () => []);
  mockUsers();

  const body = await (await get("/api/discover/activity")).json();
  assert.equal(body.items.length, 30);
  assert.equal(body.items[0].album.title, "A39");
});

// ------------------------------------------------------- recherche d'albums

function mockAlbumSearch(results, total = results.length) {
  const calls = [];
  mock.method(Album, "find", async (filter, projection, options) => (calls.push({ filter, options }), results));
  mock.method(Album, "countDocuments", async () => total);
  return calls;
}

test("recherche d'albums : visibles seulement, texte dans titre / description / pseudo, filtres de thème, paginée", async () => {
  const calls = mockAlbumSearch([album({ ownerId: bob, title: "Mes Psy" })], 13);
  const users = mockUsers();

  const r = await get("/api/discover/albums?q=psy&type=Psy&serieId=sv&setId=sv03.5&page=2");

  assert.equal(r.status, 200);
  const body = await r.json();
  const [visible, type, serie, set, text] = calls[0].filter.$and;
  assert.deepEqual([visible, type, serie, set], [visibleAlbumsFilter(alice), { "theme.type": "Psy" }, { "theme.serie.id": "sv" }, { "theme.set.id": "sv03.5" }]);
  const pattern = { $regex: textPattern("psy"), $options: "i" };
  assert.deepEqual(text.$or.slice(0, 2), [{ title: pattern }, { description: pattern }]);
  assert.deepEqual(text.$or[2].ownerId.$in.map(String), [bob]);
  assert.deepEqual(users.mock.calls[0].arguments[0], { name: pattern });
  assert.deepEqual(calls[0].options, { sort: { updatedAt: -1 }, skip: 12, limit: 12 });
  assert.deepEqual([body.total, body.pages, body.items[0].owner.name], [13, 2, "Bob"]);
});

test("recherche d'albums sans critère : tous les albums visibles", async () => {
  const calls = mockAlbumSearch([]);
  mockUsers();
  assert.equal((await get("/api/discover/albums")).status, 200);
  assert.deepEqual(calls[0].filter, { $and: [visibleAlbumsFilter(alice)] });
});

test("recherche : texte d'un seul caractère ou identifiant invalide -> 400", async () => {
  mockAlbumSearch([]);
  mockUsers();
  for (const query of ["q=a", "q=%20a%20", "serieId=sv%2F..", "setId=%24where", `type=${"x".repeat(31)}`]) {
    assert.equal((await get(`/api/discover/albums?${query}`)).status, 400, query);
  }
});

// ------------------------------------------------------- recherche de cartes

test("recherche de cartes : dans les albums visibles, par nom et filtres, avec album et propriétaire", async () => {
  const a1 = album({ ownerId: bob, title: "Mes Psy" });
  const visibleQuery = mock.method(Album, "find", async () => [a1]);
  const cardQuery = mock.method(Card, "find", async () => [card(a1, { name: "Mewtwo" })]);
  mock.method(Card, "countDocuments", async () => 1);
  mockUsers();

  const r = await get("/api/discover/cards?q=mew&type=Psy&serieId=sv&setId=sv03.5&category=Pok%C3%A9mon");

  assert.equal(r.status, 200);
  const body = await r.json();
  assert.deepEqual(visibleQuery.mock.calls[0].arguments.slice(0, 2), [visibleAlbumsFilter(alice), "_id title ownerId"]);
  const [filter, , options] = cardQuery.mock.calls[0].arguments;
  assert.deepEqual(filter.albumId.$in.map(String), [a1.id]);
  assert.deepEqual(
    [filter.name, filter.types, filter["serie.id"], filter["set.id"], filter.category],
    [{ $regex: textPattern("mew"), $options: "i" }, "Psy", "sv", "sv03.5", "Pokémon"],
  );
  assert.deepEqual(options, { sort: { createdAt: -1 }, skip: 0, limit: 12 });
  assert.deepEqual(body.items.map((c) => [c.name, c.album.title, c.owner.name]), [["Mewtwo", "Mes Psy", "Bob"]]);
  assert.ok(body.items[0].photo.thumb.startsWith("/api/images/"));
});

test("recherche de cartes : sans texte ni filtre, ou catégorie inconnue -> 400 (aucune requête)", async () => {
  const albums = mock.method(Album, "find", async () => []);
  for (const query of ["", "q=", "category=Objet"]) {
    assert.equal((await get(`/api/discover/cards?${query}`)).status, 400, query);
  }
  assert.equal(albums.mock.callCount(), 0);
});

test("découverte : 401 sans token", async () => {
  for (const path of ["/recent", "/activity", "/albums", "/cards?q=mew"]) {
    assert.equal((await realFetch(`${server.base}/api/discover${path}`)).status, 401, path);
  }
});
