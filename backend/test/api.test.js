import test, { mock } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";

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

test("schéma Mongoose User", () => {
  const u = new User({
    name: "Test",
    email: "TEST@example.com",
    password: "12345678",
  });

  assert.equal(u.email, "test@example.com");
});

// ---------------------------------------------------------------------------
// Authentification (TP3, Mission 7, 08/10/2026 ; réorientés vers
// /api/users/me en V2, étape 1, après le retrait des routes /api/tracks).
// Aucun de ces tests ne se connecte à MongoDB : soit la requête est rejetée
// par le middleware auth avant tout accès à la base, soit la méthode du
// modèle est remplacée par une fausse (mock.method).
// ---------------------------------------------------------------------------

// Même règle que app.js : `npm test` ne charge pas .env, donc c'est le
// secret de développement qui signe et vérifie les tokens.
const SECRET = process.env.JWT_SECRET || "tp1-development-secret";
const userA = new mongoose.Types.ObjectId().toString();
const tokenFor = (sub, secret = SECRET, options = { expiresIn: "1h" }) =>
  jwt.sign({ sub, email: `${sub}@example.com` }, secret, options);

test.afterEach(() => mock.restoreAll());

test("401 sans JWT", async () => {
  const r = await fetch(base + "/api/users/me");
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
    const r = await fetch(base + "/api/users/me", { headers: { Authorization: `Bearer ${t}` } });
    assert.equal(r.status, 401);
    assert.equal((await r.json()).message, "Jeton invalide ou expiré");
  }
});

test("JWT valide : la route reçoit l'identité du token", async () => {
  const findById = mock.method(User, "findById", async (id) => ({
    toPublic: () => ({ id, name: "Sacha", email: "sacha@example.com" }),
  }));

  const r = await fetch(base + "/api/users/me", {
    headers: { Authorization: `Bearer ${tokenFor(userA)}` },
  });

  assert.equal(r.status, 200);
  assert.equal((await r.json()).id, userA);
  // L'identifiant vient du token signé, jamais d'une donnée envoyée par le client.
  assert.equal(findById.mock.calls[0].arguments[0], userA);
});

test("route /api/tracks retirée en V2 : 404", async () => {
  const r = await fetch(base + "/api/tracks", {
    headers: { Authorization: `Bearer ${tokenFor(userA)}` },
  });
  assert.equal(r.status, 404);
});
