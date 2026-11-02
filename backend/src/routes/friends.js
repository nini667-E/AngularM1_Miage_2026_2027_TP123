import express from "express";
import mongoose from "mongoose";
import { HttpError } from "../errors.js";
import { Friendship, pairKey } from "../models/Friendship.js";
import { User } from "../models/User.js";
import { Album } from "../models/Album.js";
import { byName, findBetween, publicUsers, relationOf } from "../services/friends.js";

export const SEARCH_MIN = 2;
export const SEARCH_LIMIT = 20;

/** Échappe les caractères spéciaux : la saisie est cherchée telle quelle. */
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Seules informations d'un autre utilisateur que l'API expose : son
 * identifiant et son pseudo (jamais son email).
 */
const publicUser = (user) => ({ id: String(user._id), name: user.name });

async function findUser(id) {
  const user = mongoose.isValidObjectId(id) ? await User.findById(id) : null;
  if (!user) throw new HttpError(404, "Utilisateur inconnu");
  return user;
}


/**
 * Accepte l'invitation envoyée par `otherId` à `userId`. Une seule requête,
 * filtrée sur le destinataire : seul l'invité peut accepter, et une
 * invitation ne peut être acceptée qu'une fois.
 */
function acceptFrom(userId, otherId) {
  return Friendship.findOneAndUpdate(
    { pair: pairKey(userId, otherId), status: "pending", recipient: userId },
    { $set: { status: "accepted", acceptedAt: new Date() } },
    { new: true },
  );
}

/** Recherche d'utilisateurs à inviter, montée sur /api/users. */
export function userSearchRoutes(auth) {
  const router = express.Router();

  /** Utilisateurs dont le pseudo contient `q`, avec leur relation avec moi. */
  router.get("/search", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 40) : "";
      if (q.length < SEARCH_MIN) {
        throw new HttpError(400, `Tape au moins ${SEARCH_MIN} caractères`);
      }

      const users = await User.find(
        { _id: { $ne: me }, name: { $regex: escapeRegExp(q), $options: "i" } },
        "name",
        { sort: { name: 1 }, limit: SEARCH_LIMIT },
      );
      const links = await Friendship.find({ pair: { $in: users.map((user) => pairKey(me, user._id)) } });
      const linkByPair = new Map(links.map((link) => [link.pair, link]));

      res.json(
        users.map((user) => ({
          ...publicUser(user),
          relation: relationOf(linkByPair.get(pairKey(me, user._id)), me),
        })),
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/** Amis et invitations, montés sur /api/friends. */
export function friendRoutes(auth) {
  const router = express.Router();

  /** Mes amis, par ordre alphabétique : [{ user, since }]. */
  router.get("/", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const links = await Friendship.find({
        status: "accepted",
        $or: [{ requester: me }, { recipient: me }],
      });
      const users = await publicUsers(links.map((link) => link.otherThan(me)));
      const friends = links.map((link, i) => ({ user: users[i], since: link.acceptedAt ?? link.updatedAt }));
      res.json(friends.sort(byName));
    } catch (error) {
      next(error);
    }
  });

  /** Invitations en attente : { received, sent }, les plus récentes d'abord. */
  router.get("/requests", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const links = await Friendship.find({
        status: "pending",
        $or: [{ requester: me }, { recipient: me }],
      });
      links.sort((a, b) => b.createdAt - a.createdAt);
      const users = await publicUsers(links.map((link) => link.otherThan(me)));
      const result = { received: [], sent: [] };
      links.forEach((link, i) => {
        result[relationOf(link, me)].push({ user: users[i], createdAt: link.createdAt });
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Invite un utilisateur. S'il m'avait déjà invité, son invitation est
   * acceptée (invitations croisées) : 200 au lieu de 201.
   */
  router.post("/requests", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const userId = String(req.body?.userId ?? "");
      if (userId === String(me)) throw new HttpError(400, "Impossible de s'inviter soi-même");
      const user = await findUser(userId);

      const relation = relationOf(await findBetween(me, userId), me);
      if (relation === "friend") throw new HttpError(409, "Vous êtes déjà amis");
      if (relation === "sent") throw new HttpError(409, "Invitation déjà envoyée");

      if (relation === "received" && (await acceptFrom(me, userId))) {
        console.log(`[friends] Invitations croisées : ${me} et ${userId} sont amis`);
        return res.json({ user: publicUser(user), relation: "friend" });
      }

      try {
        await Friendship.create({ requester: me, recipient: userId });
      } catch (error) {
        // Index unique sur la paire : l'autre a invité au même instant.
        if (error?.code === 11000) throw new HttpError(409, "Invitation déjà en cours, réessaie");
        throw error;
      }
      console.log(`[friends] Invitation de ${me} à ${userId}`);
      res.status(201).json({ user: publicUser(user), relation: "sent" });
    } catch (error) {
      next(error);
    }
  });

  /** Accepte l'invitation reçue de :userId. */
  router.post("/requests/:userId/accept", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const user = await findUser(req.params.userId);
      if (!(await acceptFrom(me, req.params.userId))) throw new HttpError(404, "Invitation inconnue");
      console.log(`[friends] Invitation de ${req.params.userId} acceptée par ${me}`);
      res.json({ user: publicUser(user), relation: "friend" });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Refuse l'invitation reçue de :userId, ou annule celle que je lui ai
   * envoyée. Le lien est supprimé, sans prévenir l'autre : il pourra réinviter.
   */
  router.delete("/requests/:userId", auth, async (req, res, next) => {
    try {
      const link = await Friendship.findOneAndDelete({
        pair: pairKey(req.auth.sub, req.params.userId),
        status: "pending",
      });
      if (!link) throw new HttpError(404, "Invitation inconnue");
      console.log(`[friends] Invitation supprimée entre ${req.auth.sub} et ${req.params.userId}`);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  /**
   * Retire :userId de mes amis (l'un ou l'autre peut le faire). Les partages
   * entre nous s'arrêtent dans les deux sens (étape 5) : le partage est
   * réservé aux amis.
   */
  router.delete("/:userId", auth, async (req, res, next) => {
    try {
      const me = req.auth.sub;
      const other = req.params.userId;
      const link = await Friendship.findOneAndDelete({ pair: pairKey(me, other), status: "accepted" });
      if (!link) throw new HttpError(404, "Ami inconnu");
      await Promise.all([
        Album.updateMany({ ownerId: me, sharedWith: other }, { $pull: { sharedWith: other } }),
        Album.updateMany({ ownerId: other, sharedWith: me }, { $pull: { sharedWith: me } }),
      ]);
      console.log(`[friends] Amitié (et partages) retirée entre ${me} et ${other}`);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
