# Guitar Practice Cloud

Application web de bibliothèque de *backing tracks* pour guitaristes :
inscription et connexion, profil, import de fichiers audio (avec barre de
progression), liste paginée et filtrable, lecture, suppression.

- **Frontend** : Angular 22 (composants standalone, Signals, Reactive Forms,
  Angular Material) — dossier [`frontend-starter/`](frontend-starter/).
- **Backend** : Node.js, Express 5, Mongoose / MongoDB Atlas, JWT, Multer —
  dossier [`backend/`](backend/).

Projet réalisé dans le cadre des TP de programmation web (M1 MIAGE
2026-2027), avec l'aide d'un assistant IA (Claude Code), dont l'usage est
documenté en détail.

## Versions

| Version | Contenu | Où la trouver |
|---|---|---|
| **V1** | TP1 à TP3 : authentification, profil, bibliothèque, suppression, progression d'upload, tests automatisés | tag Git `v1.0` |
| **V2** | TP4 à TP6 : personnalisation avancée de l'application | en cours, branche `main` |

Sur GitHub, choisir le tag `v1.0` dans le menu des branches pour consulter
ou télécharger la V1 telle qu'elle a été rendue.

## Démarrage rapide

**Prérequis** : Node.js 22 ou plus récent, un compte MongoDB Atlas, Git et
un navigateur récent. La création de la base est décrite dans
[ATLAS_SETUP.md](ATLAS_SETUP.md).

### Backend

Créer un fichier `backend/.env` (il n'est jamais versionné, voir
`backend/.gitignore`) contenant :

```env
MONGODB_URI=mongodb+srv://<utilisateur>:<mot-de-passe>@<cluster>.mongodb.net/guitar-practice-cloud?appName=Cluster0
JWT_SECRET=<une longue chaîne aléatoire>
PORT=3000
```

- `MONGODB_URI` : l'URI fournie par Atlas, avec le nom de la base
  (`guitar-practice-cloud`) ajouté juste avant le `?` ;
- `JWT_SECRET` : le secret qui signe les tokens, à garder côté serveur ;
- `PORT` : facultatif, `3000` par défaut.

> `ATLAS_SETUP.md` (fourni avec le sujet) indique `cp .env.example .env` :
> ce fichier exemple n'existe pas dans le dépôt, il suffit de créer `.env`
> directement avec le contenu ci-dessus.

Ne jamais publier ce fichier, ni copier un secret dans le code Angular.

```bash
cd backend
npm install
npm start          # http://localhost:3000/api/health -> {"status":"ok"}
```

### Frontend

Dans un autre terminal :

```bash
cd frontend-starter
npm install
npm start          # http://localhost:4200
```

Le proxy de développement (`proxy.conf.json`) redirige `/api` vers le
backend. Compte de démonstration créé automatiquement :
`demo@example.com` / `Demo1234!`. Des fichiers audio de test sont fournis
dans [`frontend-starter/fichiers-audio-de-test/`](frontend-starter/fichiers-audio-de-test/).

### Tests

```bash
cd frontend-starter && npm test     # 25 tests (Vitest)
cd frontend-starter && npm run build
cd backend && npm test              # 8 tests (node:test), sans MongoDB
```

Détail de ce qui est testé et pourquoi : [Tests.md](Tests.md).

## Méthode de travail

- **Une branche Git par TP** (`TP2`, `TP3`, …), mergée dans `main` à la fin
  du TP. Chaque version livrée reçoit un tag (`v1.0`, puis `v2.0`).
