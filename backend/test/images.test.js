import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { UPLOADS } from "../src/config.js";
import {
  deletePhotoFiles,
  expiryFor,
  processPhoto,
  readAdjustments,
  signedImageUrl,
  verifyImageSignature,
} from "../src/services/images.js";

// Traitement des photos et URL signées (V2, étape 3), avec de vraies images
// générées par sharp. Les fichiers produits sont supprimés à la fin.

// Les fichiers produits sont lus en mémoire avant analyse : sharp(chemin)
// les garderait ouverts dans son cache, et Windows refuserait ensuite de
// les supprimer (EBUSY).
const metadataOf = (name) => sharp(fs.readFileSync(path.join(UPLOADS, name))).metadata();

/** Photo de « téléphone » : 300×200 pivotée (orientation 6) avec position GPS. */
function phonePhoto() {
  return sharp({ create: { width: 300, height: 200, channels: 3, background: "#c9a24d" } })
    .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "48/1 51/1 24/1" } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
}

test("la photo de départ contient bien une orientation et des données EXIF", async () => {
  const meta = await sharp(await phonePhoto()).metadata();
  assert.equal(meta.orientation, 6);
  assert.ok(meta.exif, "EXIF attendu dans la photo de test");
});

test("processPhoto : miniature + grand format WebP, redressés, sans EXIF ni GPS", async () => {
  const files = await processPhoto(await phonePhoto());
  try {
    for (const name of [files.thumb, files.full]) {
      const meta = await metadataOf(name);
      assert.equal(meta.format, "webp");
      assert.equal(meta.exif, undefined, `${name} ne doit plus contenir d'EXIF`);
      // Orientation 6 = pivotée de 90° : la photo redressée est en portrait.
      assert.deepEqual([meta.width, meta.height], [200, 300]);
    }
  } finally {
    await deletePhotoFiles(files);
  }
  assert.equal(fs.existsSync(path.join(UPLOADS, files.thumb)), false);
});

test("processPhoto : grande photo réduite à 400 px (miniature) et 1600 px (grand format)", async () => {
  const big = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: "#123" } }).png().toBuffer();
  const files = await processPhoto(big);
  try {
    assert.equal((await metadataOf(files.thumb)).width, 400);
    const full = await metadataOf(files.full);
    assert.deepEqual([full.width, full.height], [1200, 1600]);
  } finally {
    await deletePhotoFiles(files);
  }
});

test("processPhoto refuse ce qui n'est pas une image JPEG, PNG ou WebP (400)", async () => {
  const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).gif().toBuffer();
  const before = fs.readdirSync(UPLOADS).length;
  for (const buffer of [Buffer.from("MZ\x90\x00 pas une image"), Buffer.alloc(0), gif]) {
    await assert.rejects(processPhoto(buffer), { status: 400, message: "Le fichier n'est pas une image valide (JPEG, PNG ou WebP)" });
  }
  assert.equal(fs.readdirSync(UPLOADS).length, before, "aucun fichier écrit");
});

// ------------------------------------------------------------ URL signées

const NOW = Date.UTC(2026, 10, 1, 14, 20);
const parse = (url) => {
  const u = new URL(url, "http://x");
  const [, , , cardId, size] = u.pathname.split("/");
  return { cardId, size, exp: u.searchParams.get("exp"), sig: u.searchParams.get("sig") };
};

test("échéance arrondie : même URL pendant toute l'heure, valable 1 à 2 h", () => {
  assert.equal(expiryFor(NOW), expiryFor(NOW + 30 * 60 * 1000));
  assert.equal(signedImageUrl("c1", "thumb", NOW), signedImageUrl("c1", "thumb", NOW + 39 * 60 * 1000));
  const validity = expiryFor(NOW) - NOW;
  assert.ok(validity > 60 * 60 * 1000 && validity <= 2 * 60 * 60 * 1000);
});

