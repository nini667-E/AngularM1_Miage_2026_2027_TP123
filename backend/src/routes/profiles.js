import express from "express";
import mongoose from "mongoose";
import { visibleAlbumsFilter } from "../access.js";
import { HttpError } from "../errors.js";
import { Album } from "../models/Album.js";
import { Friendship } from "../models/Friendship.js";
import { BIO_MAX, NAME_MAX, publicAvatar, User } from "../models/User.js";
import { publicUser, relationBetween } from "../services/friends.js";
import { getCard } from "../services/tcgdex.js";
import { pagination } from "./albums.js";

/*
 * Profils (V2, étape 8) : modification de mon profil (pseudo, bio, avatar)
 * et page publique d'un collectionneur (identité, chiffres, albums que je
 * peux voir). L'email d'un autre utilisateur ne sort jamais.
 */

const userNotFound = () => new HttpError(404, "Utilisateur inconnu");

/**
 * Valide les champs modifiables de mon profil ; seuls les champs envoyés
 * sont modifiés. `avatarId` : identifiant d'une carte TCGdex (son
 * illustration devient l'avatar), ou null pour revenir à l'initiale.
 */
export async function readProfileInput(body = {}) {
  const values = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > NAME_MAX) {
      throw new HttpError(400, `Pseudo de 2 à ${NAME_MAX} caractères`);
    }
    values.name = name;
  }

  if (body.bio !== undefined) {
    const bio = typeof body.bio === "string" ? body.bio.trim() : null;
    if (bio === null || bio.length > BIO_MAX) throw new HttpError(400, `Bio trop longue (${BIO_MAX} caractères maximum)`);
    values.bio = bio;
  }

  if (body.avatarId !== undefined) {
    if (body.avatarId === null) {
      values.avatar = null;
    } else {
      const card = typeof body.avatarId === "string" ? await getCard(body.avatarId.trim()) : null;
      if (!card) throw new HttpError(400, "Carte inconnue");
      if (!card.image) throw new HttpError(400, "Cette carte n'a pas d'illustration officielle");
      values.avatar = { tcgdexId: card.id, name: card.name, image: card.image };
    }
  }

  return values;
}

export function profileRoutes(auth) {
  const router = express.Router();

  /**
   * Profil public d'un collectionneur : identité, ma relation avec lui, et
   * des chiffres calculés sur ses albums que JE peux voir.
   */
  router.get("/:id", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const user = mongoose.isValidObjectId(req.params.id) ? await User.findById(req.params.id) : null;
      if (!user) throw userNotFound();

      const [relation, albums, friends] = await Promise.all([
        relationBetween(me, user._id),
        Album.find({ $and: [{ ownerId: user._id }, visibleAlbumsFilter(me)] }, "cardCount likeCount"),
        Friendship.countDocuments({ status: "accepted", $or: [{ requester: user._id }, { recipient: user._id }] }),
      ]);
      res.json({
        ...publicUser(user),
        bio: user.bio ?? "",
        avatar: publicAvatar(user.avatar),
        createdAt: user.createdAt,
        relation,
        stats: {
          albums: albums.length,
          cards: albums.reduce((sum, album) => sum + (album.cardCount ?? 0), 0),
          likes: albums.reduce((sum, album) => sum + (album.likeCount ?? 0), 0),
          friends,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /** Ses albums que je peux voir, les plus récemment modifiés d'abord (Page<Album>). */
  router.get("/:id/albums", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      if (!mongoose.isValidObjectId(req.params.id)) throw userNotFound();
      const { page, limit, skip } = pagination(req.query);
      const filter = { $and: [{ ownerId: req.params.id }, visibleAlbumsFilter(me)] };
      const [albums, total] = await Promise.all([
        Album.find(filter, null, { sort: { updatedAt: -1 }, skip, limit }),
        Album.countDocuments(filter),
      ]);
      res.json({
        items: albums.map((album) => album.toPublic(me)),
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
