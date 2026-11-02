import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { Album } from "../src/models/Album.js";
import { Friendship, pairKey } from "../src/models/Friendship.js";
import { User } from "../src/models/User.js";
import { areFriends, friendIds, relationBetween, relationOf } from "../src/services/friends.js";
import { authHeaders, newId, realFetch, startServer } from "./helpers.js";

// Amis et invitations (V2, étape 4). Sans MongoDB : les méthodes des modèles
// sont simulées ; de vrais documents (non sauvegardés) servent de données.
let server;
const alice = newId();
const bob = newId();
const carol = newId();

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

/** Lien d'amitié en mémoire (la clé de paire est calculée comme le ferait la validation). */
const link = (requester, recipient, status = "pending", createdAt = new Date("2026-11-01")) =>
  new Friendship({
    requester,
    recipient,
    status,
    pair: pairKey(requester, recipient),
    createdAt,
    acceptedAt: status === "accepted" ? new Date("2026-11-02") : null,
  });

/** Utilisateurs simulés, avec email : il ne doit jamais ressortir. */
const USERS = {
  [alice]: new User({ _id: alice, name: "Alice", email: "alice@example.com" }),
  [bob]: new User({ _id: bob, name: "Bob", email: "bob@example.com" }),
  [carol]: new User({ _id: carol, name: "Carol", email: "carol@example.com" }),
};

function mockUsers() {
  mock.method(User, "findById", async (id) => USERS[String(id)] ?? null);
  mock.method(User, "find", async (filter) =>
    filter._id.$in.map(String).filter((id) => USERS[id]).map((id) => USERS[id]),
  );
}

// ------------------------------------------------------------ service

test("pairKey : même clé dans les deux sens", () => {
  assert.equal(pairKey(alice, bob), pairKey(bob, alice));
  assert.notEqual(pairKey(alice, bob), pairKey(alice, carol));
});

test("relationOf : none, sent, received, friend selon le point de vue", () => {
  assert.equal(relationOf(null, alice), "none");
  assert.equal(relationOf(link(alice, bob), alice), "sent");
  assert.equal(relationOf(link(alice, bob), bob), "received");
  assert.equal(relationOf(link(alice, bob, "accepted"), alice), "friend");
  assert.equal(relationOf(link(alice, bob, "accepted"), bob), "friend");
});

test("relationBetween et areFriends : self sans requête, invitation en attente ≠ ami", async () => {
  const findOne = mock.method(Friendship, "findOne", async () => link(alice, bob));
  assert.equal(await relationBetween(alice, alice), "self");
  assert.equal(findOne.mock.callCount(), 0);
  assert.equal(await areFriends(alice, bob), false);
  assert.deepEqual(findOne.mock.calls[0].arguments[0], { pair: pairKey(alice, bob) });

  mock.method(Friendship, "findOne", async () => link(bob, alice, "accepted"));
  assert.equal(await areFriends(alice, bob), true);
});

test("friendIds : l'autre membre de chaque amitié acceptée", async () => {
  const find = mock.method(Friendship, "find", async () => [link(alice, bob, "accepted"), link(carol, alice, "accepted")]);
  assert.deepEqual(await friendIds(alice), [bob, carol]);
  assert.deepEqual(find.mock.calls[0].arguments[0], {
    status: "accepted",
    $or: [{ requester: alice }, { recipient: alice }],
  });
});

// ------------------------------------------------------------ recherche

test("recherche : pseudo partiel insensible à la casse, sans moi, relation jointe, jamais d'email", async () => {
  const findUsers = mock.method(User, "find", async () => [USERS[bob], USERS[carol]]);
  const findLinks = mock.method(Friendship, "find", async () => [link(bob, alice)]);

  const r = await call("GET", "/api/users/search?q=%20o%20", alice);
  assert.equal(r.status, 400, "un seul caractère après les espaces");

  const ok = await call("GET", "/api/users/search?q=bo", alice);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), [
    { id: bob, name: "Bob", relation: "received" },
    { id: carol, name: "Carol", relation: "none" },
  ]);
  const [filter, projection, options] = findUsers.mock.calls[0].arguments;
  assert.deepEqual(filter, { _id: { $ne: alice }, name: { $regex: "bo", $options: "i" } });
  assert.equal(projection, "name");
  assert.deepEqual(options, { sort: { name: 1 }, limit: 20 });
  assert.deepEqual(findLinks.mock.calls[0].arguments[0], { pair: { $in: [pairKey(alice, bob), pairKey(alice, carol)] } });
});

