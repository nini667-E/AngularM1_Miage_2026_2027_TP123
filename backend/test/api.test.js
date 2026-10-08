import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Track } from "../src/models/Track.js";

let server, base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test("health sans dépendre de MongoDB", async () => {
  const r = await fetch(base + "/api/health");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, "ok");
});

test("schémas Mongoose et relation", () => {
  const u = new User({
    name: "Test",
    email: "TEST@example.com",
    password: "12345678",
  });

  assert.equal(u.email, "test@example.com");
  const t = new Track({
    ownerId: new mongoose.Types.ObjectId(),
    title: "Blues",
    originalName: "b.mp3",
    storedName: "x.mp3",
    mimeType: "audio/mpeg",
    size: 42,
  });
  
  assert.equal(t.title, "Blues");
  assert.equal(Track.schema.path("ownerId").options.ref, "User");
});

// ---------------------------------------------------------------------------
// Extension facultative TP3, Mission 7 (08/10/2026).
// Aucun de ces tests ne se connecte à MongoDB : soit la requête est rejetée
// avant tout accès à la base (auth, Multer), soit les méthodes du modèle
// Track sont remplacées par des fausses (mock.method) pour contrôler ce que
// la "base" renvoie et vérifier ce que la route lui demande.
// ---------------------------------------------------------------------------

// Même règle que app.js : `npm test` ne charge pas .env, donc c'est le
// secret de développement qui signe et vérifie les tokens.
const SECRET = process.env.JWT_SECRET || "tp1-development-secret";
const UPLOADS = path.resolve("data/uploads");
const userA = new mongoose.Types.ObjectId().toString();
const userB = new mongoose.Types.ObjectId().toString();
const tokenFor = (sub, secret = SECRET, options = { expiresIn: "1h" }) =>
  jwt.sign({ sub, email: `${sub}@example.com` }, secret, options);
const bearer = (sub) => ({ Authorization: `Bearer ${tokenFor(sub)}` });

test.afterEach(() => mock.restoreAll());

test("401 sans JWT", async () => {
  const r = await fetch(base + "/api/tracks");
  assert.equal(r.status, 401);
  assert.equal((await r.json()).message, "Authentification requise");
});

test("401 avec JWT invalide (mauvaise signature, expiré, malformé)", async () => {
  const invalid = [
    tokenFor(userA, "un-autre-secret"),
    tokenFor(userA, SECRET, { expiresIn: -10 }),
    "pas-un-jwt",
  ];
  for (const t of invalid) {
    const r = await fetch(base + "/api/tracks", { headers: { Authorization: `Bearer ${t}` } });
    assert.equal(r.status, 401);
    assert.equal((await r.json()).message, "Jeton invalide ou expiré");
  }
});

test("upload sans fichier : 400, rien n'est créé en base", async () => {
  const create = mock.method(Track, "create", async () => {
    throw new Error("Track.create ne doit pas être appelé");
  });
  const body = new FormData();
  body.append("title", "Sans fichier");

  const r = await fetch(base + "/api/tracks", { method: "POST", headers: bearer(userA), body });

  assert.equal(r.status, 400);
  assert.equal((await r.json()).message, "Fichier audio requis");
  assert.equal(create.mock.callCount(), 0);
});

test("type MIME refusé : 400, aucun fichier écrit sur le disque", async () => {
  const create = mock.method(Track, "create", async () => {
    throw new Error("Track.create ne doit pas être appelé");
  });
  const before = fs.readdirSync(UPLOADS).length;
  const body = new FormData();
  body.append("title", "Pas un son");
  body.append("audio", new Blob(["#!/bin/sh"], { type: "text/plain" }), "script.mp3");

  const r = await fetch(base + "/api/tracks", { method: "POST", headers: bearer(userA), body });

  assert.equal(r.status, 400);
  assert.equal((await r.json()).message, "Format audio non accepté");
  assert.equal(create.mock.callCount(), 0);
  assert.equal(fs.readdirSync(UPLOADS).length, before);
});

