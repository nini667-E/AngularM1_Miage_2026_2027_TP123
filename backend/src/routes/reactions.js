import express from "express";
import mongoose from "mongoose";
import { canView, isOwner, reactionRights } from "../access.js";
import { HttpError } from "../errors.js";
import { Album } from "../models/Album.js";
import { Comment, COMMENT_MAX } from "../models/Comment.js";
import { Like } from "../models/Like.js";
import { areFriends, publicUsers } from "../services/friends.js";
import { pagination } from "./albums.js";

/*
 * Likes et commentaires (V2, étape 6). Lire : quiconque voit l'album.
 * Réagir : les amis du propriétaire aiment et commentent ; le propriétaire
 * répond à leurs commentaires (un seul niveau de réponse).
 * Album invisible : 404 comme partout ; album visible mais réaction
 * interdite : 403 (l'album existe pour lui, seule l'action est refusée).
 */

const albumNotFound = () => new HttpError(404, "Album inconnu");

/** L'album, s'il est visible par `userId` ; sinon 404. */
async function visibleAlbum(id, userId) {
  const album = await Album.findById(id);
  if (!canView(album, userId)) throw albumNotFound();
  return album;
}

/** Droits de réaction de `userId` sur un album visible. */
async function rightsOn(album, userId) {
  const isFriend = !isOwner(album, userId) && (await areFriends(album.ownerId, userId));
  return reactionRights(album, userId, isFriend);
}

/** Un commentaire tel que l'API l'envoie ; `replies` : ses réponses (commentaire principal). */
function toPublicComment(comment, author, album, userId, replies = []) {
  return {
    id: String(comment._id),
    albumId: String(comment.albumId),
    parentId: comment.parentId ? String(comment.parentId) : null,
    author,
    text: comment.text,
    createdAt: comment.createdAt,
    // L'auteur, ou le propriétaire de l'album (étape 6).
    canDelete: String(comment.authorId) === String(userId) || isOwner(album, userId),
    replies,
  };
}

/** Ajoute `delta` à un compteur de l'album (sans jamais le faire passer sous 0). */
function bump(albumId, field, delta) {
  const filter = delta < 0 ? { _id: albumId, [field]: { $gte: -delta } } : { _id: albumId };
  return Album.updateOne(filter, { $inc: { [field]: delta } });
}

