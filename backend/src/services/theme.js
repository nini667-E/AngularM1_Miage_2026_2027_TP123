import { HttpError } from "../errors.js";
import { getSeries, getSeriesSets, getTypes } from "./tcgdex.js";

/**
 * Valide le thème demandé pour un album et le complète avec les noms et
 * logos officiels. Entrée : `{ type?, serieId?, setId? }` (tout est
 * facultatif : un album sans thème est une collection libre).
 *
 * Les noms et logos sont recopiés dans l'album : l'affichage n'a ainsi
 * jamais besoin d'interroger TCGdex.
 */
export async function resolveTheme(input = {}) {
  const type = clean(input.type);
  const serieId = clean(input.serieId);
  const setId = clean(input.setId);
  const theme = {};

  if (setId && !serieId) {
    throw new HttpError(400, "Une extension nécessite de choisir sa série");
  }

  if (type) {
    const types = await getTypes();
    if (!types.includes(type)) throw new HttpError(400, `Type inconnu : ${type}`);
    theme.type = type;
  }

  if (serieId) {
    const serie = (await getSeries()).find((item) => item.id === serieId);
    if (!serie) throw new HttpError(400, "Série inconnue");
    theme.serie = serie;

    if (setId) {
      const set = (await getSeriesSets(serieId))?.find((item) => item.id === setId);
      if (!set) throw new HttpError(400, "Extension inconnue pour cette série");
      theme.set = { id: set.id, name: set.name, logo: set.logo };
    }
  }

  return theme;
}

function clean(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
