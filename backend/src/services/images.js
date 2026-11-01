import crypto from "node:crypto";
import fsPromises from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { SECRET, UPLOADS } from "../config.js";
import { HttpError } from "../errors.js";

/*
 * Photos de cartes (V2, étape 3) : traitement par sharp, puis affichage par
 * URL signées.
 */

export const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
export const PHOTO_SIZES = ["thumb", "full"];
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

export const MIN_CROP_WIDTH = 100;

/**
 * Lit les réglages envoyés avec la photo (facultatifs) :
 * - `rotation` : nombre de quarts de tour dans le sens horaire (0 à 3),
 *   choisi avec les boutons de l'interface ;
 * - `crop` : JSON { x, y, width, height } en pixels de la photo redressée
 *   puis tournée (le repère de ngx-image-cropper côté Angular).
 * Lève une HttpError 400 si les valeurs sont mal formées ; le contrôle
 * « le cadre est dans l'image » se fait après la rotation (processPhoto).
 */
export function readAdjustments(body = {}) {
  const invalid = () => new HttpError(400, "Recadrage invalide");
  let rotation = 0;
  if (body.rotation !== undefined && body.rotation !== "") {
    rotation = Number(body.rotation);
    if (!Number.isInteger(rotation) || rotation < 0 || rotation > 3) throw invalid();
  }
  let crop = null;
  if (body.crop !== undefined && body.crop !== "") {
    try {
      crop = JSON.parse(body.crop);
    } catch {
      throw invalid();
    }
    const keys = ["x", "y", "width", "height"];
    if (!crop || typeof crop !== "object" || !keys.every((k) => Number.isInteger(crop[k]) && crop[k] >= 0)) throw invalid();
    if (crop.width < MIN_CROP_WIDTH) throw invalid();
    crop = { left: crop.x, top: crop.y, width: crop.width, height: crop.height };
  }
  return { rotation, crop };
}

/**
 * Vérifie que le fichier est réellement une image (sharp lit son contenu :
 * un .exe renommé en .jpg est refusé, contrairement à un simple contrôle du
 * type MIME annoncé par le navigateur), applique les réglages de
 * l'utilisateur, puis écrit deux versions WebP :
 * - thumb : 400 px de large, pour le classeur ;
 * - full  : 1600 px maximum, pour le zoom.
 * Étapes, dans le même ordre que l'aperçu affiché par Angular :
 * 1. rotate() redresse la photo selon son orientation EXIF ;
 * 2. rotation demandée par l'utilisateur (quarts de tour) ;
 * 3. découpage du cadre choisi (s'il y en a un).
 * sharp n'applique qu'une rotation par traitement : chaque étape produit
 * donc une image intermédiaire en mémoire. Comme sharp ne recopie aucune
 * métadonnée par défaut, les données EXIF (dont la position GPS d'une
 * photo de téléphone) disparaissent.
 */
export async function processPhoto(buffer, { rotation = 0, crop = null } = {}) {
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (error) {
    console.warn("[images] Fichier illisible comme image", error.message);
    throw new HttpError(400, "Le fichier n'est pas une image valide (JPEG, PNG ou WebP)");
  }
  if (!ACCEPTED_FORMATS.has(metadata.format)) {
    throw new HttpError(400, "Le fichier n'est pas une image valide (JPEG, PNG ou WebP)");
  }

  let prepared;
  try {
    prepared = await sharp(buffer, { failOn: "error" }).rotate().toBuffer();
    if (rotation) prepared = await sharp(prepared).rotate(90 * rotation).toBuffer();
  } catch (error) {
    console.warn("[images] Image corrompue", error.message);
    throw new HttpError(400, "Le fichier n'est pas une image valide (JPEG, PNG ou WebP)");
  }
  if (crop) {
    const { width, height } = await sharp(prepared).metadata();
    if (crop.left + crop.width > width || crop.top + crop.height > height) {
      throw new HttpError(400, "Recadrage invalide");
    }
    prepared = await sharp(prepared).extract(crop).toBuffer();
  }

  const base = crypto.randomUUID();
  const files = { thumb: `${base}-thumb.webp`, full: `${base}-full.webp` };
  try {
    await sharp(prepared).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(UPLOADS, files.thumb));
    await sharp(prepared)
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(path.join(UPLOADS, files.full));
  } catch (error) {
    await deletePhotoFiles(files);
    console.error("[images] Écriture de la photo impossible", error);
    throw error;
  }
  console.log(`[images] Photo traitée : ${base}${crop ? " (recadrée)" : ""}${rotation ? ` (+${rotation}/4 tour)` : ""}`);
  return files;
}

/** Supprime les fichiers d'une photo ; un fichier déjà absent n'est pas une erreur. */
export async function deletePhotoFiles(photo) {
  for (const name of [photo?.thumb, photo?.full]) {
    if (!name) continue;
    try {
      await fsPromises.unlink(path.join(UPLOADS, name));
    } catch (error) {
      if (error.code !== "ENOENT") console.error(`[images] Fichier non supprimé : ${name}`, error);
    }
  }
}

// ---------------------------------------------------------------------------
// URL signées
// ---------------------------------------------------------------------------
// Une balise <img src> n'envoie pas le JWT. Plutôt que de télécharger chaque
// photo en Blob (méthode de la V1, sans cache), le serveur fournit, à ceux
// qui ont le droit de voir l'album, une URL portant une signature :
//   /api/images/<carte>/<taille>?exp=<échéance>&sig=<HMAC-SHA256>
// La signature est calculée avec le secret du serveur : impossible à
// fabriquer ou à modifier (autre carte, autre taille, échéance repoussée)
// sans le connaître.

const HOUR = 60 * 60 * 1000;

/**
 * Échéance arrondie : fin de l'heure suivante. Toutes les URL d'une même
 * carte générées pendant la même heure sont donc identiques, ce qui permet
 * au navigateur de les garder en cache. Validité entre 1 et 2 heures.
 */
export function expiryFor(now = Date.now()) {
  return Math.floor(now / HOUR) * HOUR + 2 * HOUR;
}

function sign(cardId, size, exp) {
  return crypto.createHmac("sha256", SECRET).update(`${cardId}.${size}.${exp}`).digest("base64url");
}

export function signedImageUrl(cardId, size, now = Date.now()) {
  const exp = expiryFor(now);
  return `/api/images/${cardId}/${size}?exp=${exp}&sig=${sign(String(cardId), size, exp)}`;
}

/** Vrai si la signature correspond et que l'échéance n'est pas dépassée. */
export function verifyImageSignature(cardId, size, exp, sig, now = Date.now()) {
  if (!PHOTO_SIZES.includes(size) || !/^\d+$/.test(exp ?? "") || typeof sig !== "string") return false;
  if (Number(exp) < now) return false;
  const expected = Buffer.from(sign(cardId, size, exp));
  const received = Buffer.from(sig);
  // Comparaison en temps constant : ne révèle pas, par la durée de la
  // vérification, combien de caractères de la signature sont justes.
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
