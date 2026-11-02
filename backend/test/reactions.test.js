import test, { mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { reactionRights } from "../src/access.js";
import { Album } from "../src/models/Album.js";
import { Comment } from "../src/models/Comment.js";
import { Friendship, pairKey } from "../src/models/Friendship.js";
import { Like } from "../src/models/Like.js";
import { User } from "../src/models/User.js";
import { authHeaders, newId, realFetch, startServer } from "./helpers.js";

// Likes et commentaires (V2, étape 6). Sans MongoDB : méthodes des modèles
// simulées. Alice possède l'album ; Bob est son ami ; Carol ne l'est pas.
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

const call = (method, path, user, body) =>
  realFetch(server.base + path, {
    method,
    headers: authHeaders(user),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** Album d'Alice (public par défaut, visible par Carol qui n'est pas amie). */
function setup(fields = {}) {
  const album = new Album({ title: "Mes Psy", ownerId: alice, visibility: "public", likeCount: 1, commentCount: 2, ...fields });
  mock.method(Album, "findById", async (id) => {
    if (!mongoose.isValidObjectId(id)) throw new mongoose.Error.CastError("ObjectId", id, "_id");
    return String(album._id) === String(id) ? album : null;
  });
  // Seule amitié : Alice - Bob.
  mock.method(Friendship, "findOne", async ({ pair }) =>
    pair === pairKey(alice, bob)
      ? new Friendship({ requester: alice, recipient: bob, status: "accepted", pair })
      : null,
  );
  mock.method(User, "find", async (filter) =>
    filter._id.$in.map(String).map((id) => new User({ _id: id, name: NAMES[id], email: `${id}@example.com` })),
  );
  const bump = mock.method(Album, "updateOne", async () => ({ modifiedCount: 1 }));
  return { album, bump };
}

// ------------------------------------------------------- droits

test("reactionRights : ami = aimer et commenter ; propriétaire = répondre seulement ; autre = rien", () => {
  const album = { ownerId: new mongoose.Types.ObjectId(alice) };
  assert.deepEqual(reactionRights(album, bob, true), { canLike: true, canComment: true, canReply: false });
  assert.deepEqual(reactionRights(album, alice, false), { canLike: false, canComment: false, canReply: true });
  // Le propriétaire n'est jamais « ami » de lui-même, même si on le prétend.
  assert.deepEqual(reactionRights(album, alice, true), { canLike: false, canComment: false, canReply: true });
  assert.deepEqual(reactionRights(album, carol, false), { canLike: false, canComment: false, canReply: false });
});

// ------------------------------------------------------- résumé

test("résumé : nombre, qui aime (sans email), j'aime, droits selon la personne", async () => {
  const { album } = setup();
  mock.method(Like, "find", async () => [new Like({ albumId: album._id, userId: bob })]);

  const asBob = await (await call("GET", `/api/albums/${album.id}/reactions`, bob)).json();
  assert.deepEqual(asBob, {
    likeCount: 1,
    likedByMe: true,
    likers: [{ id: bob, name: "Bob" }],
    commentCount: 2,
    canLike: true,
    canComment: true,
    canReply: false,
    canRemoveLikes: false,
  });

  const asAlice = await (await call("GET", `/api/albums/${album.id}/reactions`, alice)).json();
  assert.deepEqual(
    [asAlice.likedByMe, asAlice.canLike, asAlice.canComment, asAlice.canReply, asAlice.canRemoveLikes],
    [false, false, false, true, true],
  );

  // Carol voit l'album public, en lecture seule.
  const asCarol = await call("GET", `/api/albums/${album.id}/reactions`, carol);
  assert.equal(asCarol.status, 200);
  const carolView = await asCarol.json();
  assert.deepEqual([carolView.likeCount, carolView.canLike, carolView.canComment], [1, false, false]);
});

test("résumé d'un album privé non partagé : 404 pour un autre, même ami", async () => {
  const { album } = setup({ visibility: "private" });
  mock.method(Like, "find", async () => []);
  assert.equal((await call("GET", `/api/albums/${album.id}/reactions`, bob)).status, 404);
  assert.equal((await call("GET", `/api/albums/${newId()}/reactions`, bob)).status, 404);
});

test("album privé partagé avec un ami : il peut aimer et commenter", async () => {
  const { album } = setup({ visibility: "private", sharedWith: [bob] });
  mock.method(Like, "find", async () => []);
  const view = await (await call("GET", `/api/albums/${album.id}/reactions`, bob)).json();
  assert.deepEqual([view.canLike, view.canComment], [true, true]);
});

// ------------------------------------------------------- aimer

test("aimer (ami) : like créé une seule fois (upsert), compteur +1 ; répéter ne change rien", async () => {
  const { album, bump } = setup();
  const upsert = mock.method(Like, "updateOne", async () => ({ upsertedCount: 1 }));

  const r = await call("PUT", `/api/albums/${album.id}/likes/me`, bob);

  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { likeCount: 2, likedByMe: true });
  const [filter, , options] = upsert.mock.calls[0].arguments;
  assert.deepEqual(filter, { albumId: album._id, userId: bob });
  assert.deepEqual(options, { upsert: true });
  assert.deepEqual(bump.mock.calls[0].arguments, [{ _id: album._id }, { $inc: { likeCount: 1 } }]);

  mock.method(Like, "updateOne", async () => ({ upsertedCount: 0 }));
  const again = await call("PUT", `/api/albums/${album.id}/likes/me`, bob);
  assert.deepEqual(await again.json(), { likeCount: 1, likedByMe: true });
  assert.equal(bump.mock.callCount(), 1, "pas de second +1");
});

test("aimer refusé : propriétaire et non-ami 403 (avec la raison), album invisible 404 ; rien enregistré", async () => {
  const { album, bump } = setup();
  const upsert = mock.method(Like, "updateOne", async () => ({ upsertedCount: 1 }));

  const own = await call("PUT", `/api/albums/${album.id}/likes/me`, alice);
  assert.equal(own.status, 403);
  assert.equal((await own.json()).message, "Tu ne peux pas aimer ton propre album");
  assert.equal((await call("PUT", `/api/albums/${album.id}/likes/me`, carol)).status, 403);

  album.visibility = "private";
  assert.equal((await call("PUT", `/api/albums/${album.id}/likes/me`, bob)).status, 404);

  assert.equal(upsert.mock.callCount(), 0);
  assert.equal(bump.mock.callCount(), 0);
});

test("ne plus aimer : mon like seulement, compteur -1 sans passer sous 0 ; possible sans être ami", async () => {
  const { album, bump } = setup();
  const remove = mock.method(Like, "deleteOne", async () => ({ deletedCount: 1 }));

  // Carol n'est pas (ou plus) amie : elle peut quand même retirer son like.
  const r = await call("DELETE", `/api/albums/${album.id}/likes/me`, carol);

  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { likeCount: 0, likedByMe: false });
  assert.deepEqual(remove.mock.calls[0].arguments[0], { albumId: album._id, userId: carol });
  assert.deepEqual(bump.mock.calls[0].arguments, [{ _id: album._id, likeCount: { $gte: 1 } }, { $inc: { likeCount: -1 } }]);

  mock.method(Like, "deleteOne", async () => ({ deletedCount: 0 }));
  await call("DELETE", `/api/albums/${album.id}/likes/me`, carol);
  assert.equal(bump.mock.callCount(), 1, "rien à retirer : compteur inchangé");
});

