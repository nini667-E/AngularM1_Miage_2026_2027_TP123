import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { canView, isOwner } from "../src/access.js";

// Règles d'accès aux albums (V2, étape 2) : fonctions pures, testées sans
// serveur ni base.
const owner = new mongoose.Types.ObjectId();
const other = new mongoose.Types.ObjectId().toString();
const album = (visibility) => ({ ownerId: owner, visibility });

test("isOwner compare un ObjectId et une chaîne (identité du JWT)", () => {
  assert.equal(isOwner(album("private"), owner.toString()), true);
  assert.equal(isOwner(album("private"), other), false);
  assert.equal(isOwner(null, other), false);
  assert.equal(isOwner(album("private"), undefined), false);
});

test("canView : le propriétaire voit ses albums, privés comme publics", () => {
  assert.equal(canView(album("private"), owner.toString()), true);
  assert.equal(canView(album("public"), owner.toString()), true);
});

test("canView : un autre utilisateur ne voit que les albums publics", () => {
  assert.equal(canView(album("public"), other), true);
  assert.equal(canView(album("private"), other), false);
});

test("canView : album inexistant -> refusé", () => {
  assert.equal(canView(null, other), false);
});