test("signature valide acceptée ; carte, taille, échéance ou signature modifiées refusées", () => {
  const { cardId, size, exp, sig } = parse(signedImageUrl("c1", "thumb", NOW));
  assert.equal(verifyImageSignature(cardId, size, exp, sig, NOW), true);

  assert.equal(verifyImageSignature("c2", size, exp, sig, NOW), false, "autre carte");
  assert.equal(verifyImageSignature(cardId, "full", exp, sig, NOW), false, "autre taille");
  assert.equal(verifyImageSignature(cardId, size, String(Number(exp) + 3600000), sig, NOW), false, "échéance repoussée");
  assert.equal(verifyImageSignature(cardId, size, exp, sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A"), NOW), false, "signature modifiée");
  assert.equal(verifyImageSignature(cardId, "original", exp, sig, NOW), false, "taille inconnue");
  assert.equal(verifyImageSignature(cardId, size, "abc", sig, NOW), false, "échéance non numérique");
});

test("signature expirée refusée", () => {
  const { cardId, size, exp, sig } = parse(signedImageUrl("c1", "thumb", NOW));
  assert.equal(verifyImageSignature(cardId, size, exp, sig, Number(exp) + 1), false);
});

// ----------------------------------------------- recadrage et rotation

/** Image debout 200×300 : moitié haute rouge, moitié basse bleue. */
function redTopBlueBottom() {
  return sharp({ create: { width: 200, height: 300, channels: 3, background: "#0000ff" } })
    .composite([{ input: { create: { width: 200, height: 150, channels: 3, background: "#ff0000" } }, top: 0, left: 0 }])
    .png()
    .toBuffer();
}
/** Couleur dominante d'une photo produite : "rouge" ou "bleu". */
async function dominant(name) {
  const { channels } = await sharp(fs.readFileSync(path.join(UPLOADS, name))).stats();
  return channels[0].mean > channels[2].mean ? "rouge" : "bleu";
}

test("recadrage : c'est bien la zone choisie qui est gardée", async () => {
  const image = await redTopBlueBottom();
  const top = await processPhoto(image, { crop: { left: 0, top: 0, width: 200, height: 150 } });
  const bottom = await processPhoto(image, { crop: { left: 0, top: 150, width: 200, height: 150 } });
  try {
    assert.equal(await dominant(top.full), "rouge");
    assert.equal(await dominant(bottom.full), "bleu");
    assert.deepEqual([(await metadataOf(top.full)).width, (await metadataOf(top.full)).height], [200, 150]);
  } finally {
    await deletePhotoFiles(top);
    await deletePhotoFiles(bottom);
  }
});

test("recadrage d'une photo « couchée » (EXIF 6) : coordonnées de la photo redressée", async () => {
  // Pixels enregistrés couchés + orientation 6, comme un téléphone : une
  // fois redressée, la photo redevient « rouge en haut, bleu en bas ».
  const lying = await sharp(await sharp(await redTopBlueBottom()).rotate(-90).toBuffer())
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
  // Zone choisie pour trancher : en bas de la photo redressée (bleu), mais
  // en haut à gauche des pixels bruts couchés (rouge) si l'orientation
  // était ignorée.
  const files = await processPhoto(lying, { crop: { left: 0, top: 150, width: 100, height: 50 } });
  try {
    assert.equal(await dominant(files.full), "bleu");
  } finally {
    await deletePhotoFiles(files);
  }
});

test("rotation demandée (½ tour) appliquée AVANT le découpage", async () => {
  // Après un demi-tour, le bleu est en haut : le même cadre « haut » le garde.
  const files = await processPhoto(await redTopBlueBottom(), { rotation: 2, crop: { left: 0, top: 0, width: 200, height: 150 } });
  try {
    assert.equal(await dominant(files.full), "bleu");
  } finally {
    await deletePhotoFiles(files);
  }
});

test("rotation demandée (¼ de tour) dans le sens horaire : le haut passe à droite", async () => {
  // 200×300 tournée d'un quart de tour horaire -> 300×200, le rouge (haut)
  // se retrouve à droite. Dans le sens antihoraire, il serait à gauche.
  const right = await processPhoto(await redTopBlueBottom(), { rotation: 1, crop: { left: 150, top: 0, width: 150, height: 200 } });
  try {
    assert.equal(await dominant(right.full), "rouge");
  } finally {
    await deletePhotoFiles(right);
  }
});

test("recadrage hors de l'image (après rotation) : 400, aucun fichier écrit", async () => {
  const before = fs.readdirSync(UPLOADS).length;
  // Image 200×300 tournée d'un quart de tour : 300×200, un cadre de 250 de haut déborde.
  await assert.rejects(processPhoto(await redTopBlueBottom(), { rotation: 1, crop: { left: 0, top: 0, width: 150, height: 250 } }), {
    status: 400,
    message: "Recadrage invalide",
  });
  assert.equal(fs.readdirSync(UPLOADS).length, before);
});

test("readAdjustments : valeurs facultatives, mal formées refusées", () => {
  assert.deepEqual(readAdjustments({}), { rotation: 0, crop: null });
  assert.deepEqual(readAdjustments({ rotation: "3", crop: '{"x":1,"y":2,"width":300,"height":420}' }), {
    rotation: 3,
    crop: { left: 1, top: 2, width: 300, height: 420 },
  });
  for (const body of [
    { rotation: "4" },
    { rotation: "1.5" },
    { rotation: "-1" },
    { crop: "pas du json" },
    { crop: '{"x":0,"y":0,"width":50,"height":70}' }, // trop petit
    { crop: '{"x":-1,"y":0,"width":300,"height":420}' },
    { crop: '{"x":0.5,"y":0,"width":300,"height":420}' },
    { crop: '{"x":0,"y":0,"width":300}' },
    { crop: "null" },
  ]) {
    assert.throws(() => readAdjustments(body), { status: 400, message: "Recadrage invalide" }, JSON.stringify(body));
  }
});
