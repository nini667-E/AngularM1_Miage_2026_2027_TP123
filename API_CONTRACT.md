# Contrat HTTP — Card Vault (V2)

> Contrat de la V2 (mini projet TP4-TP6), mis à jour à chaque étape.
> Le contrat de la V1 (routes `/tracks` de l'application audio) reste
> consultable dans la version taguée `v1.0`.
>
> **01/11/2026 — étape 1** : routes `/tracks` (liste, upload, flux audio,
> suppression) **retirées** avec l'audio. Les routes d'albums, de cartes et
> les fonctions sociales seront ajoutées aux étapes suivantes.

Base : `/api`. Sauf inscription et connexion, envoyer `Authorization: Bearer <token>`.

Le backend utilise Mongoose et MongoDB (base `card-vault`).

| Méthode | Route | Requête | Réponse principale |
|---|---|---|---|
| GET | `/health` | - | `{ "status": "ok" }` |
| POST | `/auth/register` | `{name,email,password}` | `201 {token,user}` |
| POST | `/auth/login` | `{email,password}` | `200 {token,user}` |
| GET | `/users/me` | JWT | `200 User` |
| PUT | `/users/me` | `{name}` + JWT | `200 User` |

`Page<T>` (réponses paginées des étapes suivantes) contient `items`, `page`, `limit`, `total` et `pages`.

Erreurs courantes : `400` validation, `401` authentification, `404` ressource, `409` email déjà utilisé.
