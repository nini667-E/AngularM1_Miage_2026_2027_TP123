/** Série TCGdex (GET /api/catalog/series). */
export interface CatalogSerie {
  id: string;
  name: string;
  logo: string | null;
}

/** Extension d'une série (GET /api/catalog/series/:id/sets). */
export interface CatalogSet {
  id: string;
  name: string;
  logo: string | null;
  cardCount: number | null;
}