/** Fausse requête Mongoose chaînable : enregistre le filtre, skip et limit. */
function fakeFind(calls) {
  return (filter) => {
    const query = { filter };
    calls.push(query);
    const chain = {
      sort: () => chain,
      skip: (v) => ((query.skip = v), chain),
      limit: (v) => ((query.limit = v), chain),
      select: () => chain,
      lean: async () => [],
    };
    return chain;
  };
}

test("pagination : page/limit convertis en skip/limit, bornés, filtrés par propriétaire", async () => {
  const calls = [];
  mock.method(Track, "find", fakeFind(calls));
  mock.method(Track, "countDocuments", async () => 12);

  const cases = [
    // [query string, page attendue, limit attendue, skip attendu]
    ["?page=3&limit=5", 3, 5, 10],
    ["", 1, 5, 0], // valeurs par défaut
    ["?page=0&limit=0", 1, 5, 0], // 0 -> valeurs par défaut
    ["?page=-2&limit=999", 1, 20, 0], // bornes : page >= 1, limit <= 20
    ["?page=abc&limit=xyz", 1, 5, 0], // non numérique -> défaut
  ];
  for (const [qs, page, limit, skip] of cases) {
    const r = await fetch(base + "/api/tracks" + qs, { headers: bearer(userA) });
    assert.equal(r.status, 200, qs);
    const json = await r.json();
    assert.deepEqual(
      { page: json.page, limit: json.limit, total: json.total, pages: json.pages },
      { page, limit, total: 12, pages: Math.ceil(12 / limit) },
      qs,
    );
    const q = calls.at(-1);
    assert.equal(q.skip, skip, qs);
    assert.equal(q.limit, limit, qs);
    // L'identité vient du token, jamais de la requête.
    assert.equal(q.filter.ownerId, userA, qs);
  }
});

test("accès interdit à la piste d'un autre utilisateur (lecture et suppression)", async () => {
  // Fausse base : une piste appartenant à A, avec un vrai fichier sur le disque.
  const storedName = `test-${crypto.randomUUID()}.mp3`;
  const filePath = path.join(UPLOADS, storedName);
  fs.writeFileSync(filePath, "audio de test");
  const id = new mongoose.Types.ObjectId().toString();
  const db = [{ _id: id, ownerId: userA, storedName, mimeType: "audio/mpeg" }];
  // Reproduit la sémantique Mongo du filtre { _id, ownerId } : le test
  // vérifie que la route transmet bien l'ownerId issu du token.
  const matches = (f) => (t) => t._id === f._id && t.ownerId === f.ownerId;
  mock.method(Track, "findOne", (f) => ({
    select: async () => db.find(matches(f)) ?? null,
  }));
  const findOneAndDelete = mock.method(Track, "findOneAndDelete", (f) => ({
    select: async () => {
      const i = db.findIndex(matches(f));
      return i === -1 ? null : db.splice(i, 1)[0];
    },
  }));

  try {
    // B ne peut ni lire ni supprimer la piste de A : 404 (pas 403, pour ne
    // pas révéler qu'elle existe).
    const read = await fetch(`${base}/api/tracks/${id}/audio`, { headers: bearer(userB) });
    assert.equal(read.status, 404);
    const del = await fetch(`${base}/api/tracks/${id}`, { method: "DELETE", headers: bearer(userB) });
    assert.equal(del.status, 404);
    assert.equal((await del.json()).message, "Piste inconnue");
    assert.equal(findOneAndDelete.mock.calls[0].arguments[0].ownerId, userB);
    assert.equal(db.length, 1, "la piste de A est intacte");
    assert.ok(fs.existsSync(filePath), "le fichier de A est intact");

    // A, lui, peut la supprimer : métadonnée ET fichier disparaissent.
    const own = await fetch(`${base}/api/tracks/${id}`, { method: "DELETE", headers: bearer(userA) });
    assert.equal(own.status, 204);
    assert.equal(db.length, 0);
    assert.ok(!fs.existsSync(filePath));

    // Une seconde suppression : 404 (déjà supprimée).
    const again = await fetch(`${base}/api/tracks/${id}`, { method: "DELETE", headers: bearer(userA) });
    assert.equal(again.status, 404);
  } finally {
    fs.rmSync(filePath, { force: true });
  }
});
