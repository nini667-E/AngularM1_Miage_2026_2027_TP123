import express from "express";
import { visibleAlbumsFilter } from "../access.js";
import { HttpError } from "../errors.js";
import { Album } from "../models/Album.js";
import { Card } from "../models/Card.js";
import { Comment } from "../models/Comment.js";
import { Like } from "../models/Like.js";
import { User } from "../models/User.js";
import { friendIds, publicUsers } from "../services/friends.js";
import { textPattern } from "../services/text.js";
import { CATEGORIES, toPublicCard } from "./cards.js";
import { pagination } from "./albums.js";

/*
 * Découverte (V2, étape 7) : ce qui vient d'être ajouté, l'activité des
 * amis, et la recherche d'albums et de cartes. Tout passe par la règle de
 * visibilité : on ne montre que les albums publics, ceux partagés avec
 * l'utilisateur, et les siens (visibleAlbumsFilter = canView en base).
 */

export const RECENT_ALBUMS = 8;
export const RECENT_CARDS = 12;
export const ACTIVITY_LIMIT = 30;
/** Nombre maximal de documents lus par source d'activité. */
const ACTIVITY_SCAN = 100;
const EXCERPT = 140;

const ID_PATTERN = /^[a-z0-9.-]{1,40}$/i;

/** Utilisateurs { id, name } indexés par identifiant. */
async function usersById(ids) {
  const unique = [...new Set(ids.map(String))];
  const users = await publicUsers(unique);
  return new Map(users.map((user) => [user.id, user]));
}

/** Album avec son propriétaire, tel que renvoyé par la découverte. */
const withOwner = (album, owners, me) => ({ ...album.toPublic(me), owner: owners.get(String(album.ownerId)) });

/** Carte avec son album et le propriétaire de l'album (titre et pseudo seulement). */
const cardWithAlbum = (card, album, owners, now) => ({
  ...toPublicCard(card, now),
  album: { id: String(album._id), title: album.title },
  owner: owners.get(String(album.ownerId)),
});

/**
 * Lit les critères de recherche communs : texte (2 caractères minimum s'il
 * est donné), type, série, extension. Les identifiants sont contrôlés avant
 * d'entrer dans une requête.
 */
function readCriteria(query) {
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 60) : "";
  if (q && q.length < 2) throw new HttpError(400, "Tape au moins 2 caractères");
  const criteria = { q };
  for (const key of ["type", "serieId", "setId"]) {
    const value = typeof query[key] === "string" ? query[key].trim() : "";
    if (!value) continue;
    if (key === "type" ? value.length > 30 : !ID_PATTERN.test(value)) {
      throw new HttpError(400, "Critère de recherche invalide");
    }
    criteria[key] = value;
  }
  return criteria;
}

const page = (items, { page, limit }, total) => ({ items, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) });

