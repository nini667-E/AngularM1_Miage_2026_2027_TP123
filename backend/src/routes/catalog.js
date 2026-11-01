import express from "express";
import { HttpError } from "../errors.js";
import { getSeries, getSeriesSets, getTypes } from "../services/tcgdex.js";

/**
 * Listes du catalogue TCGdex utiles aux formulaires (thème d'un album).
 * Réservées aux utilisateurs connectés : l'API ne sert pas de relais
 * public vers TCGdex.
 */
export function catalogRoutes(auth) {
  const router = express.Router();

  router.get("/types", auth, async (_req, res, next) => {
    try {
      res.json(await getTypes());
    } catch (error) {
      next(error);
    }
  });

  router.get("/series", auth, async (_req, res, next) => {
    try {
      res.json(await getSeries());
    } catch (error) {
      next(error);
    }
  });

  router.get("/series/:id/sets", auth, async (req, res, next) => {
    try {
      const sets = await getSeriesSets(req.params.id);
      if (!sets) throw new HttpError(404, "Série inconnue");
      res.json(sets);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
