import express from "express";
import { canView, isOwner } from "../access.js";
import { HttpError } from "../errors.js";
import { Album, DESCRIPTION_MAX, TITLE_MAX, VISIBILITIES } from "../models/Album.js";
import { Card } from "../models/Card.js";
import { Comment } from "../models/Comment.js";
import { Like } from "../models/Like.js";
import { checkTheme } from "../services/card-info.js";
import { deletePhotoFiles } from "../services/images.js";
import { User } from "../models/User.js";
import { byName, friendIds, publicUsers, relationBetween } from "../services/friends.js";
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
      res.status(201).json(album.toPublic(req.auth.sub));
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
        items: albums.map((album) => album.toPublic(req.auth.sub)),
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
   * Albums privés partagés avec moi (étape 5), les plus récemment modifiés
   * d'abord, avec leur propriétaire. Déclarée avant /:id.
   */
  router.get("/shared", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const { page, limit, skip } = pagination(req.query);
      const filter = { visibility: "private", sharedWith: me };
      const [albums, total] = await Promise.all([
        Album.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
        Album.countDocuments(filter),
      ]);
      const owners = await publicUsers([...new Set(albums.map((album) => String(album.ownerId)))]);
      const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
      res.json({
        items: albums.map((album) => ({ ...album.toPublic(me), owner: ownerById.get(String(album.ownerId)) })),
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (error) {
      next(error);
    }
  });

  /** Mes amis, avec pour chacun : l'album lui est-il partagé ? (propriétaire seulement) */
  router.get("/:id/shares", auth, async (req, res, next) => {
    try {
      const album = await Album.findById(req.params.id);
      if (!isOwner(album, req.auth.sub)) throw notFound();
      const friends = await publicUsers(await friendIds(req.auth.sub));
      const shared = new Set((album.sharedWith ?? []).map(String));
      res.json(friends.map((user) => ({ user, shared: shared.has(user.id) })).sort(byName));
    } catch (error) {
      next(error);
    }
  });

  /**
   * Remplace la liste des amis avec qui l'album est partagé (propriétaire
   * seulement). Un ami absent de la liste ne voit plus l'album privé :
   * c'est ainsi qu'on arrête un partage ; une liste vide les arrête tous.
   */
  router.put("/:id/shares", auth, async (req, res, next) => {
    try {
      const album = await Album.findById(req.params.id);
      if (!isOwner(album, req.auth.sub)) throw notFound();

      const ids = req.body?.userIds;
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
        throw new HttpError(400, "userIds doit être une liste d'identifiants");
      }
      const unique = [...new Set(ids)];
      const friends = new Set(await friendIds(req.auth.sub));
      if (unique.some((id) => !friends.has(id))) {
        throw new HttpError(400, "Tu ne peux partager un album qu'avec tes amis");
      }

      album.sharedWith = unique;
      await album.save();
      console.log(`[albums] Partage de ${album.id} : ${unique.length} ami(s)`);
      res.json(album.toPublic(req.auth.sub));
    } catch (error) {
      next(error);
    }
  });

  /** Un album, si l'utilisateur a le droit de le voir (canView), avec ma relation avec son propriétaire. */
  router.get("/:id", auth, async (req, res, next) => {
    try {
      const album = await Album.findById(req.params.id);
      if (!canView(album, req.auth.sub)) throw notFound();
      const [owner, relation] = await Promise.all([
        User.findById(album.ownerId),
        relationBetween(req.auth.sub, album.ownerId),
      ]);
      res.json({
        ...album.toPublic(req.auth.sub),
        // relation : bouton « Inviter en ami » de la page d'album (étape 4).
        owner: { id: String(album.ownerId), name: owner?.name ?? "Utilisateur supprimé", relation },
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
      const values = await readAlbumInput(req.body, true);

      // Nouveau thème : les cartes déjà rangées doivent toujours le respecter
      // (sinon l'album contiendrait des cartes hors thème).
      if (values.theme && album.cardCount > 0) {
        const cards = await Card.find({ albumId: album._id }).select("name category types set serie");
        const refused = cards.filter((card) => !checkTheme(card, values.theme).compatible);
        if (refused.length > 0) {
          throw new HttpError(
            409,
            `Thème refusé : ${refused.length} carte(s) de l'album ne le respectent pas (ex. ${refused[0].name})`,
          );
        }
      }

      Object.assign(album, values);
      await album.save();
      console.log(`[albums] Album modifié : ${album.id}`);
      res.json(album.toPublic(req.auth.sub));
    } catch (error) {
      next(error);
    }
  });

  /** Supprime un album (propriétaire uniquement), avec ses cartes, leurs photos et ses réactions. */
  router.delete("/:id", auth, async (req, res, next) => {
    try {
      const album = await Album.findOneAndDelete({ _id: req.params.id, ownerId: req.auth.sub });
      if (!album) throw notFound();
      const cards = await Card.find({ albumId: album._id }).select("+photo.thumb +photo.full");
      await Promise.all([
        Card.deleteMany({ albumId: album._id }),
        // Réactions de l'album (étape 6).
        Like.deleteMany({ albumId: album._id }),
        Comment.deleteMany({ albumId: album._id }),
      ]);
      for (const card of cards) await deletePhotoFiles(card.photo);
      console.log(`[albums] Album supprimé : ${album.id} (${cards.length} carte(s))`);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
