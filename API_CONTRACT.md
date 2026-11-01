# Contrat HTTP — Card Vault (V2)

> Contrat de la V2 (mini projet TP4-TP6), mis à jour à chaque étape.
> Le contrat de la V1 (routes `/tracks` de l'application audio) reste
> consultable dans la version taguée `v1.0`.
>
> **01/11/2026 — étape 1** : routes `/tracks` (liste, upload, flux audio,
> suppression) **retirées** avec l'audio.
> **01/11/2026 — étape 2** : routes `/catalog` (catalogue TCGdex) et
> `/albums` ajoutées.

Base : `/api`. Sauf santé, inscription et connexion, envoyer
`Authorization: Bearer <token>` (sinon `401`).

Le backend utilise Mongoose et MongoDB (base `card-vault`).

## Vue d'ensemble

| Méthode | Route | Requête | Réponse principale |
|---|---|---|---|
| GET | `/health` | - | `{ "status": "ok" }` |
| POST | `/auth/register` | `{name,email,password}` | `201 {token,user}` |
| POST | `/auth/login` | `{email,password}` | `200 {token,user}` |
| GET | `/users/me` | JWT | `200 User` |
| PUT | `/users/me` | `{name}` + JWT | `200 User` |
| GET | `/catalog/types` | JWT | `200 string[]` |
| GET | `/catalog/series` | JWT | `200 Serie[]` |
| GET | `/catalog/series/:id/sets` | JWT | `200 Set[]` |
| POST | `/albums` | `AlbumInput` + JWT | `201 Album` |
| GET | `/albums/mine?page=1&limit=12` | JWT | `200 Page<Album>` |
| GET | `/albums/:id` | JWT | `200 AlbumDetail` |
| PUT | `/albums/:id` | `Partial<AlbumInput>` + JWT | `200 Album` |
| DELETE | `/albums/:id` | JWT | `204` |

`Page<T>` contient `items`, `page`, `limit`, `total` et `pages`.

Erreurs courantes : `400` validation, `401` authentification, `404`
ressource (ou ressource d'un autre utilisateur), `409` email déjà utilisé,
`502` catalogue TCGdex indisponible. Toute erreur renvoie `{ "message" }`.

## Catalogue (étape 2)

Listes issues de l'API publique TCGdex (en français), interrogée **par le
backend** et gardée en mémoire 24 h. Réservé aux utilisateurs connectés.

| Route | Réponse | Erreurs |
|---|---|---|
| `GET /catalog/types` | `["Combat", "Dragon", "Eau", …]` (11 types) | `401`, `502` |
| `GET /catalog/series` | `[{ id, name, logo }]` ; la série `tcgp` (Pokémon Pocket, cartes numériques) est exclue ; `logo` est une URL `.png` ou `null` | `401`, `502` |
| `GET /catalog/series/:id/sets` | `[{ id, name, logo, cardCount }]` (extensions de la série) | `401`, `404 Série inconnue` (inconnue, Pocket ou identifiant invalide), `502` |

## Albums (étape 2)

```ts
AlbumInput = {
  title: string;              // obligatoire, 1 à 60 caractères (espaces retirés)
  description?: string;       // 500 caractères maximum
  visibility?: 'private' | 'public';   // 'private' par défaut
  theme?: { type?: string; serieId?: string; setId?: string };  // facultatif
}

Album = {
  id, ownerId, title, description, visibility,
  theme: { type: string | null, serie: Ref | null, set: Ref | null },  // Ref = { id, name, logo }
  cardCount, createdAt, updatedAt
}

AlbumDetail = Album & { owner: { id, name } }
```

**Thème** (validé par le serveur auprès de TCGdex) : `type` doit être un des
11 types ; `serieId` une série existante (hors Pocket) ; `setId` une
extension **de cette série** ; un `setId` sans `serieId` est refusé. Les noms
et logos sont recopiés dans l'album. Sans thème : collection libre.

**Visibilité** : `public` = visible par tous les utilisateurs connectés ;
`private` = visible par le propriétaire seul (partage avec des amis : étape 5).

| Route | Accès | Réponses | Erreurs |
|---|---|---|---|
| `POST /albums` | utilisateur connecté (devient propriétaire, `ownerId` = token) | `201 Album` | `400` (titre absent ou trop long, description trop longue, visibilité invalide, type inconnu, série inconnue, extension sans série ou hors série), `401`, `502` (thème non vérifiable) |
| `GET /albums/mine` | ses propres albums, plus récents d'abord ; `page` ≥ 1, `limit` entre 1 et 48 (défaut 12) | `200 Page<Album>` | `401` |
| `GET /albums/:id` | propriétaire, ou tout utilisateur si l'album est public | `200 AlbumDetail` | `401`, `404 Album inconnu` (inexistant, identifiant invalide, ou privé d'un autre : volontairement indiscernables) |
| `PUT /albums/:id` | propriétaire seulement ; seuls les champs envoyés sont modifiés | `200 Album` | `400` (mêmes règles que la création), `401`, `404`, `502` |
| `DELETE /albums/:id` | propriétaire seulement | `204` | `401`, `404` |