test("retirer un like reçu : propriétaire seulement (404 sinon), like inconnu 404", async () => {
  const { album, bump } = setup();
  const remove = mock.method(Like, "deleteOne", async () => ({ deletedCount: 1 }));

  assert.equal((await call("DELETE", `/api/albums/${album.id}/likes/${bob}`, alice)).status, 204);
  assert.deepEqual(remove.mock.calls[0].arguments[0], { albumId: album._id, userId: bob });
  assert.equal(bump.mock.callCount(), 1);

  assert.equal((await call("DELETE", `/api/albums/${album.id}/likes/${carol}`, bob)).status, 404);
  assert.equal(remove.mock.callCount(), 1, "un ami ne retire pas le like d'un autre");

  mock.method(Like, "deleteOne", async () => ({ deletedCount: 0 }));
  assert.equal((await call("DELETE", `/api/albums/${album.id}/likes/${carol}`, alice)).status, 404);
  assert.equal((await call("DELETE", `/api/albums/${album.id}/likes/pas-un-id`, alice)).status, 404);
});

// ------------------------------------------------------- commentaires

/** Liste des commentaires principaux (requête chaînée) et de leurs réponses (requête avec options). */
function mockCommentList(comments, total = comments.length, replies = []) {
  const queries = [];
  mock.method(Comment, "find", (filter, _projection, options) => {
    const query = { filter };
    queries.push(query);
    if (options) {
      query.sort = options.sort;
      return Promise.resolve(replies);
    }
    const chain = {
      sort: (v) => ((query.sort = v), chain),
      skip: (v) => ((query.skip = v), chain),
      limit: async (v) => ((query.limit = v), comments),
    };
    return chain;
  });
  mock.method(Comment, "countDocuments", async () => total);
  return queries;
}