export function discoverRoutes(auth) {
  const router = express.Router();

  /**
   * Récemment ajouté, dans les albums PUBLICS : les dernières cartes (les
   * « fichiers » du sujet : les photos) et les derniers albums créés.
   */
  router.get("/recent", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const [publicAlbums, latest] = await Promise.all([
        Album.find({ visibility: "public" }, "_id title ownerId"),
        Album.find({ visibility: "public" }, null, { sort: { createdAt: -1 }, limit: RECENT_ALBUMS }),
      ]);
      const albumById = new Map(publicAlbums.map((album) => [String(album._id), album]));
      const cards = await Card.find(
        { albumId: { $in: publicAlbums.map((album) => album._id) } },
        null,
        { sort: { createdAt: -1 }, limit: RECENT_CARDS },
      );
      const owners = await usersById([...latest, ...publicAlbums].map((album) => album.ownerId));
      const now = Date.now();
      res.json({
        cards: cards.map((card) => cardWithAlbum(card, albumById.get(String(card.albumId)), owners, now)),
        albums: latest.map((album) => withOwner(album, owners, me)),
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Activité de mes amis, calculée à la lecture (pas de journal stocké) :
   * albums créés, cartes ajoutées (regroupées par album et par jour),
   * commentaires et likes, sur les seuls albums que je peux voir.
   */
  router.get("/activity", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const friends = await friendIds(me);
      if (friends.length === 0) return res.json({ hasFriends: false, items: [] });

      const recent = { sort: { createdAt: -1 }, limit: ACTIVITY_SCAN };
      const [created, cards, comments, likes] = await Promise.all([
        Album.find({ $and: [{ ownerId: { $in: friends } }, visibleAlbumsFilter(me)] }, null, recent),
        Card.find({ ownerId: { $in: friends } }, null, recent),
        Comment.find({ authorId: { $in: friends } }, null, recent),
        Like.find({ userId: { $in: friends } }, null, recent),
      ]);

      // Albums concernés par les cartes, commentaires et likes : seulement
      // ceux que je peux voir (un album privé non partagé est ignoré).
      const referenced = [...cards, ...comments, ...likes].map((doc) => doc.albumId);
      const visible = referenced.length
        ? await Album.find({ $and: [{ _id: { $in: referenced } }, visibleAlbumsFilter(me)] }, "_id title ownerId")
        : [];
      const albumById = new Map([...created, ...visible].map((album) => [String(album._id), album]));
      const users = await usersById([
        ...created.map((a) => a.ownerId),
        ...visible.map((a) => a.ownerId),
        ...cards.map((c) => c.ownerId),
        ...comments.map((c) => c.authorId),
        ...likes.map((l) => l.userId),
      ]);
      const albumRef = (album) => ({ id: String(album._id), title: album.title, owner: users.get(String(album.ownerId)) });
      const items = [];

      for (const album of created) {
        items.push({ id: `album-${album._id}`, type: "album", date: album.createdAt, actor: users.get(String(album.ownerId)), album: albumRef(album) });
      }

      // Cartes : un événement par album et par jour (« a ajouté 3 cartes »).
      const now = Date.now();
      const groups = new Map();
      for (const card of cards) {
        const album = albumById.get(String(card.albumId));
        if (!album) continue;
        const key = `${card.albumId}-${new Date(card.createdAt).toISOString().slice(0, 10)}`;
        let group = groups.get(key);
        if (!group) {
          group = { id: `cards-${key}`, type: "cards", date: card.createdAt, actor: users.get(String(card.ownerId)), album: albumRef(album), cards: { count: 0, previews: [] } };
          groups.set(key, group);
          items.push(group);
        }
        group.cards.count += 1;
        if (group.cards.previews.length < 3) {
          group.cards.previews.push({ id: String(card._id), name: card.name, thumb: toPublicCard(card, now).photo.thumb });
        }
      }

      for (const comment of comments) {
        const album = albumById.get(String(comment.albumId));
        if (!album) continue;
        const text = comment.text.length > EXCERPT ? `${comment.text.slice(0, EXCERPT - 1)}…` : comment.text;
        items.push({
          id: `comment-${comment._id}`,
          type: "comment",
          date: comment.createdAt,
          actor: users.get(String(comment.authorId)),
          album: albumRef(album),
          comment: { text, isReply: Boolean(comment.parentId) },
        });
      }

      for (const like of likes) {
        const album = albumById.get(String(like.albumId));
        if (!album) continue;
        items.push({ id: `like-${like._id}`, type: "like", date: like.createdAt, actor: users.get(String(like.userId)), album: albumRef(album) });
      }

      items.sort((a, b) => new Date(b.date) - new Date(a.date));
      res.json({ hasFriends: true, items: items.slice(0, ACTIVITY_LIMIT) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Recherche d'albums parmi ceux que je peux voir : texte dans le titre, la
   * description ou le pseudo du propriétaire ; filtres de thème. Sans
   * critère : tous les albums visibles, les plus récemment modifiés d'abord.
   */
  router.get("/albums", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const criteria = readCriteria(req.query);
      const paging = pagination(req.query, 12, 48);
      const conditions = [visibleAlbumsFilter(me)];
      if (criteria.type) conditions.push({ "theme.type": criteria.type });
      if (criteria.serieId) conditions.push({ "theme.serie.id": criteria.serieId });
      if (criteria.setId) conditions.push({ "theme.set.id": criteria.setId });
      if (criteria.q) {
        const text = { $regex: textPattern(criteria.q), $options: "i" };
        const owners = await User.find({ name: text }, "_id", { limit: 50 });
        conditions.push({ $or: [{ title: text }, { description: text }, { ownerId: { $in: owners.map((u) => u._id) } }] });
      }
      const filter = { $and: conditions };
      const [albums, total] = await Promise.all([
        Album.find(filter, null, { sort: { updatedAt: -1 }, skip: paging.skip, limit: paging.limit }),
        Album.countDocuments(filter),
      ]);
      const owners = await usersById(albums.map((album) => album.ownerId));
      res.json(page(albums.map((album) => withOwner(album, owners, me)), paging, total));
    } catch (error) {
      next(error);
    }
  });

  /**
   * Recherche de cartes (« search files ») dans les albums que je peux voir :
   * nom de la carte, filtres de type, série, extension et catégorie. Un texte
   * ou au moins un filtre est exigé.
   */
  router.get("/cards", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const criteria = readCriteria(req.query);
      const category = typeof req.query.category === "string" && req.query.category ? req.query.category : null;
      if (category && !CATEGORIES.includes(category)) throw new HttpError(400, "Catégorie invalide");
      if (!criteria.q && !criteria.type && !criteria.serieId && !criteria.setId && !category) {
        throw new HttpError(400, "Tape au moins 2 caractères ou choisis un filtre");
      }
      const paging = pagination(req.query, 12, 48);

      const visible = await Album.find(visibleAlbumsFilter(me), "_id title ownerId");
      const albumById = new Map(visible.map((album) => [String(album._id), album]));
      const filter = { albumId: { $in: visible.map((album) => album._id) } };
      if (criteria.q) filter.name = { $regex: textPattern(criteria.q), $options: "i" };
      if (criteria.type) filter.types = criteria.type;
      if (criteria.serieId) filter["serie.id"] = criteria.serieId;
      if (criteria.setId) filter["set.id"] = criteria.setId;
      if (category) filter.category = category;

      const [cards, total] = await Promise.all([
        Card.find(filter, null, { sort: { createdAt: -1 }, skip: paging.skip, limit: paging.limit }),
        Card.countDocuments(filter),
      ]);
      const owners = await usersById(cards.map((card) => albumById.get(String(card.albumId)).ownerId));
      const now = Date.now();
      res.json(page(cards.map((card) => cardWithAlbum(card, albumById.get(String(card.albumId)), owners, now)), paging, total));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
