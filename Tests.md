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
| 5 | Le composant affiche une erreur après un échec HTTP | ⏳ À faire (test de composant, en attente de validation) | `tracks-page.spec.ts` (à créer) |
| 6 | La suppression appelle `DELETE /api/tracks/:id` et recharge la liste | ⏳ À faire **avec** la Mission 5 (SnackBar, cas race condition) | idem |
| 7 | L'upload met à jour la progression et traite l'erreur | ⏳ À faire **avec** la Mission 6 (progression upload, pas encore implémentée) | idem |

**4/7 faits, dont les 3 minimum requis par le sujet — déjà validé.**

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
| 1 | `401` sans JWT | Non — le middleware `auth` rejette avant toute requête DB | ⏳ |
| 2 | `401` avec JWT invalide | Non — `jwt.verify()` échoue avant toute requête DB | ⏳ |
| 3 | Upload sans fichier | Non — `auth` ne vérifie que la signature du JWT (pas l'existence de l'utilisateur en base), le rejet "fichier requis" arrive avant tout accès DB | ⏳ |
| 4 | Type MIME refusé | Non — rejeté par `multer.fileFilter`, avant la DB | ⏳ |
| 5 | Pagination `page`/`limit` | Non, si on teste juste le *clamping* des paramètres (valeurs par défaut/bornées) sur une liste vide — pas besoin de vraies pistes en base pour ça | ⏳ |
| 6 | Accès interdit à la piste d'un autre utilisateur | **Oui**, le seul cas qui ne peut pas s'éviter : il faut une vraie piste en base appartenant à un autre `ownerId` pour prouver le `404` | ⏳ |

**Découverte utile pour les tests 1-4** : le middleware `auth`
(`backend/src/app.js`) ne vérifie **que** la signature du JWT
(`jwt.verify()`), jamais que l'utilisateur existe réellement en base. Un
token signé avec le même secret pour un `sub` inventé est donc accepté
par `auth` sans connexion MongoDB — ce qui permet de tester tout ce qui
se passe *avant* une requête DB (validation du format, de l'auth, du
fichier) sans jamais se connecter à MongoDB Atlas.

Pas encore implémenté (facultatif) — à faire sur demande, comme le reste.

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