test("commentaires : principaux seulement, plus récents d'abord, 10 par page, chacun avec ses réponses", async () => {
  const { album } = setup();
  const first = new Comment({ albumId: album._id, authorId: bob, text: "Superbe !" });
  const second = new Comment({ albumId: album._id, authorId: bob, text: "Et le Mewtwo ?" });
  const reply = new Comment({ albumId: album._id, authorId: alice, text: "Merci", parentId: first._id });
  const queries = mockCommentList([first, second], 12, [reply]);

  const asBob = await (await call("GET", `/api/albums/${album.id}/comments`, bob)).json();
  assert.deepEqual(queries[0], { filter: { albumId: album._id, parentId: null }, sort: { createdAt: -1 }, skip: 0, limit: 10 });
  assert.deepEqual(queries[1], { filter: { parentId: { $in: [first._id, second._id] } }, sort: { createdAt: 1 } });
  assert.deepEqual([asBob.total, asBob.pages], [12, 2]);
  assert.deepEqual(asBob.items.map((c) => [c.author.name, c.text, c.canDelete, c.replies.length]), [
    ["Bob", "Superbe !", true, 1],
    ["Bob", "Et le Mewtwo ?", true, 0],
  ]);
  assert.deepEqual(
    [asBob.items[0].replies[0].author, asBob.items[0].replies[0].text, asBob.items[0].replies[0].parentId, asBob.items[0].replies[0].canDelete],
    [{ id: alice, name: "Alice" }, "Merci", first.id, false],
  );
  assert.equal(JSON.stringify(asBob).includes("@"), false);

  // Le propriétaire peut tout supprimer, réponses comprises.
  const asAlice = await (await call("GET", `/api/albums/${album.id}/comments`, alice)).json();
  assert.deepEqual([asAlice.items.map((c) => c.canDelete), asAlice.items[0].replies[0].canDelete], [[true, true], true]);

  const asCarol = await (await call("GET", `/api/albums/${album.id}/comments?page=2&limit=999`, carol)).json();
  assert.deepEqual(asCarol.items.map((c) => c.canDelete), [false, false]);
  assert.deepEqual([queries[4].skip, queries[4].limit], [50, 50]);
});

test("commentaires : aucun commentaire principal -> aucune recherche de réponses", async () => {
  const { album } = setup();
  const queries = mockCommentList([], 0);
  const page = await (await call("GET", `/api/albums/${album.id}/comments`, bob)).json();
  assert.deepEqual(page.items, []);
  assert.equal(queries.length, 1);
});

test("commenter : ami 201 (texte nettoyé, compteur +1) ; propriétaire et non-ami 403 ; rien créé si refusé", async () => {
  const { album, bump } = setup();
  const create = mock.method(Comment, "create", async (values) => new Comment(values));

  const r = await call("POST", `/api/albums/${album.id}/comments`, bob, { text: "  Belle collection  " });
  assert.equal(r.status, 201);
  const comment = await r.json();
  assert.deepEqual([comment.text, comment.author, comment.canDelete], ["Belle collection", { id: bob, name: "Bob" }, true]);
  assert.deepEqual(create.mock.calls[0].arguments[0], { albumId: album._id, authorId: bob, text: "Belle collection", parentId: null });
  assert.equal(comment.parentId, null);
  assert.deepEqual(bump.mock.calls[0].arguments, [{ _id: album._id }, { $inc: { commentCount: 1 } }]);

  // Le propriétaire ne commente pas son album : il répond aux commentaires.
  const own = await call("POST", `/api/albums/${album.id}/comments`, alice, { text: "Merci !" });
  assert.equal(own.status, 403);
  assert.equal((await own.json()).message, "Tu ne peux pas commenter ton propre album : réponds aux commentaires de tes amis");

  const refused = await call("POST", `/api/albums/${album.id}/comments`, carol, { text: "Coucou" });
  assert.equal(refused.status, 403);
  assert.equal(create.mock.callCount(), 1);
});

test("répondre : propriétaire seulement, à un commentaire principal de cet album", async () => {
  const { album, bump } = setup();
  const parent = new Comment({ albumId: album._id, authorId: bob, text: "Superbe !" });
  const replyToReply = new Comment({ albumId: album._id, authorId: alice, text: "Merci", parentId: parent._id });
  const otherAlbum = new Comment({ albumId: newId(), authorId: bob, text: "Ailleurs" });
  const byId = new Map([parent, replyToReply, otherAlbum].map((c) => [c.id, c]));
  mock.method(Comment, "findById", async (id) => byId.get(String(id)) ?? null);
  const create = mock.method(Comment, "create", async (values) => new Comment(values));

  const r = await call("POST", `/api/albums/${album.id}/comments`, alice, { text: " Merci ! ", parentId: parent.id });
  assert.equal(r.status, 201);
  const reply = await r.json();
  assert.deepEqual([reply.text, reply.parentId, reply.author.name], ["Merci !", parent.id, "Alice"]);
  assert.deepEqual(create.mock.calls[0].arguments[0], { albumId: album._id, authorId: alice, text: "Merci !", parentId: parent.id });
  assert.equal(bump.mock.callCount(), 1);

  // Un ami ne répond pas (il commente) ; un non-ami non plus.
  for (const user of [bob, carol]) {
    assert.equal((await call("POST", `/api/albums/${album.id}/comments`, user, { text: "x", parentId: parent.id })).status, 403);
  }
  // Réponse à une réponse, commentaire d'un autre album, inconnu, identifiant invalide : 404.
  for (const parentId of [replyToReply.id, otherAlbum.id, newId(), "pas-un-id"]) {
    assert.equal((await call("POST", `/api/albums/${album.id}/comments`, alice, { text: "x", parentId })).status, 404, parentId);
  }
  assert.equal(create.mock.callCount(), 1);
});

