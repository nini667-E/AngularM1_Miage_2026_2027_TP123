import express from "express";
import { isOwner } from "../access.js";
import { HttpError } from "../errors.js";
import { Album } from "../models/Album.js";
import { checkTheme, loadCardInfo, publicCardInfo } from "../services/card-info.js";
import { getSeries, getSeriesSets, getSetIndex, getTypes, officialImage, searchCards, setIdOf } from "../services/tcgdex.js";

/**
 * Album cible facultatif (?albumId=) : seul son propriétaire peut y ajouter
 * des cartes, donc seul lui en obtient le thème ; 404 sinon.
 */
async function targetAlbum(req) {
  if (req.query.albumId === undefined) return null;
  const album = await Album.findById(req.query.albumId);
  if (!isOwner(album, req.auth.sub)) throw new HttpError(404, "Album inconnu");
  return album;
}

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

  /**
   * Recherche de cartes par nom (2 caractères minimum). Avec ?albumId= :
   * - extension imposée par l'album -> filtrée directement chez TCGdex ;
   * - série imposée -> chaque résultat est marqué compatible ou non
   *   (TCGdex ne sait pas filtrer par série). Les cartes incompatibles
   *   restent listées, grisées côté interface, avec la raison.
   * Le type n'est pas connu à ce stade (absent des fiches courtes) : il est
   * vérifié quand l'utilisateur choisit une carte (route suivante).
   */
  router.get("/cards", auth, async (req, res, next) => {
    try {
      const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
      if (name.length < 2) throw new HttpError(400, "Tape au moins 2 caractères");
      const album = await targetAlbum(req);
      const theme = album?.theme ?? {};

      const [cards, setIndex, serieSets] = await Promise.all([
        searchCards(name, { setId: theme.set?.id }),
        getSetIndex(),
        theme.serie?.id && !theme.set?.id ? getSeriesSets(theme.serie.id) : null,
      ]);
      const allowed = serieSets ? new Set(serieSets.map((set) => set.id)) : null;

      const results = cards.map((card) => {
          const setId = setIdOf(card.id);
          const set = setIndex.get(setId) ?? { id: setId, name: null, logo: null };
          const compatible = !allowed || allowed.has(setId);
          return {
            id: card.id,
            name: card.name,
            localId: card.localId ?? null,
            image: officialImage(card.image, "low"),
            set,
            compatible,
            reason: compatible ? null : `Hors de la série ${theme.serie.name}`,
          };
      });
      // Cartes acceptées d'abord (tri stable : l'ordre TCGdex est conservé
      // dans chaque groupe) ; vérifié dans le navigateur : sans ce tri, les
      // 2 cartes compatibles de 19 résultats arrivaient en fin de liste.
      res.json(results.sort((a, b) => Number(b.compatible) - Number(a.compatible)));
    } catch (error) {
      next(error);
    }
  });

  /** Détail d'une carte + verdict de cohérence avec l'album (?albumId=). */
  router.get("/cards/:id", auth, async (req, res, next) => {
    try {
      const album = await targetAlbum(req);
      let info;
      try {
        info = await loadCardInfo(req.params.id);
      } catch (error) {
        throw error.status === 400 ? new HttpError(404, "Carte inconnue") : error;
      }
      res.json({ ...publicCardInfo(info), verdict: album ? checkTheme(info, album.theme) : null });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
