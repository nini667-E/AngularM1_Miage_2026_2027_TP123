/** Réponse paginée générique de l'API (albums, recherche… en V2). */
export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}
