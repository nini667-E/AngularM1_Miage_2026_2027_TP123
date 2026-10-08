# Tests — référence technique du projet

> Document de méthodologie, pas un journal de mission (ça, c'est
> `compte-rendu/TP3.md`). Décrit comment les tests sont organisés, ce qui
> est couvert, et les règles à suivre pour la suite. Mis à jour au fil du
> TP3, reste pertinent après.

## Règles de travail (validées avec l'utilisateur)

1. **Les tests se font après l'implémentation d'une fonctionnalité, et
   sur demande explicite** — pas automatiquement après chaque
   modification. Exception : si une nouvelle fonctionnalité peut
   interférer avec une déjà testée, revérifier celle-ci aussi.
2. **Tout ce qui existe avant ce document (TP1 + TP2) est considéré comme
   suffisamment couvert** par les tests manuels déjà faits tout au long
   de ces deux TP (voir `compte-rendu/TP1.md`, `compte-rendu/TP2.md`) et
   par l'état des lieux ci-dessous — pas de reprise rétroactive
   systématique.
3. **Un test "complet" couvre tous les niveaux concernés** : tests
   unitaires backend (si la fonctionnalité touche l'API), tests
   unitaires frontend, `npm run build`, et vérification dans un vrai
   navigateur (pas seulement "ça compile").

## État des lieux (trouvé avant d'écrire le moindre test)

`npm test` côté frontend ne fonctionnait **pas du tout**, pour deux
raisons indépendantes du contenu des tests eux-mêmes :

1. **`jsdom` manquant** — `@angular/build:unit-test` (le builder Angular
   qui pilote Vitest) a besoin d'un environnement DOM pour les tests
   hors navigateur ; rien n'était installé. Corrigé : `npm install -D
   jsdom`.
2. **`angular.json` incomplet** — le target `test` dépend implicitement
   d'une configuration `build:development`, jamais définie dans ce
   starter (seule une configuration par défaut existait, sans bloc
   `configurations`). Corrigé : ajout d'une configuration `development`
   minimale (`optimization: false`, `sourceMap: true`) sur le target
   `build`.

Backend : `backend/test/api.test.js` existait déjà (2 tests, Node test
runner natif + `assert/strict`), fonctionnel, pas de blocage.

## Conventions

- **Frontend** : un fichier `*.spec.ts` à côté du fichier testé (ex.
  `track.service.ts` → `track.service.spec.ts`), convention Angular
  standard. Runner : Vitest via `@angular/build:unit-test`
  (`npm test` = `ng test --watch=false`).
- **Piège à connaître** : les globals Jasmine (`describe`/`it`/`expect`/
  `beforeEach`/`afterEach`) ne sont **pas** injectés automatiquement ici
  — contrairement à l'ancien setup Karma+Jasmine d'Angular. Il faut les
  importer explicitement : `import { describe, it, expect } from
  'vitest';`. Sans ça : erreur de compilation TypeScript (`Cannot find
  name 'describe'`), pas une erreur de test.
- **HTTP simulé** : `provideHttpClient()` + `provideHttpClientTesting()`
  (API standalone moderne, pas `HttpClientTestingModule`), cohérent avec
  le reste de l'app qui n'utilise que des providers fonctionnels. Jamais
  de vrai backend ni de MongoDB dans ces tests.
- **Backend** : un `test()` par cas dans `backend/test/api.test.js`
  (fichier unique existant, pas encore scindé). Node test runner natif
  (`node --test`), `assert/strict`. Le serveur Express réel est démarré
  sur un port aléatoire (`createApp().listen(0)`), mais sans connexion
  MongoDB pour les cas qui n'en ont pas besoin (voir plus bas).

## Inventaire — tests frontend obligatoires (sujet TP3, Mission 7)

Le sujet demande au moins 3 tests parmi 7 proposés. Les 3 premiers sont
faits (code déjà stable depuis TP1/TP2, pas une "nouvelle
fonctionnalité" — traités dès la mise en place du harnais).

| # | Test suggéré par le sujet | Statut | Fichier |
|---|---|---|---|
| 1 | `AuthService.login()` utilise `POST /api/auth/login` avec le bon corps | ✅ Fait | `auth.service.spec.ts` |
| 2 | `TrackService.list()` transmet `page` et `limit` | ✅ Fait | `track.service.spec.ts` |
| 3 | L'intercepteur ajoute `Authorization` si un token existe | ✅ Fait | `auth.interceptor.spec.ts` |
| 4 | Le guard redirige un utilisateur sans token | ✅ Fait | `auth.guard.spec.ts` |
| 5 | Le composant affiche une erreur après un échec HTTP | ✅ Fait le 08/10/2026 (2 tests : message backend, message de repli si backend injoignable) | `tracks-page.spec.ts` |
| 6 | La suppression appelle `DELETE /api/tracks/:id` et recharge la liste | ✅ Fait le 08/10/2026 (5 tests : `204`, `404`, réseau, garde anti double-fenêtre, confirmation annulée) | `tracks-page.spec.ts` |
| 7 | L'upload met à jour la progression et traite l'erreur | ✅ Fait le 08/10/2026 (3 tests : progression + réponse, erreur, double clic) | `tracks-page.spec.ts` |

**7/7 faits (08/10/2026)** — 6 fichiers `*.spec.ts`, 25 tests frontend au vert.

## Leçon : ce que les tests unitaires HTTP ne voient pas (08/10/2026)

Bug trouvé pendant la Mission 6 (détail : `compte-rendu/TP3.md`) : la
barre de progression restait à 0 % parce qu'Angular 22 utilise `fetch`
par défaut, et que `fetch` ne remonte pas la progression d'un envoi
(corrigé par `withXhr()` dans `main.ts`). Build OK, tests unitaires OK :
seule la vérification dans un **vrai navigateur** (harnais Playwright,
réseau ralenti) l'a révélé.

Raison : `provideHttpClientTesting()` remplace **tout** le mécanisme HTTP
du navigateur (`fetch` comme XHR) par un faux backend qui renvoie ce
qu'on lui demande. Un test unitaire de l'upload vérifiera donc la
**logique du composant** (tri des événements, calcul du pourcentage,
états), mais jamais que le navigateur émet réellement ces événements.
C'est la justification concrète de la règle n°3 (un test « complet »
inclut la vérification navigateur), et un exemple de la différence
test unitaire / test d'intégration.

À retenir pour le test n°7 : simuler les événements à la main avec
`req.event({ type: HttpEventType.UploadProgress, loaded, total })` puis
`req.flush(...)` sur le `TestRequest`.

## Bonus : tests motivés par notre propre historique de bugs

Pas demandés explicitement par le sujet, mais directement issus de bugs
réels trouvés en test manuel pendant TP1/TP2 — la preuve concrète que ces
fonctions méritaient un test dès le départ.

| Test | Bug qu'il aurait attrapé plus tôt | Fichier |
|---|---|---|
| `serverErrorMessage()` : message backend utilisé si `status > 0`, message de repli sinon | "Failed to fetch" affiché tel quel à l'utilisateur (TP2, Mission 3) | `tracks-page.utils.spec.ts` |
| `formatFileSize()` : conversion octets → Ko/Mo | Taille affichée en octets bruts étiquetés "Ko" (TP2, Mission 3) | `tracks-page.utils.spec.ts` |
| `formatAudioType()` : libellé court à partir du MIME type | — (pas de bug connu, ajouté par cohérence avec les deux au-dessus) | `tracks-page.utils.spec.ts` |

Ces trois fonctions étaient des fonctions privées du module
`tracks-page.ts`, jamais exportées — donc jamais testables isolément
sans monter tout le composant. Elles ont été exportées (`export
function ...`) spécifiquement pour permettre ce test, sans changer leur
comportement.

## Inventaire — extension backend (facultative, sujet TP3, Mission 7)

| # | Test suggéré | Besoin de MongoDB ? | Statut |
|---|---|---|---|
| 1 | `401` sans JWT | Non — le middleware `auth` rejette avant toute requête DB | ✅ 08/10/2026 |
| 2 | `401` avec JWT invalide | Non — `jwt.verify()` échoue avant toute requête DB | ✅ 08/10/2026 (mauvaise signature, expiré, malformé) |
| 3 | Upload sans fichier | Non — `auth` ne vérifie que la signature du JWT (pas l'existence de l'utilisateur en base), le rejet "fichier requis" arrive avant tout accès DB | ✅ 08/10/2026 (`Track.create` jamais appelé) |
| 4 | Type MIME refusé | Non — rejeté par `multer.fileFilter`, avant la DB | ✅ 08/10/2026 (aucun fichier écrit dans `data/uploads`) |
| 5 | Pagination `page`/`limit` | Non, si on teste juste le *clamping* des paramètres (valeurs par défaut/bornées) sur une liste vide — pas besoin de vraies pistes en base pour ça | ✅ 08/10/2026 (5 combinaisons, `Track.find`/`countDocuments` simulés) |
| 6 | Accès interdit à la piste d'un autre utilisateur | Prévu « oui » (une vraie piste d'un autre `ownerId`) ; finalement évité en simulant les méthodes de `Track` — limite expliquée ci-dessous | ✅ 08/10/2026 — **sans MongoDB finalement** : `Track.findOne`/`findOneAndDelete` simulés (voir ci-dessous) ; preuve sur la vraie base faite par `curl` avec 2 comptes |

**Découverte utile pour les tests 1-4** : le middleware `auth`
(`backend/src/app.js`) ne vérifie **que** la signature du JWT
(`jwt.verify()`), jamais que l'utilisateur existe réellement en base. Un
token signé avec le même secret pour un `sub` inventé est donc accepté
par `auth` sans connexion MongoDB — ce qui permet de tester tout ce qui
se passe *avant* une requête DB (validation du format, de l'auth, du
fichier) sans jamais se connecter à MongoDB Atlas.

**Implémenté le 08/10/2026** dans `backend/test/api.test.js` (8 tests au
vert, dont les 2 d'origine). Pour les tests 5 et 6, les méthodes du modèle
`Track` sont remplacées par des fausses avec `mock.method` (`node:test`) :
- **ce que ça prouve** : la route transmet bien `ownerId: req.auth.sub`
  (l'identité du token) à la requête, renvoie `404` quand rien n'est
  trouvé, supprime le fichier du disque seulement pour le propriétaire,
  et convertit/borne correctement `page`/`limit` ;
- **ce que ça ne prouve pas** : que MongoDB applique réellement ce filtre
  (on fait confiance à Mongo). Cette partie a été vérifiée sur la vraie
  base avec `curl` et deux comptes (voir `compte-rendu/TP3.md`, Mission 5).

Choix écarté : `mongodb-memory-server` (vraie base en mémoire) aurait
ajouté une dépendance lourde au backend (téléchargement d'un binaire
`mongod`) pour une extension facultative ; et tester contre MongoDB Atlas
polluerait la vraie base.

## Comment lancer les tests

```bash
# Frontend (depuis frontend-starter/)
npm test              # tests unitaires (Vitest via Angular)
npm run build          # build de production

# Backend (depuis backend/)
npm test              # node --test
```

## Harnais de vérification navigateur (hors dépôt)

Un harnais Playwright existe pour que l'assistant puisse vérifier
visuellement l'app sans dépendre d'une capture manuelle — **installé
exclusivement dans le répertoire scratchpad de la session, jamais dans
ce dépôt** (aucune ligne ajoutée à `package.json`). Détails : voir
`RAPPORT_IA_MODELE.md`, entrée 2.16 (TP2). Rien à configurer ici, c'est
un outil de l'assistant, pas un livrable du TP.

## Rapport des tests — attendu vs observé (08/10/2026)

### Frontend (`npm test`, 6 fichiers, 25 tests)

| Fichier | Cas | Attendu | Observé |
|---|---|---|---|
| `auth.service.spec.ts` | `login()` | `POST /api/auth/login` avec `{email,password}` | ✅ |
| `track.service.spec.ts` | `list(2, 10)` | `page=2`, `limit=10`, pas de `title` | ✅ |
| `auth.interceptor.spec.ts` | token présent / absent / 401 | en-tête `Authorization` ajouté ou non ; logout sur 401 | ✅ |
| `auth.guard.spec.ts` | sans / avec token | redirection `/login` / accès | ✅ |
| `tracks-page.utils.spec.ts` | `serverErrorMessage`, `formatFileSize`, `formatAudioType` | conversions et messages | ✅ |
| `tracks-page.spec.ts` | `GET` en `500` | message du backend affiché dans `p.error` | ✅ |
| | `GET` sans réponse (statut 0) | « Chargement des pistes impossible » | ✅ |
| | suppression `204` | `DELETE /api/tracks/t1`, rechargement, SnackBar `snack-success` | ✅ |
| | suppression `404` | rechargement **aussi**, SnackBar « n'existe plus ou ne vous appartient pas » | ✅ |
| | suppression, erreur réseau | **pas** de rechargement, `deletingId` remis à `null` | ✅ |
| | suppression déjà en cours | aucune fenêtre ouverte, aucune requête | ✅ |
| | confirmation annulée | aucune requête `DELETE` | ✅ |
| | upload, progression | 50/200 → 25 % affiché ; 200/200 → « Finalisation… » ; `total` inconnu → pas de `NaN` ; réponse → succès, titre/fichier vidés, rechargement | ✅ |
| | upload, erreur `400` | message backend, titre conservé et réactivé, pas de rechargement | ✅ |
| | upload, second clic | une seule requête `POST` | ✅ |

### Backend (`npm test`, 8 tests)

| Cas | Attendu | Observé |
|---|---|---|
| `GET /api/health` | `200 {status:"ok"}` | ✅ |
| Schémas Mongoose | email en minuscules, `ref: "User"` | ✅ |
| Sans JWT | `401 Authentification requise` | ✅ |
| JWT mauvaise signature / expiré / malformé | `401 Jeton invalide ou expiré` | ✅ (×3) |
| Upload sans fichier | `400 Fichier audio requis`, rien en base | ✅ |
| Type MIME `text/plain` | `400 Format audio non accepté`, rien sur le disque | ✅ |
| Pagination (5 combinaisons) | `skip`/`limit` corrects, `limit` ≤ 20, défauts si invalide, filtre `ownerId` = token | ✅ |
| Piste d'un autre utilisateur | lecture `404`, suppression `404`, piste et fichier intacts ; propriétaire `204` + fichier supprimé ; 2ᵉ suppression `404` | ✅ |

### Les tests détectent-ils vraiment les bugs ? (vérification croisée, 08/10/2026)

Des tests tous verts du premier coup ne prouvent rien s'ils ne peuvent
pas échouer. Bugs introduits volontairement, un par un, puis code
restauré à l'identique (vérifié avec `cmp` / `git diff`) :

| Bug introduit | Test qui a échoué |
|---|---|
| `404` sans rechargement (comportement du TP2) | `404 … message dédié ET rechargement` |
| Pourcentage `loaded / total` sans `× 100` | `met à jour la progression…` |
| Garde `uploading()` retirée de `upload()` | `ignore un second clic pendant l'envoi` |
| `DELETE` backend sans filtre `ownerId` | `accès interdit à la piste d'un autre utilisateur` |
| `limit` backend non bornée à 20 | `pagination …` |
