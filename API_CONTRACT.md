# Contrat HTTP — Card Vault (V2)

> Contrat de la V2 (mini projet TP4-TP6), mis à jour à chaque étape.
> Le contrat de la V1 (routes `/tracks` de l'application audio) reste
> consultable dans la version taguée `v1.0`.
>
> **01/11/2026 — étape 1** : routes `/tracks` (liste, upload, flux audio,
> suppression) **retirées** avec l'audio.
> **01/11/2026 — étape 2** : routes `/catalog` (catalogue TCGdex) et
> `/albums` ajoutées.
> **01/11/2026 — étape 3** : recherche et détail de cartes, cartes d'un
> album (photo), suppression de carte, images signées ; `PUT /albums/:id`
> peut répondre `409`, `DELETE /albums/:id` supprime aussi les cartes.

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
| DELETE | `/albums/:id` | JWT | `204` (cartes et photos comprises) |
| GET | `/catalog/cards?name=&albumId=` | JWT | `200 CardSearchResult[]` |
| GET | `/catalog/cards/:id?albumId=` | JWT | `200 CardDetail` |
| GET | `/albums/:id/cards?page=1&limit=9&category=` | JWT | `200 Page<AlbumCard>` |
| POST | `/albums/:id/cards` | multipart : `photo`, `tcgdexId` (+ `crop`, `rotation` facultatifs) + JWT | `201 AlbumCard` |
| DELETE | `/cards/:id` | JWT | `204` |
| GET | `/images/:cardId/:size?exp=&sig=` | **signature** (pas de JWT) | `200 image/webp` |

`Page<T>` contient `items`, `page`, `limit`, `total` et `pages`.

Erreurs courantes : `400` validation, `401` authentification, `403` lien
d'image invalide ou expiré, `404` ressource (ou ressource d'un autre
utilisateur), `409` email déjà utilisé ou thème incompatible avec les
cartes, `502` catalogue TCGdex indisponible. Toute erreur renvoie
`{ "message" }`.

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
| `PUT /albums/:id` | propriétaire seulement ; seuls les champs envoyés sont modifiés | `200 Album` | `400` (mêmes règles que la création), `401`, `404`, **`409`** (nouveau thème non respecté par des cartes déjà rangées, étape 3), `502` |
| `DELETE /albums/:id` | propriétaire seulement ; supprime aussi ses cartes et leurs photos | `204` | `401`, `404` |

## Cartes (étape 3)

```ts
CardSearchResult = {
  id, name, localId,
  image: string | null,                  // vignette officielle TCGdex (low.webp)
  set: { id, name, logo },
  compatible: boolean,                   // série / extension de l'album
  reason: string | null                  // ex. "Hors de la série Épée et Bouclier"
}

CardDetail = {
  tcgdexId, name, localId,
  category: 'Pokémon' | 'Dresseur' | 'Énergie',
  subCategory: string | null,            // Objet, Supporter… / De base, Spécial
  types: string[],                       // Énergies : déduit du nom si absent
  rarity, set: { id, name, logo }, serie: { id, name },
  officialImage: { small, large },       // TCGdex, ou null
  verdict: { compatible: boolean, reasons: string[] } | null   // si albumId
}

AlbumCard = CardDetail sans verdict + {
  id, albumId, createdAt,
  photo: { thumb: string, full: string } // URL signées /api/images/…
}
```

| Route | Accès | Réponses | Erreurs |
|---|---|---|---|
| `GET /catalog/cards?name=&albumId=` | `name` : 2 caractères minimum ; `albumId` facultatif (propriétaire seulement) | `200` : 20 résultats maximum, cartes Pocket exclues, **cartes compatibles en premier** ; extension de l'album filtrée chez TCGdex, série marquée `compatible` | `400` (moins de 2 caractères), `401`, `404` (album d'un autre), `502` |
| `GET /catalog/cards/:id?albumId=` | idem | `200 CardDetail` (avec `verdict` si `albumId`) | `401`, `404` (carte inconnue ou Pocket, album d'un autre), `502` |
| `GET /albums/:id/cards` | selon `canView` (comme l'album) ; `page` ≥ 1, `limit` 1-36 (défaut 9), `category` facultative (`Pokémon`, `Dresseur`, `Énergie`) ; ordre d'ajout | `200 Page<AlbumCard>` | `400` (catégorie invalide), `401`, `404` |
| `POST /albums/:id/cards` | propriétaire seulement ; multipart `photo` (JPEG, PNG ou WebP, **10 Mo max**) + `tcgdexId` ; doublons autorisés. **Recadrage facultatif (01/11/2026)** : `rotation` = quarts de tour dans le sens horaire (entier 0 à 3, appliqués après le redressement EXIF) ; `crop` = JSON `{"x","y","width","height"}` en pixels entiers de la photo **redressée puis tournée**, entièrement dans l'image, `width` ≥ 100 | `201 AlbumCard` | `400` (photo absente, carte inconnue, **carte hors thème** avec la raison, fichier qui n'est pas une image, photo trop volumineuse, « Recadrage invalide »), `401`, `404`, `502` |
| `DELETE /cards/:id` | propriétaire seulement ; supprime aussi les fichiers | `204` | `401`, `404` |
| `GET /images/:cardId/:size?exp=&sig=` | **sans JWT** : `size` = `thumb` (400 px) ou `full` (1600 px max) ; `sig` = HMAC-SHA256 de `cardId.size.exp` avec le secret du serveur ; `exp` = échéance (fin de l'heure suivante) | `200 image/webp`, `Cache-Control: private, max-age=<jusqu'à l'échéance>` | `403` (signature invalide, modifiée ou expirée), `404` |

**Règle de cohérence** (vérifiée par le serveur à l'ajout) : le **type** de
l'album s'applique aux Pokémon et aux Énergies typées (Dresseurs et
Énergies sans type toujours acceptés) ; la **série** et l'**extension**
s'appliquent à toutes les cartes.

**Photos** : jamais servies telles qu'envoyées. Le serveur vérifie que le
fichier est une image, la redresse, en retire les métadonnées (dont la
position GPS) et en garde deux versions WebP. Si un recadrage est envoyé
(01/11/2026), le serveur découpe l'**original**, en pleine qualité, après
redressement et rotation, avant de créer les deux versions. Les URL signées ne sont
délivrées qu'aux utilisateurs qui peuvent voir l'album ; une URL déjà
délivrée reste valable jusqu'à son échéance (1 à 2 h).
