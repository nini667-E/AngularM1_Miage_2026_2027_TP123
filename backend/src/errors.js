/**
 * Erreur métier portant son code HTTP. Lancée par les services et les
 * routes, elle est traduite en réponse JSON `{ message }` par le
 * gestionnaire central d'erreurs (fin de app.js).
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