test("recherche : caractères spéciaux cherchés tels quels (pas d'expression régulière)", async () => {
  const findUsers = mock.method(User, "find", async () => []);
  mock.method(Friendship, "find", async () => []);

  const r = await call("GET", `/api/users/search?q=${encodeURIComponent(".*")}`, alice);

  assert.equal(r.status, 200);
  assert.equal(findUsers.mock.calls[0].arguments[0].name.$regex, "\\.\\*");
});

// ------------------------------------------------------------ listes

test("mes amis : triés par pseudo, avec la date d'amitié, sans email", async () => {
  mockUsers();
  const find = mock.method(Friendship, "find", async () => [link(alice, carol, "accepted"), link(bob, alice, "accepted")]);

  const r = await call("GET", "/api/friends", alice);

  assert.equal(r.status, 200);
  const friends = await r.json();
  assert.deepEqual(friends.map((f) => f.user), [{ id: bob, name: "Bob" }, { id: carol, name: "Carol" }]);
  assert.equal(friends[0].since, "2026-11-02T00:00:00.000Z");
  assert.deepEqual(find.mock.calls[0].arguments[0], { status: "accepted", $or: [{ requester: alice }, { recipient: alice }] });
});

test("invitations : séparées en reçues / envoyées, les plus récentes d'abord", async () => {
  mockUsers();
  mock.method(Friendship, "find", async () => [
    link(alice, bob, "pending", new Date("2026-11-01")),
    link(carol, alice, "pending", new Date("2026-11-02")),
    link(alice, carol, "pending", new Date("2026-11-03")),
  ]);

  const r = await call("GET", "/api/friends/requests", alice);

  assert.equal(r.status, 200);
  const { received, sent } = await r.json();
  assert.deepEqual(received.map((x) => x.user.name), ["Carol"]);
  assert.deepEqual(sent.map((x) => x.user.name), ["Carol", "Bob"]);
  assert.equal(JSON.stringify({ received, sent }).includes("@"), false);
});

// ------------------------------------------------------------ inviter

test("invitation : 201, expéditeur = token, destinataire = userId", async () => {
  mockUsers();
  mock.method(Friendship, "findOne", async () => null);
  const create = mock.method(Friendship, "create", async (values) => values);

  const r = await call("POST", "/api/friends/requests", alice, { userId: bob });

  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), { user: { id: bob, name: "Bob" }, relation: "sent" });
  assert.deepEqual(create.mock.calls[0].arguments[0], { requester: alice, recipient: bob });
});

test("invitation refusée : soi-même 400, inconnu ou id invalide 404, déjà amis ou déjà invité 409", async () => {
  mockUsers();
  const create = mock.method(Friendship, "create", async (values) => values);

  assert.equal((await call("POST", "/api/friends/requests", alice, { userId: alice })).status, 400);
  for (const userId of [newId(), "pas-un-id", undefined]) {
    assert.equal((await call("POST", "/api/friends/requests", alice, { userId })).status, 404, String(userId));
  }
  mock.method(Friendship, "findOne", async () => link(bob, alice, "accepted"));
  assert.equal((await call("POST", "/api/friends/requests", alice, { userId: bob })).status, 409);
  mock.method(Friendship, "findOne", async () => link(alice, bob));
  const again = await call("POST", "/api/friends/requests", alice, { userId: bob });
  assert.equal(again.status, 409);
  assert.equal((await again.json()).message, "Invitation déjà envoyée");

  assert.equal(create.mock.callCount(), 0);
});

test("invitations croisées : inviter quelqu'un qui m'a invité accepte son invitation (200, friend)", async () => {
  mockUsers();
  mock.method(Friendship, "findOne", async () => link(bob, alice));
  const update = mock.method(Friendship, "findOneAndUpdate", async () => link(bob, alice, "accepted"));
  const create = mock.method(Friendship, "create", async (values) => values);

  const r = await call("POST", "/api/friends/requests", alice, { userId: bob });

  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { user: { id: bob, name: "Bob" }, relation: "friend" });
  assert.deepEqual(update.mock.calls[0].arguments[0], { pair: pairKey(alice, bob), status: "pending", recipient: alice });
  assert.equal(create.mock.callCount(), 0);
});