/** Routes montées sur /api/albums : réactions d'un album. */
export function albumReactionRoutes(auth) {
  const router = express.Router();

  /**
   * Résumé des réactions : nombre de likes, qui aime, est-ce que j'aime, et
   * mes droits (aimer, commenter, retirer les likes reçus).
   */
  router.get("/:id/reactions", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const album = await visibleAlbum(req.params.id, me);
      const [rights, likes] = await Promise.all([
        rightsOn(album, me),
        Like.find({ albumId: album._id }, null, { sort: { createdAt: -1 } }),
      ]);
      const likers = await publicUsers(likes.map((like) => String(like.userId)));
      res.json({
        likeCount: likes.length,
        likedByMe: likes.some((like) => String(like.userId) === String(me)),
        likers,
        commentCount: album.commentCount ?? 0,
        ...rights,
        canRemoveLikes: isOwner(album, me),
      });
    } catch (error) {
      next(error);
    }
  });

  /** J'aime l'album (ami du propriétaire). Répéter ne change rien. */
  router.put("/:id/likes/me", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const album = await visibleAlbum(req.params.id, me);
      const { canLike } = await rightsOn(album, me);
      if (!canLike) {
        throw new HttpError(
          403,
          isOwner(album, me) ? "Tu ne peux pas aimer ton propre album" : "Seuls les amis du propriétaire peuvent aimer cet album",
        );
      }
      const result = await Like.updateOne(
        { albumId: album._id, userId: me },
        { $setOnInsert: { albumId: album._id, userId: me } },
        { upsert: true },
      );
      const added = result.upsertedCount === 1;
      if (added) await bump(album._id, "likeCount", 1);
      console.log(`[reactions] ${me} aime ${album.id}${added ? "" : " (déjà)"}`);
      res.json({ likeCount: (album.likeCount ?? 0) + (added ? 1 : 0), likedByMe: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Je n'aime plus l'album. Toujours possible tant que je vois l'album,
   * même si je ne suis plus ami (on peut retirer ses propres réactions).
   */
  router.delete("/:id/likes/me", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const album = await visibleAlbum(req.params.id, me);
      const { deletedCount } = await Like.deleteOne({ albumId: album._id, userId: me });
      if (deletedCount === 1) await bump(album._id, "likeCount", -1);
      res.json({ likeCount: Math.max(0, (album.likeCount ?? 0) - deletedCount), likedByMe: false });
    } catch (error) {
      next(error);
    }
  });

  /** Le propriétaire retire un like reçu sur son album. */
  router.delete("/:id/likes/:userId", auth, async (req, res, next) => {
    try {
      const album = await Album.findById(req.params.id);
      if (!isOwner(album, req.auth.sub)) throw albumNotFound();
      if (!mongoose.isValidObjectId(req.params.userId)) throw new HttpError(404, "Like inconnu");
      const { deletedCount } = await Like.deleteOne({ albumId: album._id, userId: req.params.userId });
      if (deletedCount === 0) throw new HttpError(404, "Like inconnu");
      await bump(album._id, "likeCount", -1);
      console.log(`[reactions] Like de ${req.params.userId} retiré de ${album.id} par son propriétaire`);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  /**
   * Commentaires principaux de l'album, les plus récents d'abord
   * (Page<Comment>), chacun avec ses réponses, dans l'ordre chronologique.
   */
  router.get("/:id/comments", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const album = await visibleAlbum(req.params.id, me);
      const { page, limit, skip } = pagination(req.query, 10, 50);
      const filter = { albumId: album._id, parentId: null };
      const [comments, total] = await Promise.all([
        Comment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Comment.countDocuments(filter),
      ]);
      const replies = comments.length
        ? await Comment.find({ parentId: { $in: comments.map((c) => c._id) } }, null, { sort: { createdAt: 1 } })
        : [];
      const all = [...comments, ...replies];
      const users = await publicUsers(all.map((comment) => String(comment.authorId)));
      const authorOf = new Map(all.map((comment, i) => [String(comment._id), users[i]]));
      const toPublic = (comment, children) => toPublicComment(comment, authorOf.get(String(comment._id)), album, me, children);
      res.json({
        items: comments.map((comment) =>
          toPublic(
            comment,
            replies.filter((reply) => String(reply.parentId) === String(comment._id)).map((reply) => toPublic(reply)),
          ),
        ),
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
   * Commenter l'album (ami du propriétaire), ou, avec `parentId`, répondre à
   * un commentaire principal de cet album (propriétaire seulement).
   */
  router.post("/:id/comments", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const album = await visibleAlbum(req.params.id, me);
      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      if (!text || text.length > COMMENT_MAX) {
        throw new HttpError(400, `Commentaire requis (${COMMENT_MAX} caractères maximum)`);
      }
      const { canComment, canReply } = await rightsOn(album, me);
      const parentId = req.body?.parentId ?? null;

      if (parentId === null) {
        if (!canComment) {
          throw new HttpError(
            403,
            canReply
              ? "Tu ne peux pas commenter ton propre album : réponds aux commentaires de tes amis"
              : "Seuls les amis du propriétaire peuvent commenter cet album",
          );
        }
      } else {
        if (!canReply) throw new HttpError(403, "Seul le propriétaire de l'album peut répondre aux commentaires");
        // Réponse à un commentaire principal de CET album (un seul niveau).
        const parent = mongoose.isValidObjectId(parentId) ? await Comment.findById(parentId) : null;
        if (!parent || String(parent.albumId) !== String(album._id) || parent.parentId) {
          throw new HttpError(404, "Commentaire inconnu");
        }
      }

      const comment = await Comment.create({ albumId: album._id, authorId: me, text, parentId });
      await bump(album._id, "commentCount", 1);
      const [author] = await publicUsers([String(me)]);
      console.log(`[reactions] Commentaire ${comment.id} de ${me} sur ${album.id}`);
      res.status(201).json(toPublicComment(comment, author, album, me));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/** Routes montées sur /api/comments. */
export function commentRoutes(auth) {
  const router = express.Router();

  /**
   * Supprime un commentaire : son auteur, ou le propriétaire de l'album ;
   * un commentaire principal emporte ses réponses. Tout autre cas répond
   * 404, comme un commentaire inexistant.
   */
  router.delete("/:id", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const comment = mongoose.isValidObjectId(req.params.id) ? await Comment.findById(req.params.id) : null;
      const album = comment ? await Album.findById(comment.albumId) : null;
      const allowed = comment && (String(comment.authorId) === String(me) || isOwner(album, me));
      if (!allowed) throw new HttpError(404, "Commentaire inconnu");

      await Comment.deleteOne({ _id: comment._id });
      const replies = comment.parentId ? 0 : (await Comment.deleteMany({ parentId: comment._id })).deletedCount;
      await bump(comment.albumId, "commentCount", -(1 + replies));
      console.log(`[reactions] Commentaire ${req.params.id} supprimé par ${me}`);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
