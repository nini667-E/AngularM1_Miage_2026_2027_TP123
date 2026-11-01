import express from "express";
import { canView, isOwner } from "../access.js";
import { HttpError } from "../errors.js";
import { Album, DESCRIPTION_MAX, TITLE_MAX, VISIBILITIES } from "../models/Album.js";
import { User } from "../models/User.js";
import { resolveTheme } from "../services/theme.js";

// Réponse unique pour « n'existe pas » et « pas le droit » : un 403
// révélerait qu'un album avec cet identifiant existe (même logique que la
// suppression de piste au TP3).
const notFound = () => new HttpError(404, "Album inconnu");

/** Lit et borne les paramètres de pagination (?page=&limit=). */
export function pagination(query, defaultLimit = 12, maxLimit = 48) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Valide les champs modifiables d'un album. `partial` : en modification,
 * seuls les champs présents sont contrôlés.
 */
async function readAlbumInput(body = {}, partial = false) {
  const values = {};

  if (!partial || body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > TITLE_MAX) {
      throw new HttpError(400, `Titre requis (${TITLE_MAX} caractères maximum)`);
    }
    values.title = title;
  }

  if (body.description !== undefined) {
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length > DESCRIPTION_MAX) {
      throw new HttpError(400, `Description trop longue (${DESCRIPTION_MAX} caractères maximum)`);
    }
    values.description = description;
  }

  if (body.visibility !== undefined) {
    if (!VISIBILITIES.includes(body.visibility)) {
      throw new HttpError(400, "Visibilité invalide (private ou public)");
    }
    values.visibility = body.visibility;
  }

  if (!partial || body.theme !== undefined) {
    values.theme = await resolveTheme(body.theme ?? {});
  }

  return values;
}

export function albumRoutes(auth) {
  const router = express.Router();

  /** Crée un album appartenant à l'utilisateur du token. */
  router.post("/", auth, async (req, res, next) => {
    try {
      const values = await readAlbumInput(req.body);
      const album = await Album.create({ ...values, ownerId: req.auth.sub });
      console.log(`[albums] Album créé : ${album.id} par ${req.auth.sub}`);
      res.status(201).json(album.toPublic());
    } catch (error) {
      next(error);
    }
  });

  /** Mes albums, les plus récemment modifiés d'abord (Page<Album>). */
  router.get("/mine", auth, async (req, res, next) => {
    try {
      const { page, limit, skip } = pagination(req.query);
      const filter = { ownerId: req.auth.sub };
      const [albums, total] = await Promise.all([
        Album.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
        Album.countDocuments(filter),
      ]);
      res.json({
        items: albums.map((album) => album.toPublic()),
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (error) {
      next(error);
    }
  });

  /** Un album, si l'utilisateur a le droit de le voir (canView). */
  router.get("/:id", auth, async (req, res, next) => {
    try {
      const album = await Album.findById(req.params.id);
      if (!canView(album, req.auth.sub)) throw notFound();
      const owner = await User.findById(album.ownerId);
      res.json({
        ...album.toPublic(),
        owner: { id: String(album.ownerId), name: owner?.name ?? "Utilisateur supprimé" },
      });
    } catch (error) {
      next(error);
    }
  });

  /** Modifie un album (propriétaire uniquement). */
  router.put("/:id", auth, async (req, res, next) => {
    try {
      const album = await Album.findById(req.params.id);
      if (!isOwner(album, req.auth.sub)) throw notFound();
      Object.assign(album, await readAlbumInput(req.body, true));
      await album.save();
      console.log(`[albums] Album modifié : ${album.id}`);
      res.json(album.toPublic());
    } catch (error) {
      next(error);
    }
  });

  /** Supprime un album (propriétaire uniquement). Les cartes : étape 3. */
  router.delete("/:id", auth, async (req, res, next) => {
    try {
      const album = await Album.findOneAndDelete({ _id: req.params.id, ownerId: req.auth.sub });
      if (!album) throw notFound();
      console.log(`[albums] Album supprimé : ${album.id}`);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