test("invitation simultanée (index unique de la paire) : 409", async () => {
  mockUsers();
  mock.method(Friendship, "findOne", async () => null);
  mock.method(Friendship, "create", async () => {
    throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
  });

  const r = await call("POST", "/api/friends/requests", alice, { userId: bob });

  assert.equal(r.status, 409);
});

// ------------------------------------------------------------ répondre

test("accepter : filtré sur le destinataire (le token), 200 friend ; sinon 404", async () => {
  mockUsers();
  const update = mock.method(Friendship, "findOneAndUpdate", async () => link(alice, bob, "accepted"));

  const r = await call("POST", `/api/friends/requests/${alice}/accept`, bob);

  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { user: { id: alice, name: "Alice" }, relation: "friend" });
  const [filter, changes] = update.mock.calls[0].arguments;
  assert.deepEqual(filter, { pair: pairKey(alice, bob), status: "pending", recipient: bob });
  assert.equal(changes.$set.status, "accepted");
  assert.ok(changes.$set.acceptedAt instanceof Date);

  // Rien ne correspond (l'expéditeur qui tente d'accepter sa propre invitation, déjà acceptée…).
  mock.method(Friendship, "findOneAndUpdate", async () => null);
  assert.equal((await call("POST", `/api/friends/requests/${bob}/accept`, alice)).status, 404);
  assert.equal((await call("POST", "/api/friends/requests/pas-un-id/accept", alice)).status, 404);
});

test("refuser ou annuler : supprime l'invitation en attente de la paire ; sinon 404", async () => {
  const remove = mock.method(Friendship, "findOneAndDelete", async () => link(alice, bob));

  assert.equal((await call("DELETE", `/api/friends/requests/${alice}`, bob)).status, 204);
  assert.deepEqual(remove.mock.calls[0].arguments[0], { pair: pairKey(alice, bob), status: "pending" });

  mock.method(Friendship, "findOneAndDelete", async () => null);
  assert.equal((await call("DELETE", `/api/friends/requests/${carol}`, bob)).status, 404);
});

test("retirer un ami : seulement une amitié acceptée de la paire du token ; partages arrêtés dans les deux sens ; sinon 404", async () => {
  const remove = mock.method(Friendship, "findOneAndDelete", async () => link(alice, bob, "accepted"));
  const pull = mock.method(Album, "updateMany", async () => ({ modifiedCount: 1 }));

  assert.equal((await call("DELETE", `/api/friends/${alice}`, bob)).status, 204);
  assert.deepEqual(remove.mock.calls[0].arguments[0], { pair: pairKey(alice, bob), status: "accepted" });
  // Étape 5 : mes albums ne sont plus partagés avec lui, et les siens plus avec moi.
  assert.deepEqual(
    pull.mock.calls.map((c) => c.arguments),
    [
      [{ ownerId: bob, sharedWith: alice }, { $pull: { sharedWith: alice } }],
      [{ ownerId: alice, sharedWith: bob }, { $pull: { sharedWith: bob } }],
    ],
  );

  mock.method(Friendship, "findOneAndDelete", async () => null);
  const r = await call("DELETE", `/api/friends/${carol}`, bob);
  assert.equal(r.status, 404);
  assert.equal((await r.json()).message, "Ami inconnu");
  assert.equal(pull.mock.callCount(), 2, "aucun partage touché sans amitié");
});

test("routes des amis : 401 sans token", async () => {
  for (const [method, path] of [
    ["GET", "/api/users/search?q=bo"],
    ["GET", "/api/friends"],
    ["GET", "/api/friends/requests"],
    ["POST", "/api/friends/requests"],
    ["DELETE", `/api/friends/${bob}`],
  ]) {
    const r = await realFetch(server.base + path, { method });
    assert.equal(r.status, 401, `${method} ${path}`);
  }
});

test("modèle : la clé de paire est calculée à la validation, statut inconnu refusé", async () => {
  const friendship = new Friendship({ requester: bob, recipient: alice });
  await friendship.validate();
  assert.equal(friendship.pair, pairKey(alice, bob));
  assert.equal(friendship.status, "pending");
  await assert.rejects(new Friendship({ requester: bob, recipient: alice, status: "refused" }).validate());
});