test("commenter : texte vide, trop long ou absent 400 ; album invisible 404", async () => {
  const { album } = setup();
  const create = mock.method(Comment, "create", async (values) => new Comment(values));

  for (const body of [{ text: "   " }, { text: "x".repeat(501) }, {}, { text: 42 }]) {
    assert.equal((await call("POST", `/api/albums/${album.id}/comments`, bob, body)).status, 400, JSON.stringify(body).slice(0, 30));
  }
  assert.equal((await call("POST", `/api/albums/${album.id}/comments`, bob, { text: "x".repeat(500) })).status, 201);
  album.visibility = "private";
  assert.equal((await call("POST", `/api/albums/${album.id}/comments`, bob, { text: "ok" })).status, 404);
  assert.equal(create.mock.callCount(), 1);
});

test("supprimer un commentaire : auteur ou propriétaire ; ses réponses partent avec lui (compteur -1-n) ; sinon 404", async () => {
  const { album, bump } = setup();
  const comment = new Comment({ albumId: album._id, authorId: bob, text: "Superbe" });
  const reply = new Comment({ albumId: album._id, authorId: alice, text: "Merci", parentId: comment._id });
  mock.method(Comment, "findById", async (id) => [comment, reply].find((c) => c.id === String(id)) ?? null);
  const remove = mock.method(Comment, "deleteOne", async () => ({ deletedCount: 1 }));
  const removeReplies = mock.method(Comment, "deleteMany", async () => ({ deletedCount: 2 }));

  assert.equal((await call("DELETE", `/api/comments/${comment.id}`, carol)).status, 404);
  assert.equal(remove.mock.callCount(), 0);

  assert.equal((await call("DELETE", `/api/comments/${comment.id}`, bob)).status, 204);
  assert.deepEqual(remove.mock.calls[0].arguments[0], { _id: comment._id });
  assert.deepEqual(removeReplies.mock.calls[0].arguments[0], { parentId: comment._id });
  assert.deepEqual(bump.mock.calls[0].arguments, [{ _id: album._id, commentCount: { $gte: 3 } }, { $inc: { commentCount: -3 } }]);

  // Une réponse se supprime seule (pas de recherche de sous-réponses).
  assert.equal((await call("DELETE", `/api/comments/${reply.id}`, alice)).status, 204);
  assert.equal(removeReplies.mock.callCount(), 1);
  assert.deepEqual(bump.mock.calls[1].arguments, [{ _id: album._id, commentCount: { $gte: 1 } }, { $inc: { commentCount: -1 } }]);
  // Le propriétaire supprime aussi un commentaire reçu.
  assert.equal((await call("DELETE", `/api/comments/${comment.id}`, alice)).status, 204);

  assert.equal((await call("DELETE", `/api/comments/${newId()}`, bob)).status, 404);
  assert.equal((await call("DELETE", "/api/comments/pas-un-id", bob)).status, 404);
});

test("routes des réactions : 401 sans token", async () => {
  const id = newId();
  for (const [method, path] of [
    ["GET", `/api/albums/${id}/reactions`],
    ["PUT", `/api/albums/${id}/likes/me`],
    ["DELETE", `/api/albums/${id}/likes/me`],
    ["GET", `/api/albums/${id}/comments`],
    ["POST", `/api/albums/${id}/comments`],
    ["DELETE", `/api/comments/${id}`],
  ]) {
    assert.equal((await realFetch(server.base + path, { method })).status, 401, `${method} ${path}`);
  }
});

test("modèles : un commentaire de plus de 500 caractères est refusé ; compteurs exposés par l'album", async () => {
  await assert.rejects(new Comment({ albumId: newId(), authorId: bob, text: "x".repeat(501) }).validate());
  const album = new Album({ title: "A", ownerId: alice, likeCount: 3, commentCount: 4 });
  assert.deepEqual([album.toPublic(bob).likeCount, album.toPublic(bob).commentCount], [3, 4]);
});
