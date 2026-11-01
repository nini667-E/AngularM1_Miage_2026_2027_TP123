import test from "node:test";
import assert from "node:assert/strict";
import { cardTypes, checkTheme, describeCard, energyTypeFromName, nameWords } from "../src/services/card-info.js";

// Description des cartes et cohérence avec le thème (V2, étape 3) :
// fonctions pures, cas tirés des vrais noms du catalogue TCGdex.

test("nameWords découpe aussi aux majuscules et retire les accents", () => {
  assert.deepEqual(nameWords("Énergie Unitaire GrassFireWater"), ["energie", "unitaire", "grass", "fire", "water"]);
  assert.deepEqual(nameWords("Phyto-Énergie"), ["phyto", "energie"]);
});

test("type d'une Énergie déduit du nom (noms français et anglais)", () => {
  const cases = {
    "Énergie Feu": "Feu",
    "Énergie eau": "Eau",
    "Énergie Electrik de base": "Électrique",
    "Énergie Lightning Vélocité": "Électrique",
    "Énergie Darkness Repaire": "Obscurité",
    "Énergie Fairy de base": "Fée",
    "Double Énergie Aqua": "Eau",
    "Double Énergie Dragon": "Dragon",
    "Double Énergie Incolore": "Incolore",
    "Phyto-Énergie": "Plante",
  };
  for (const [name, type] of Object.entries(cases)) assert.equal(energyTypeFromName(name), type, name);
});

test("pas de type : Énergie spéciale, plusieurs types, ou faux ami « Cadeau »", () => {
  for (const name of [
    "Énergie Double Turbo",
    "Énergie Unitaire GrassFireWater",
    "Énergie Amalgamée WaterLightningFightingMetal",
    // Contient les lettres « eau » : comparer des mots entiers évite l'erreur.
    "Énergie Cadeau",
  ]) {
    assert.equal(energyTypeFromName(name), null, name);
  }
});

test("cardTypes : types TCGdex d'abord, sinon nom (Énergies seulement)", () => {
  assert.deepEqual(cardTypes({ category: "Énergie", name: "Énergie Feu", types: ["Eau"] }), ["Eau"]);
  assert.deepEqual(cardTypes({ category: "Énergie", name: "Énergie Feu" }), ["Feu"]);
  assert.deepEqual(cardTypes({ category: "Dresseur", name: "Feu de camp" }), []);
  assert.deepEqual(cardTypes({ category: "Pokémon", name: "Dracaufeu", types: ["Feu"] }), ["Feu"]);
});

test("describeCard : sous-catégorie, série de l'extension, logo en .png", () => {
  const info = describeCard(
    { id: "sv01-196", name: "Hyper Ball", category: "Dresseur", trainerType: "Objet", set: { id: "sv01", name: "EV", logo: "https://x/logo" } },
    { id: "sv01", serie: { id: "sv", name: "Écarlate et Violet" } },
  );
  assert.equal(info.subCategory, "Objet");
  assert.deepEqual(info.serie, { id: "sv", name: "Écarlate et Violet" });
  assert.equal(info.set.logo, "https://x/logo.png");
  assert.deepEqual(info.types, []);
});

const card = (fields) => ({
  category: "Pokémon",
  types: ["Feu"],
  set: { id: "sv03.5", name: "151" },
  serie: { id: "sv", name: "Écarlate et Violet" },
  ...fields,
});

test("cohérence : le type s'applique aux Pokémon et aux Énergies typées", () => {
  const theme = { type: "Feu" };
  assert.equal(checkTheme(card({}), theme).compatible, true);
  assert.deepEqual(checkTheme(card({ types: ["Eau"] }), theme), {
    compatible: false,
    reasons: ["Type Eau : l'album est réservé au type Feu"],
  });
  // Pokémon à deux types : accepté si l'un des deux correspond.
  assert.equal(checkTheme(card({ types: ["Eau", "Feu"] }), theme).compatible, true);
  assert.equal(checkTheme(card({ category: "Énergie", types: ["Eau"] }), theme).compatible, false);
});

test("cohérence : Dresseurs et Énergies sans type toujours acceptés pour le type", () => {
  const theme = { type: "Feu" };
  assert.equal(checkTheme(card({ category: "Dresseur", types: [] }), theme).compatible, true);
  assert.equal(checkTheme(card({ category: "Énergie", types: [] }), theme).compatible, true);
});

test("cohérence : série et extension s'appliquent à toutes les cartes", () => {
  const trainer = card({ category: "Dresseur", types: [], set: { id: "swsh3", name: "Ténèbres Embrasées" }, serie: { id: "swsh", name: "Épée et Bouclier" } });
  assert.deepEqual(checkTheme(trainer, { serie: { id: "sv", name: "Écarlate et Violet" } }).reasons, [
    "Série Épée et Bouclier : l'album est réservé à la série Écarlate et Violet",
  ]);
  assert.equal(checkTheme(card({}), { serie: { id: "sv" }, set: { id: "sv03.5" } }).compatible, true);
  assert.equal(checkTheme(card({ set: { id: "sv01", name: "EV" } }), { set: { id: "sv03.5", name: "151" } }).compatible, false);
});

test("cohérence : sans thème tout est accepté ; plusieurs raisons cumulées", () => {
  assert.equal(checkTheme(card({ types: ["Eau"] }), {}).compatible, true);
  const verdict = checkTheme(card({ types: ["Eau"], serie: { id: "swsh", name: "EB" } }), {
    type: "Feu",
    serie: { id: "sv", name: "EV" },
  });
  assert.equal(verdict.reasons.length, 2);
});