- **Pour chaque mission** :
  1. l'assistant explique l'objectif, repère les fichiers concernés et
     propose un plan ; **aucun code n'est écrit avant validation** ;
  2. implémentation, puis `npm run build` ;
  3. vérification dans un vrai navigateur (onglet Network, console,
     comportement de l'interface), avec captures d'écran ;
  4. documentation : compte-rendu, rapport IA, et `analyse.md` si le code
     a changé.
- **Tests automatisés** : écrits après l'implémentation d'une
  fonctionnalité, sur demande. Un test « complet » = tests backend (si
  l'API est touchée) + tests frontend + build + vérification navigateur.
- **Commits et push** : uniquement sur demande explicite.
- **Backend** : non modifié pour les missions obligatoires ; toute route
  modifiée est documentée dans `API_CONTRACT.md` dans la même modification.

## Carte des documents

### Ce que j'ai fait

| Document | Contenu | Quand le lire |
|---|---|---|
| [compte-rendu/TP1.md](compte-rendu/TP1.md) | Compte-rendu du TP1 : architecture, authentification, profil, gestion du `401` | Pour suivre le TP1 mission par mission |
| [compte-rendu/TP2.md](compte-rendu/TP2.md) | Compte-rendu du TP2 : bibliothèque paginée, upload et lecture audio, cards Material, améliorations facultatives (filtre par titre, suppression) | Pour suivre le TP2 mission par mission |
| [compte-rendu/TP3.md](compte-rendu/TP3.md) | Compte-rendu du TP3 : suppression, progression d'upload, tests automatisés, réponses aux questions orales | Pour suivre le TP3 mission par mission |
| [compte-rendu/captures/](compte-rendu/captures/) | Preuves en images (46 captures), nommées `tpX-missionY-sujet.png` | Liées depuis chaque compte-rendu |
| [RAPPORT_IA_MODELE.md](RAPPORT_IA_MODELE.md) | Rapport d'usage de l'IA : prompts recopiés tels quels, plans proposés, vérifications, erreurs trouvées ou rejetées, fichiers modifiés, ce que je sais expliquer seul | Pour voir comment l'assistant a été utilisé et contrôlé |
| [Tests.md](Tests.md) | Stratégie de test, inventaire, rapport attendu / observé, vérification que les tests détectent vraiment les bugs | Pour comprendre ce qui est testé et ses limites |

### Comment l'application fonctionne

| Document | Contenu | Quand le lire |
|---|---|---|
| [frontend-starter/analyse.md](frontend-starter/analyse.md) | Analyse technique du frontend : routes, services, intercepteur, guard, état des composants, diagrammes de séquence, état par mission | Pour comprendre le code Angular |
| [backend/analyse.md](backend/analyse.md) | Analyse technique du backend : routes Express, JWT, upload Multer, modèle MongoDB, diagrammes | Pour comprendre l'API |
| [API_CONTRACT.md](API_CONTRACT.md) | Contrat HTTP : routes, authentification, formats échangés, codes d'erreur | Référence pendant le développement |

### Fournis avec le sujet

| Document | Contenu |
|---|---|
| [SUJET_ETUDIANT_TP1.md](SUJET_ETUDIANT_TP1.md), [TP2](SUJET_ETUDIANT_TP2.md), [TP3](SUJET_ETUDIANT_TP3.md) | Énoncés des TP |
| [ATLAS_SETUP.md](ATLAS_SETUP.md) | Création de la base MongoDB Atlas |
| [CONSEILS_POUR_UTIISER_ASSISTANT_AI.md](CONSEILS_POUR_UTIISER_ASSISTANT_AI.md) | Bonnes pratiques d'usage d'un assistant IA |
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `best-practices.md` dans [backend/](backend/) et [frontend-starter/](frontend-starter/) | Consignes lues par les assistants IA (règles du projet, conventions) |

## Les trois types de documents, à ne pas confondre

| | `analyse.md` (front, back) | `compte-rendu/TPx.md` | `RAPPORT_IA_MODELE.md` |
|---|---|---|---|
| **Nature** | Photo technique **actuelle** du code | Journal **chronologique** du travail | Rapport **d'usage de l'IA** |
| **Contenu** | Architecture, flux, diagrammes | Ce qui a été fait, pourquoi, preuves, réponses au sujet | Prompts, plans, vérifications, erreurs, fichiers modifiés |
| **Mis à jour** | Quand le code change | Au fil de chaque mission | Après chaque échange significatif avec l'IA |

## Conventions

- **Captures** : dans `compte-rendu/captures/`, nommées
  `tpX-missionY-sujet.png`, liées depuis le compte-rendu correspondant.
  Les mots de passe et les JWT sont floutés avant intégration.
- **Dates** : depuis le 08/10/2026, chaque entrée ajoutée dans la
  documentation porte sa date.
- **Secrets** : `backend/.env` n'est jamais versionné ; aucun secret dans
  le code, les captures ou les prompts.
