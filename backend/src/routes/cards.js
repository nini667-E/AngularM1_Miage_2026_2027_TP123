import express from "express";
import multer from "multer";
import path from "node:path";
import { canView, isOwner } from "../access.js";
import { UPLOADS } from "../config.js";
import { HttpError } from "../errors.js";
import { Album } from "../models/Album.js";
import { Card } from "../models/Card.js";
import { checkTheme, loadCardInfo } from "../services/card-info.js";
import { deletePhotoFiles, MAX_PHOTO_SIZE, processPhoto, readAdjustments, signedImageUrl, verifyImageSignature } from "../services/images.js";
import { officialImage } from "../services/tcgdex.js";
import { pagination } from "./albums.js";

export const CATEGORIES = ["Pokémon", "Dresseur", "Énergie"];

/*
 * Multer en mémoire : la photo n'est écrite sur le disque qu'après
 * vérification par sharp (services/images.js), et jamais sous sa forme
 * d'origine. La limite de taille est appliquée pendant la réception.
 */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_SIZE, files: 1 } });

/** Carte telle qu'exposée par l'API, avec les URL signées de sa photo. */
export function toPublicCard(card, now = Date.now()) {
  return {
    id: String(card._id),
    albumId: String(card.albumId),
    tcgdexId: card.tcgdexId,
    name: card.name,
    localId: card.localId ?? null,
    category: card.category ?? null,
    subCategory: card.subCategory ?? null,
    types: card.types ?? [],
    rarity: card.rarity ?? null,
    set: card.set ? { id: card.set.id, name: card.set.name ?? null, logo: card.set.logo ?? null } : null,
    serie: card.serie ? { id: card.serie.id, name: card.serie.name ?? null } : null,
    officialImage: { small: officialImage(card.officialImage, "low"), large: officialImage(card.officialImage, "high") },
    photo: { thumb: signedImageUrl(card._id, "thumb", now), full: signedImageUrl(card._id, "full", now) },
    createdAt: card.createdAt,
  };
}

const albumNotFound = () => new HttpError(404, "Album inconnu");

/** Cartes d'un album : /api/albums/:id/cards. */
export function albumCardRoutes(auth) {
  const router = express.Router();

  /** Une page du classeur (9 cartes par défaut), filtrable par catégorie. */
  router.get("/:id/cards", auth, async (req, res, next) => {
    try {
      const album = await Album.findById(req.params.id);
      if (!canView(album, req.auth.sub)) throw albumNotFound();

      const { page, limit, skip } = pagination(req.query, 9, 36);
      const filter = { albumId: album._id };
      if (req.query.category !== undefined) {
        if (!CATEGORIES.includes(req.query.category)) throw new HttpError(400, "Catégorie invalide");
        filter.category = req.query.category;
      }
      const [cards, total] = await Promise.all([
        Card.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit),
        Card.countDocuments(filter),
      ]);
      const now = Date.now();
      res.json({
        items: cards.map((card) => toPublicCard(card, now)),
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Ajoute une carte : multipart avec `photo` (fichier), `tcgdexId`, et
   * facultativement `crop` (JSON) et `rotation` (quarts de tour).
   * Ordre des contrôles : propriétaire, photo présente, réglages bien
   * formés, carte existante, cohérence avec le thème, puis seulement
   * traitement de la photo (inutile d'écrire des fichiers pour une carte
   * refusée).
   */
  router.post("/:id/cards", auth, upload.single("photo"), async (req, res, next) => {
    let files;
    try {
      const album = await Album.findById(req.params.id);
      if (!isOwner(album, req.auth.sub)) throw albumNotFound();
      if (!req.file) throw new HttpError(400, "Photo de la carte requise");
      const adjustments = readAdjustments(req.body);

      const info = await loadCardInfo(req.body?.tcgdexId);
      const verdict = checkTheme(info, album.theme);
      if (!verdict.compatible) throw new HttpError(400, verdict.reasons.join(" ; "));

      files = await processPhoto(req.file.buffer, adjustments);
      const card = await Card.create({
        ...info,
        albumId: album._id,
        ownerId: req.auth.sub,
        photo: files,
      });
      await Album.updateOne({ _id: album._id }, { $inc: { cardCount: 1 } });
      console.log(`[cards] Carte ${info.tcgdexId} ajoutée à l'album ${album.id}`);
      res.status(201).json(toPublicCard(card));
    } catch (error) {
      // Photo déjà écrite mais carte non enregistrée : on ne laisse pas de
      // fichier orphelin.
      if (files) await deletePhotoFiles(files);
      next(error);
    }
  });

  return router;
}

/** Suppression d'une carte : /api/cards/:id (propriétaire uniquement). */
export function cardRoutes(auth) {
  const router = express.Router();

  router.delete("/:id", auth, async (req, res, next) => {
    try {
      const card = await Card.findOneAndDelete({ _id: req.params.id, ownerId: req.auth.sub }).select(
        "+photo.thumb +photo.full",
      );
      if (!card) throw new HttpError(404, "Carte inconnue");
      await deletePhotoFiles(card.photo);
      await Album.updateOne({ _id: card.albumId }, { $inc: { cardCount: -1 } });
      console.log(`[cards] Carte supprimée : ${card.id}`);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/**
 * Photos : /api/images/:cardId/:size?exp=&sig=. Pas de JWT (une balise <img>
 * ne l'envoie pas) : c'est la signature qui prouve que l'URL a été délivrée
 * par le serveur à quelqu'un qui pouvait voir l'album.
 */
export function imageRoutes() {
  const router = express.Router();

  router.get("/:cardId/:size", async (req, res, next) => {
    try {
      const { cardId, size } = req.params;
      if (!verifyImageSignature(cardId, size, req.query.exp, req.query.sig)) {
        throw new HttpError(403, "Lien d'image invalide ou expiré");
      }
      const card = await Card.findById(cardId).select("+photo.thumb +photo.full");
      if (!card) throw new HttpError(404, "Image inconnue");

      // Cache privé jusqu'à l'échéance de la signature.
      const maxAge = Math.max(0, Math.floor((Number(req.query.exp) - Date.now()) / 1000));
      res.set("Cache-Control", `private, max-age=${maxAge}`);
      res.type("image/webp");
      res.sendFile(path.join(UPLOADS, card.photo[size]), (error) => {
        if (error && !res.headersSent) next(new HttpError(404, "Image inconnue"));
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
