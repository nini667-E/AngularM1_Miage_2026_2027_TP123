# Rapport d'usage de l'IA

Pour chaque mission, détailler et fournir des explications concernant : objectif; prompt principal; plan proposé par l'agent; vérifications réalisées par le binôme; erreurs ou propositions rejetées; fichiers effectivement modifiés; preuve de fonctionnement; ce que chaque membre sait maintenant expliquer sans l'agent.

Ce fichier est cumulatif : une section par phase/mission, dans l'ordre chronologique, pour TP1 à TP3.

Assistant utilisé : Claude Code (modèle Claude Sonnet 5, `claude-sonnet-5`).

---

## Phase 0 — Mise en place (avant Mission 0 du TP1)

Ce travail préparatoire ne correspond à aucune mission numérotée des sujets ;
il a été fait pour disposer d'une documentation technique fiable et d'une
stratégie de suivi avant d'attaquer le TP1.

### Entrée 0.1 — Analyse technique du backend

**Objectif.** Comprendre l'architecture du backend (Express/Mongoose) avant
toute modification : technologies, authentification, upload de fichiers,
échanges avec MongoDB.

**Prompt principal (recopié tel quel) :**
> Analyse le backend, je veux comprendre l'architecture, les workflows, les
> technologies et modules utilisés, comment est gérée l'authentification,
> comment l'upload des fichiers est gérée, comment les échanges avec la base
> de données sont faits, génère moi des diagrammes et des schémas et met le
> résultat dans backend/analyse.md

**Plan proposé par l'agent.** Lecture intégrale des fichiers du backend
(`src/app.js`, `src/server.js`, `src/models/User.js`, `src/models/Track.js`,
`package.json`, `test/api.test.js`, `.gitignore`, `best-practices.md`,
`CLAUDE.md`), puis rédaction d'un document unique `backend/analyse.md`
structuré en sections (vue d'ensemble, stack, modèle de données,
authentification JWT, upload Multer, gestion des erreurs, démarrage serveur,
points d'attention) avec des diagrammes Mermaid (flowchart, ERD, sequence
diagram) pour chaque flux.

**Vérifications réalisées.** Relecture du contenu généré face au code source
(routes, middlewares, schémas Mongoose) pour confirmer l'exactitude des
diagrammes de séquence (register/login, upload, lecture, suppression) ;
vérification qu'aucun secret réel (`backend/.env` contient une vraie URI
MongoDB Atlas et un vrai `JWT_SECRET`) n'a été recopié dans le document.

**Erreurs ou propositions rejetées.** Aucune : le document a été validé tel
quel ("Ok c'est pas mal"). L'agent a signalé de lui-même, hors du document,
que `backend/.env.example` avait été supprimé (visible dans `git status`) et
devrait être recréé avec des valeurs factices — point à traiter plus tard,
pas une correction du travail demandé.

**Fichiers effectivement modifiés.** Création de `backend/analyse.md`.

**Preuve de fonctionnement.** Le fichier `backend/analyse.md` existe et ses
diagrammes Mermaid s'affichent correctement dans l'aperçu Markdown de
VS Code. _Capture à ajouter :_ `compte-rendu/captures/phase0-analyse-backend.png`.

**Ce que je sais expliquer sans l'agent.** Le flux `route → middleware →
handler → Mongoose → MongoDB` ; pourquoi `app.js` et `server.js` sont
séparés (tests sans port ni Mongo) ; le principe du hook `pre('validate')`
pour le hachage bcrypt ; pourquoi `storedName` et `passwordHash` ont
`select: false` ; le flux d'upload Multer (diskStorage, UUID, filtrage MIME,
nettoyage du fichier orphelin en cas d'échec Mongo) ; pourquoi
`ownerId = req.auth.sub` protège l'accès aux pistes d'un autre utilisateur.

### Entrée 0.2 — Stratégie de documentation + analyse technique du frontend

**Objectif.** Définir comment organiser le travail sur les 3 TP (missions,
preuves, documentation technique) avant de commencer, puis obtenir la même
analyse technique que pour le backend, côté frontend.

**Prompt principal (recopié tel quel) :**
> Ok c'est pas mal. Maintenant je te met un peu dans le contexte. Cette
> application est un sujet de TD pour mes cours de programmation WEB. Le but
> est pour moi de comprendre comment fonctionne l'appli pour ensuite la
> modfier l'améliorer et la personnaliser. Pour ce faire j'ai 3 sujets de TP
> je pense que tu les vois donc en plus des analyses que je te demande je
> vais devoir faire un genre de compte rendu de ce que je fait avec des
> preuves en capture d'écran et en décrivant avec mes mots. Tu vois dans les
> fichiers de TP il y a plusieurs missions tout est fait étape par étape.
> Selon toi ça serait quoi la bonne stratégie à adopter ? Moi je me suis dit
> que je ferais toutes les missions une par une tout en prouvant tout et
> expliquant tout ce que je fait dans un fichier séparé de analyse.md (un
> pour le back un pour le front) et toi tu serais chargé de mettre à jour le
> analyse.md au fur et à mesure. Celui là me permettra d'avoir une analyse de
> haute qualité technique et je la lirais pour bien tout comprendre. Tu
> penses quoi de tout ça ?

**Plan proposé par l'agent.** Lecture des trois sujets (`SUJET_ETUDIANT_TP1
/TP2/TP3.md`) et de `RAPPORT_IA_MODELE.md` pour comprendre les livrables déjà
imposés. Retour avec une évaluation de la stratégie proposée (accord sur le
principe, avec 3 ajustements : ne pas confondre compte-rendu et
`RAPPORT_IA_MODELE.md` déjà exigé par le sujet ; anticiper que
`frontend-starter/analyse.md` évoluera à chaque mission alors que
`backend/analyse.md` restera quasi stable, car les TP ne touchent presque
jamais le backend ; mettre à jour `analyse.md` par mission complétée plutôt
qu'à chaque edit, pour rester une "photo de l'état actuel" et non un
historique). Proposition d'une arborescence
(`backend/analyse.md`, `frontend-starter/analyse.md`,
`compte-rendu/TP1.md`/`TP2.md`/`TP3.md` + `captures/`,
`RAPPORT_IA_MODELE.md`). Question posée à l'utilisateur (choix à faire, pas
une simple confirmation) : par quoi démarrer concrètement — réponse
sélectionnée : "Analyse frontend d'abord". Lecture intégrale du frontend
(`routes.ts`, guard, intercepteur, modèles, services, les 4 composants de
page, `main.ts`, `proxy.conf.json`, `package.json`) puis rédaction de
`frontend-starter/analyse.md` sur le même format que le backend, avec en
plus une section §7 comparant explicitement l'état du code starter à chaque
exigence des missions TP1/TP2/TP3 (✅/⚠️/❌).

**Vérifications réalisées.** Vérification qu'aucun test frontend
(`*.spec.ts`) n'existe déjà avant d'affirmer leur absence dans le document
(recherche `Glob` confirmée : seuls des fichiers de `node_modules`
correspondent). Relecture du tableau §7 face au code réel de
`tracks-page.ts`, `auth.service.ts` et `auth.interceptor.ts` pour ne pas
sur- ou sous-estimer ce qui est déjà implémenté.

**Erreurs ou propositions rejetées.** Aucune proposition rejetée par
l'utilisateur ; la stratégie proposée a été validée et affinée par une
question à choix ("Analyse frontend d'abord" retenu parmi 3 options).

**Fichiers effectivement modifiés.** Création de
`frontend-starter/analyse.md`.

**Preuve de fonctionnement.** Le fichier `frontend-starter/analyse.md`
existe, avec un tableau §7 vérifiable ligne par ligne contre le code source.
_Capture à ajouter :_ `compte-rendu/captures/phase0-analyse-frontend.png`.

**Ce que je sais expliquer sans l'agent.** Pourquoi une URL directe dans
`<audio src>` ne reçoit pas le JWT alors qu'un appel `HttpClient` si
(l'intercepteur ne s'applique qu'aux requêtes passant par `HttpClient`) ;
le rôle des Signals `token`/`currentUser` dans `AuthService` ; le
fonctionnement de `authGuard` (`CanActivateFn`) et sa limite (il ne revalide
pas le token côté serveur) ; ce qui manque réellement dans le starter avant
de commencer le TP1 (bouton de déconnexion non câblé, pas de gestion du
401, pas de tests).

### Entrée 0.3 — Mise en place de l'arborescence de comptes-rendus et de ce rapport

**Objectif.** Créer la structure de suivi documentaire (comptes-rendus par
TP, dossier de captures) et compléter ce rapport IA avec l'historique des
échanges depuis le début, pour respecter le format imposé par le sujet
avant de démarrer la Mission 0 du TP1.

**Prompt principal (recopié tel quel) :**
> Alors deux choses avant de commencer la mission 0, met en place
> l'arborescence et le rapport IA modele comme il se doit, en gros ce qu'on
> a fait jusqu'ici mettre en place une stratégie pour bien gérer le
> développement de l'application recopie les prompts que je t'ai envoyé à
> partir de celui de l'analyse backend et résume les résultats que tu m'as
> renvoyé

**Plan proposé par l'agent.** Création de `compte-rendu/` avec
`captures/.gitkeep`, `README.md` (explique la différence entre `analyse.md`,
`compte-rendu/TPX.md` et `RAPPORT_IA_MODELE.md`, et le rythme de travail
conseillé), puis `TP1.md`/`TP2.md`/`TP3.md` sous forme de squelettes
reprenant mission par mission les listes de vérification et livrables
attendus par les sujets, avec emplacements réservés pour les captures.
Remplissage de ce fichier avec les entrées 0.1, 0.2 et 0.3, en recopiant les
prompts exacts et en résumant fidèlement le travail déjà effectué.

**Vérifications réalisées.** Relecture des trois sujets de TP pour que les
listes de vérification des squelettes `TP1.md`/`TP2.md`/`TP3.md`
correspondent exactement aux missions, questions et livrables demandés (pas
de reformulation qui en changerait le sens).

**Erreurs ou propositions rejetées.** Aucune à ce stade.

**Fichiers effectivement modifiés.** Création de `compte-rendu/README.md`,
`compte-rendu/TP1.md`, `compte-rendu/TP2.md`, `compte-rendu/TP3.md`,
`compte-rendu/captures/.gitkeep` ; mise à jour de `RAPPORT_IA_MODELE.md`
(ce fichier).

**Preuve de fonctionnement.** Arborescence visible dans l'explorateur de
fichiers. _Capture à ajouter :_ `compte-rendu/captures/phase0-arborescence.png`.

**Ce que je sais expliquer sans l'agent.** La différence entre les trois
types de documents (analyse technique stable vs journal chronologique vs
rapport d'usage de l'IA) et pourquoi ils sont séparés plutôt que fusionnés ;
le rythme de travail retenu (implémenter → vérifier → capturer → rédiger →
mettre à jour le rapport IA → demander la mise à jour de `analyse.md` →
mission suivante).

---

## TP1 — Architecture Authentification et Profil

### Entrée 1.0 — Mission 0 : cartographier l'application

**Objectif.** Identifier, sans rien modifier, le composant racine, la
configuration des routes, l'enregistrement de `HttpClient`, les
modèles/services/pages et le mécanisme d'ajout du JWT ; produire un schéma
annoté du flux de connexion ; distinguer les routes publiques des routes
protégées.

**Prompt principal (recopié tel quel) :**
> Ok on peut attaquer la mission 0 maintenant

**Plan proposé par l'agent.** Lecture de `API_CONTRACT.md` pour confirmer
le découpage public/protégé, puis rédaction directe de la Mission 0 dans
`compte-rendu/TP1.md` à partir du code déjà lu lors de l'analyse technique
(`frontend-starter/analyse.md`) : identification précise de chaque élément
demandé avec référence de fichier, et un diagramme de séquence Mermaid
annoté (fichier + méthode à chaque étape) pour le flux "Se connecter".

**Vérifications réalisées.** Relecture de `API_CONTRACT.md` pour vérifier
que la règle "tout est protégé sauf `/health`, `/auth/register`,
`/auth/login`" correspond bien à `canActivate: [authGuard]` posé uniquement
sur les routes `profile` et `tracks` dans `routes.ts`.

**Erreurs ou propositions rejetées.** Aucune.

**Fichiers effectivement modifiés.** `compte-rendu/TP1.md` (section
Mission 0 complétée). Aucun fichier de code source touché (mission de
lecture uniquement, conforme à la consigne "sans modifier le code").

**Preuve de fonctionnement.** Non applicable au sens "test" : la preuve est
la cartographie elle-même, vérifiable ligne par ligne contre le code
(`compte-rendu/TP1.md`, section Mission 0).

**Ce que je sais expliquer sans l'agent.** Le rôle de `<router-outlet />`
dans `AppComponent` ; pourquoi `provideHttpClient(withInterceptors([...]))`
dans `main.ts` suffit à brancher l'intercepteur sur toute l'application sans
configuration par service ; pourquoi seuls `AuthService` et `TrackService`
injectent `HttpClient` ; comment `authInterceptor` lit le Signal `token` et
clone la requête ; pourquoi `/auth/login` et `/auth/register` fonctionnent
sans JWT alors que les autres routes en ont besoin.

### Entrée 1.0bis — Clarification pédagogique sur 3 points de la Mission 0

**Objectif.** Faire réexpliquer, de façon vulgarisée (avec analogies) et
avec les fichiers précis à consulter, trois notions de la Mission 0 mal
comprises à la première lecture : l'enregistrement de `HttpClient`, la
répartition modèles/services/pages, et le mécanisme d'ajout du JWT.

**Prompt principal (recopié tel quel) :**
> J'ai tout relu c'est bien mais y'a quelques concept j'ai pas bien compris,
> tu peux me refaire une petite explication plus ou moins vulgarisée pour
> que je comprenne bien cette partie : - l'enregistrement de `HttpClient` ;
> - les modèles, services et pages ; - le mécanisme qui ajoute le JWT aux
> requêtes protégées. et dit moi dans quels fichiers regarder ( pour ce
> genre d'interactions également met à jour rapport IA )

**Plan proposé par l'agent.** Réponse directe en chat (pas de modification
de `compte-rendu/TP1.md`, qui contient déjà la version technique précise) :
trois analogies successives — le disjoncteur général pour
`provideHttpClient`, le restaurant (menu/serveur/salle) pour
modèles/services/pages, le bureau de tri du courrier pour l'intercepteur —
chacune suivie du ou des fichiers exacts à relire.

**Vérifications réalisées.** Relecture rapide de `main.ts`,
`auth.interceptor.ts` et de la structure `shared/` pour s'assurer que les
analogies collaient exactement au code (aucune simplification qui aurait
rendu l'explication fausse).

**Erreurs ou propositions rejetées.** Aucune.

**Fichiers effectivement modifiés.** `RAPPORT_IA_MODELE.md` (cette entrée).
Aucun autre fichier : demande de clarification orale, pas de nouvelle
production à documenter dans `compte-rendu/TP1.md`.

**Preuve de fonctionnement.** Non applicable (explication, pas de code ni
de test).

**Ce que je sais expliquer sans l'agent.** Pourquoi brancher `HttpClient`
une seule fois au bootstrap suffit pour toute l'app ; pourquoi un composant
ne doit jamais injecter `HttpClient` lui-même (séparation
affichage/logique/état vs forme des données) ; pourquoi l'intercepteur ne
crée pas le token mais se contente de le lire (dans le Signal `token` de
`AuthService`) et de l'attacher à chaque requête sortante.

### Entrée 1.0ter — Clarification : à quoi sert d'attacher (ou non) le token

**Objectif.** Comprendre le "pourquoi" derrière l'attachement conditionnel
du JWT : ce que ça change côté backend, ce qui se passe si le token est
absent, et pourquoi deux routes doivent fonctionner sans token.

**Prompt principal (recopié tel quel) :**
> à quoi ça sert d'attacher le token ou non à la requête ?

**Plan proposé par l'agent.** Réponse directe en chat, appuyée sur du code
concret côté backend (`req.auth.sub` utilisé comme filtre `ownerId` dans
`GET /api/tracks`, middleware `auth` qui renvoie 401) et sur la capture
d'écran déjà produite en Phase 0 (`tp1-prep-terminal-logs.png`, ligne
`GET /api/tracks... -> 401` avant connexion) comme preuve concrète déjà en
main plutôt qu'une nouvelle capture. Explication du problème "œuf et poule"
pour `/auth/login` et `/auth/register`, et de l'intérêt de centraliser
l'ajout du header dans l'intercepteur plutôt que dans chaque service.

**Vérifications réalisées.** Relecture de `backend/src/app.js` (middleware
`auth`, route `GET /api/tracks`) pour citer le code exact plutôt qu'une
reformulation approximative ; relecture de la capture
`tp1-prep-terminal-logs.png` déjà enregistrée pour vérifier que la ligne
`401` citée correspond bien à la réalité observée.

**Erreurs ou propositions rejetées.** Aucune.

**Fichiers effectivement modifiés.** `RAPPORT_IA_MODELE.md` (cette entrée)
uniquement.

**Preuve de fonctionnement.** Réutilisation de la preuve déjà produite en
Phase 0 (`compte-rendu/captures/tp1-prep-terminal-logs.png`), qui montre
concrètement un `401` avant connexion (sans token) suivi d'un accès réussi
après connexion (avec token).

**Ce que je sais expliquer sans l'agent.** Pourquoi le backend ne peut pas
faire confiance à une identité fournie sans preuve ; comment
`req.auth.sub` (extrait du token vérifié) sert de filtre `ownerId` pour
qu'un utilisateur ne voie que ses propres pistes ; pourquoi
`/auth/login`/`/auth/register` doivent rester accessibles sans token ;
pourquoi centraliser l'ajout du header dans un intercepteur plutôt que dans
chaque service évite les oublis.

---

## Mission 1 — Inscription, Connexion et Profil

Travail fait point par point (checklist du sujet), en clarifiant l'objectif
et en ciblant les fichiers **avant** toute modification de code.

### Entrée 1.1 — Point "formulaires réactifs" : cadrage + clarification sur l'effet des validateurs

**Objectif.** Avant de toucher au code, comprendre ce qu'exige le point
"formulaires réactifs pour l'inscription et la connexion" de la Mission 1,
vérifier l'état existant dans le starter, cibler les fichiers concernés, et
comprendre concrètement ce que les validateurs Angular changent (ou pas)
pour l'utilisateur.

**Prompts principaux (recopiés tels quels) :**
> Maintenant commençons la mission 1, on va prendre les points 1 par 1 et
> avant de toucher au code on va s'assurer que j'ai bien compris l'objectif
> et on va cibler les fichiers à modifier, on commence donc avec :
> formulaires réactifs pour l'inscription et la connexion

> attends avant de continuer j'ai une question ces validateurs niveau UI
> qu'est ce que ça va changer ? Que va voir l'utilisateur en focntion des
> situations ?

**Plan proposé par l'agent.** Explication vulgarisée du concept de
Reactive Forms (état en TypeScript vs template-driven), constat que le
point est déjà satisfait tel quel par le starter
(`login-page.ts`/`.html`, `register-page.ts`/`.html`), et identification
d'un écart hors-scope (pas de `Validators.minLength(8)` alors que le
backend exige 8 caractères). Sur la question de suivi : lecture précise du
code existant pour montrer que les `Validators` déclarés ne sont
actuellement lus **nulle part** (ni dans `submit()`, ni dans le template :
pas de `[disabled]`, pas de message par champ), et que ce que
l'utilisateur voit aujourd'hui vient soit de la validation HTML native du
navigateur (`type="email"`, indépendante d'Angular), soit du message
générique renvoyé par le backend après un aller-retour réseau. Comparaison
scénario par scénario (champs vides / email mal formé / mauvais mot de
passe) avant/après le câblage réel des validateurs dans l'UI.

**Vérifications réalisées.** Relecture ligne par ligne de `login-page.ts`
et `login-page.html` pour confirmer l'absence de `form.invalid` dans
`submit()` et l'absence de `[disabled]`/message par champ dans le template,
avant d'affirmer que les validateurs sont actuellement inertes.

**Erreurs ou propositions rejetées.** Aucune ; discussion de cadrage, pas
encore d'implémentation.

**Fichiers effectivement modifiés.** `RAPPORT_IA_MODELE.md` (cette entrée)
uniquement. Aucun fichier de code touché — conformément à la demande de
l'utilisateur de cadrer avant de coder.

**Preuve de fonctionnement.** Non applicable (étape de cadrage/compréhension,
aucun code exécuté).

**Ce que je sais expliquer sans l'agent.** La différence entre un
formulaire réactif et un formulaire template-driven ; pourquoi un
`Validators.required` déclaré sur un `FormControl` ne fait rien tant que
rien ne lit `control.invalid`/`control.errors` ; pourquoi le message que je
voyais avant sur un email mal formé venait du navigateur (`type="email"`)
et pas d'Angular ; pourquoi la validation frontend ne remplacera jamais la
validation backend, seulement l'expérience utilisateur.

### Entrée 1.2 — Plan combiné "formulaires réactifs" + "validations et messages d'erreur"

**Objectif.** Regrouper les points 1 et 2 de la Mission 1 (ajouter des
validateurs sans les exploiter dans l'UI n'a pas de sens en soi), décider
précisément des changements à apporter (validateurs, blocage de l'envoi,
messages par champ) et localiser exactement où, **sans écrire de code**.

**Prompts principaux (recopiés tels quels) :**
> donc là le message d'erreur c'est un truc générique ?
> [capture d'écran : formulaire d'inscription, mot de passe de 4
> caractères, message "Nom, email et mot de passe de 8 caractères requis"]

> D'accord j'ai compris bon du coup on va faire d'une pierre deux coups, on
> va brancher les formulaires réactifs, harmoniser avec le backend
> (validateur à 8 pour le mot de passe) et faire la partie validations et
> messages d'erreur compréhensibles. Pour l'instant ne modifie aucun code,
> on va d'abord décider précisément de ce qu'on va faire niveau UI et code
> et repérer les endroits où il faut ajouter/modifier des choses. Tu peux
> déjà intégrer ces échanges et la capture dans les rapports qui vont bien.

**Plan proposé par l'agent.** Confirmation que la capture illustre
exactement le problème discuté à l'entrée 1.1 (aucune validation cliente,
message backend générique regroupant 4 conditions). Lecture de
`frontend-starter/src/styles.css` pour vérifier l'existant réutilisable
(`.error` déjà stylé, `button:disabled` déjà stylé) avant de proposer un
plan. Rédaction d'un plan verrouillé dans `compte-rendu/TP1.md` : ajout de
`Validators.minLength(8)` sur le mot de passe **du formulaire d'inscription
uniquement** (le login ne l'exige pas côté backend), blocage de l'envoi à
deux niveaux (`[disabled]="form.invalid"` + garde `if (form.invalid)` dans
`submit()`), tableau des messages par champ et type d'erreur, et tableau
des 4 fichiers à modifier avec le changement précis dans chacun. Copie de
la capture fournie (chemin temporaire accessible) vers
`compte-rendu/captures/tp1-register-erreur-generique-avant.png`.

**Vérifications réalisées.** Lecture de `frontend-starter/src/styles.css`
pour confirmer qu'aucune nouvelle classe CSS n'est nécessaire (`.error` et
`button:disabled` déjà présents) avant de l'affirmer dans le plan.
Relecture de la route backend `/auth/login` pour confirmer qu'elle n'impose
aucune longueur de mot de passe (contrairement à `/auth/register`),
justifiant que `minLength(8)` ne soit ajouté que côté inscription.

**Erreurs ou propositions rejetées.** Aucune : plan de cadrage, pas encore
soumis à validation d'implémentation.

**Fichiers effectivement modifiés.** `compte-rendu/captures/tp1-register-erreur-generique-avant.png`
(capture copiée), `compte-rendu/TP1.md` (plan détaillé ajouté),
`RAPPORT_IA_MODELE.md` (cette entrée). **Aucun fichier de code source
touché**, conformément à la consigne explicite de ne rien coder à ce stade.

**Preuve de fonctionnement.** La capture jointe montre l'état "avant"
(message générique, pas de contrôle client) ; elle servira de point de
comparaison avec une capture "après" une fois les points 1 et 2
implémentés.

**Ce que je sais expliquer sans l'agent.** Pourquoi `minLength(8)` n'a de
sens que côté inscription et pas côté connexion ; pourquoi bloquer l'envoi
à deux niveaux (bouton désactivé + garde dans le code) plutôt qu'un seul ;
pourquoi aucune nouvelle règle CSS n'était nécessaire ; la liste exacte des
4 fichiers à modifier et ce qui change dans chacun.

### Entrée 1.3 — Implémentation des points 1+2 : formulaires réactifs et validations/messages d'erreur

**Objectif.** Implémenter exactement le plan verrouillé à l'entrée 1.2
(`Validators.minLength(8)` sur le mot de passe d'inscription, blocage de
l'envoi si formulaire invalide, messages d'erreur par champ), vérifier que
ça compile, puis vérifier le comportement réel dans le navigateur.

**Prompt principal (recopié tel quel) :**
> Ok c'est validé on peut passer à l'implémentation

**Plan proposé par l'agent.** Relecture des 4 fichiers concernés pour
confirmer qu'ils correspondaient toujours à l'état lu lors du plan, puis
application des changements décidés : garde `if (this.form.invalid)` +
`markAllAsTouched()` dans `submit()` de `login-page.ts` et
`register-page.ts` ; ajout de `Validators.minLength(8)` sur le
`FormControl` `password` de `register-page.ts` ; ajout de
`[disabled]="form.invalid"` et de blocs d'erreur par champ (`@if` imbriqués
sur `control.errors?.['...']`) dans `login-page.html` et
`register-page.html`, en réutilisant la classe `.error` déjà existante.
`npm run build` lancé pour valider la syntaxe des templates. Tentative de
vérification visuelle automatisée (agent `run`) : aucun outil de pilotage
navigateur headless disponible dans l'environnement (`chromium-cli`
absent, Playwright non installé) — décision de ne pas installer les
binaires Chromium sans en informer l'utilisateur, et de lui demander de
tester manuellement à la place (il le fait déjà spontanément à chaque
étape).

**Vérifications réalisées.** `npm run build` (succès, avant et après la
correction du bug ci-dessous). Test manuel par l'utilisateur sur `/register`
(conforme au plan du premier coup) et sur `/login` (bug détecté, voir
ci-dessous), avec captures à l'appui.

**Erreurs ou propositions rejetées.** Un bug a été détecté pendant la
vérification manuelle, pas une proposition rejetée : sur `/login`, le
bouton se désactivait bien (`[disabled]="form.invalid"`, réagit
immédiatement à chaque frappe) mais le message d'erreur du champ email
restait invisible tant que l'utilisateur n'avait pas quitté le champ
(condition `.touched`, qui ne se met à jour qu'au blur) — désynchronisation
entre les deux logiques, particulièrement visible sur les champs
pré-remplis du login qu'on peut modifier sans jamais les quitter. Corrigé
en remplaçant `control.touched` par `(control.touched || control.dirty)`
dans les 5 blocs d'erreur des deux templates (`dirty` devient vrai dès la
première frappe qui modifie la valeur, donc se synchronise avec le
grisage du bouton). Le raccourcissement du mot de passe de connexion sans
erreur affichée, lui, n'était **pas** un bug : conforme au plan
(`minLength(8)` volontairement absent du login).

**Fichiers effectivement modifiés.**
`frontend-starter/src/app/components/login-page/login-page.ts`,
`frontend-starter/src/app/components/login-page/login-page.html`,
`frontend-starter/src/app/components/register-page/register-page.ts`,
`frontend-starter/src/app/components/register-page/register-page.html` ;
`compte-rendu/captures/tp1-register-erreur-champ-apres.png` et
`tp1-register-email-password-apres.png` (captures fournies par
l'utilisateur, copiées depuis leur chemin temporaire) ;
`compte-rendu/TP1.md` (cases cochées, section "Implémentation et
vérification" ajoutée) ; `RAPPORT_IA_MODELE.md` (cette entrée).

**Preuve de fonctionnement.** `npm run build` réussi après implémentation
et après correction. Captures fournies par l'utilisateur montrant le
comportement conforme sur `/register` (champ vide → "Email requis" +
bouton grisé ; email mal formé + mot de passe court → deux messages
précis + bouton grisé). Comportement sur `/login` décrit textuellement par
l'utilisateur (pas de capture) avant correction ; à confirmer par une
nouvelle vérification manuelle après correction.

**Ce que je sais expliquer sans l'agent.** Pourquoi `[disabled]="form.invalid"`
et `control.touched` sont deux mécanismes Angular indépendants qui peuvent
se désynchroniser ; la différence entre `dirty` (valeur modifiée) et
`touched` (champ quitté au moins une fois) ; pourquoi utiliser
`(touched || dirty)` résout la désynchronisation sans réintroduire
l'affichage prématuré d'erreurs sur un formulaire vierge (register) ;
pourquoi un mot de passe de connexion raccourci sans devenir vide reste
valide côté client par design.

---

### Entrée 1.4 — Vérification du point 3 (appels register/login) + mise à jour de `analyse.md`

**Objectif.** Vérifier dans l'onglet Network que `/api/auth/register` et
`/api/auth/login` sont bien appelées avec le bon corps et la bonne réponse
(point de vérification, pas de nouveau code), intégrer les captures au
compte-rendu, et mettre à jour `frontend-starter/analyse.md` pour refléter
les changements de code faits aux points 1+2 (Mission 1), qui n'y avaient
pas encore été reportés.

**Prompt principal (recopié tel quel) :**
> oui du coup j'ai fait les captures de la console dans le navigateur et du
> coup j'ai remarqué que les mots de passe et tokens apparaissaient en
> clair dans le navigateur mais c'est normal à ce stade, c'est le point 4
> ça ? [7 captures Network : register/login, Headers/Payload/Response]
>
> ok je veux bien que tu floutes les valeurs sensibles alors intègre au
> compte rendu et on passe au 4 ensuite, et aussi n'oublie pas de mettre à
> jour le analyse.md (back ou front en fonction) lorsqu'on fait des modifs
> dans le code je sais pas si tu l'as fait au points 1 et 2

**Clarification donnée.** Voir un mot de passe/JWT en clair dans l'onglet
Network est normal et attendu à ce stade (c'est le contenu brut de la
requête/réponse HTTP, indépendant du code de l'app) — ce n'est pas le point
4. Le point 4 (« sauvegarde du JWT sans jamais l'afficher dans les logs »)
concerne uniquement d'éventuels `console.log` **dans le code de l'app**, à
vérifier séparément dans `AuthService`. En revanche, le sujet interdit
explicitement de **capturer ou transmettre** un mot de passe/JWT en clair
dans le compte-rendu (section Checkpoint) : les 7 captures fournies en
contenaient (mot de passe en clair dans 2 payloads, JWT en clair dans 2
réponses) et ont donc été floutées avant intégration.

**Ce qui a été fait.**
1. Installation de Pillow (`pip install pillow`, absent de l'environnement)
   pour dessiner les zones de floutage par script Python, avec vérification
   visuelle de chaque capture avant/après (relecture de l'image générée,
   ajustement des coordonnées à deux reprises car les premiers essais
   étaient mal alignés ou trop étroits et laissaient dépasser un fragment
   de la valeur sensible).
2. 7 captures copiées dans `compte-rendu/captures/` sous
   `tp1-mission1-point3-*.png` (4 floutées : réponses register/login
   contenant le token, payloads register/login contenant le mot de passe ;
   3 non modifiées : vues Headers sans donnée sensible).
3. Section "Vérification — Point 3" ajoutée dans `compte-rendu/TP1.md`
   avec les 7 captures et l'explication, case du point 3 cochée.
4. `frontend-starter/analyse.md` mis à jour (§3.4, §5, §7, journal §8)
   pour refléter l'implémentation des points 1+2 de la Mission 1
   (`minLength(8)` sur le mot de passe d'inscription, messages d'erreur par
   champ conditionnés par `touched || dirty`, bouton désactivé si
   formulaire invalide) — ce document n'avait pas encore été touché depuis
   la Phase 0 et décrivait encore l'état du starter avant modification.

**Fichiers effectivement modifiés.**
`frontend-starter/analyse.md` ; `compte-rendu/TP1.md` ; 7 fichiers dans
`compte-rendu/captures/tp1-mission1-point3-*.png` (copiés et, pour 4
d'entre eux, floutés depuis leur chemin temporaire) ; `RAPPORT_IA_MODELE.md`
(cette entrée). Aucun fichier de `backend/` ni de code applicatif
frontend touché — point 3 est une vérification, pas une implémentation.

**Preuve de fonctionnement.** Captures Network fournies par l'utilisateur
montrant `register` → `201 Created` puis `login` → `401 Unauthorized`
(mauvais mot de passe) puis `200 OK` (bons identifiants), avec `token` +
`user` dans les réponses de succès. Chaque capture floutée relue par
l'agent après génération pour confirmer qu'aucune valeur sensible ne
dépassait de la zone masquée avant intégration au compte-rendu.

**Ce que je sais expliquer sans l'agent.** Pourquoi l'onglet Network et les
`console.log` applicatifs sont deux canaux différents (l'un montre le
trafic HTTP brut vu par le navigateur, l'autre ce que le code choisit
explicitement d'afficher) ; pourquoi seul le second est concerné par la
consigne du point 4 ; pourquoi un document d'analyse technique doit être
mis à jour à chaque modification de code pour rester une photo fidèle du
projet, au même titre qu'un compte-rendu de mission.

---

### Entrée 1.5 — Clarification pédagogique sur le point 4 (sauvegarde du JWT sans logs)

**Objectif.** Comprendre ce que recouvre exactement le point 4 avant de le
documenter comme "déjà conforme" dans le compte-rendu.

**Prompt principal (recopié tel quel) :**
> d'accord mais en avant tu peux m'expliquer le point 4 là j'ai pas bien
> compris

**Explication donnée.** Le point 4 regroupe deux exigences distinctes : (1)
la persistance du JWT côté navigateur via deux mécanismes complémentaires —
`localStorage` (survit au rechargement de page, lu une seule fois au
démarrage de l'app pour initialiser le Signal) et le Signal `token`
(mémoire de travail active, relu à chaque requête par `authInterceptor`
pour poser le header `Authorization`) ; (2) une consigne de sécurité
indépendante — ne jamais faire transiter le JWT par un `console.log`, pour
éviter qu'il ne se retrouve visible dans la console ou dans des logs
externes (un JWT volé permet d'usurper l'utilisateur tant qu'il est
valide). Vérification faite : `storeAuthentication()`/`logout()` dans
`AuthService` couvrent le (1), et aucun `console.log` du projet ne touche
au token, ce qui couvre le (2) — le point était donc déjà satisfait par le
starter, sans code à écrire.

**Fichiers effectivement modifiés.** `RAPPORT_IA_MODELE.md` (cette entrée).
Aucun code touché — clarification orale, pas une nouvelle implémentation.

**Ce que je sais expliquer sans l'agent.** La différence entre `localStorage`
(persistance) et un Signal (état réactif consulté en continu par l'app) et
pourquoi les deux sont nécessaires ensemble plutôt qu'un seul des deux ;
pourquoi un JWT ne doit jamais apparaître dans un `console.log`, à la
différence de ce qui est normal de voir dans l'onglet Network (cf. entrée
1.4).

---

### Entrée 1.6 — Point 5 : mise à jour du Signal `currentUser`

**Objectif.** Vérifier que `currentUser` est bien mis à jour à chaque
action qui change l'identité de l'utilisateur connecté (login, register,
profile, update, logout), avant de documenter le point.

**Prompt principal (recopié tel quel) :**
> Parfait on passe au point 5 comme d'habitude explication du point,
> repérage du code et modifications ensuite si nécessaire

**Explication donnée.** `currentUser` est un Signal, donc réactif : tout
template qui le lit se met à jour automatiquement dès qu'il change, sans
code de rafraîchissement manuel. L'enjeu du point est que les 5 actions
pertinentes répercutent bien ce changement.

**Repérage du code.** Quatre `tap()`/affectations dans `AuthService` :
`storeAuthentication()` (`set(response.user)`, appelée par `login()` et
`register()`), `profile()` (`set(user)` après `GET /api/users/me`),
`update()` (`set(user)` après `PUT /api/users/me`), `logout()`
(`set(null)`). `profile-page.html` consomme le Signal via
`@if (auth.currentUser(); as user)`.

**Conclusion.** Les 5 cas sont déjà couverts par le starter — aucune
modification nécessaire, comme pour les points 3 et 4.

**Point de vigilance noté (pas un manquement du point 5) :** après un
rechargement de page, `token` est ré-hydraté depuis `localStorage` mais
`currentUser` repart à `null` tant que `profile()` n'est pas rappelé
explicitement (pas de fetch automatique au démarrage). Sans impact actuel,
à surveiller si un affichage du nom apparaît un jour ailleurs que
`/profile`.

**Fichiers effectivement modifiés.** `compte-rendu/TP1.md` (case cochée,
section "Vérification — Point 5") ; `RAPPORT_IA_MODELE.md` (cette entrée).
Aucun code applicatif touché.

**Ce que je sais expliquer sans l'agent.** Pourquoi un Signal évite un
rafraîchissement manuel des templates ; les 5 points d'entrée qui doivent
mettre à jour l'identité de l'utilisateur connecté et pourquoi les oublier
créerait des incohérences (ex. afficher un ancien nom après modification
du profil) ; pourquoi `token` et `currentUser` ne sont pas ré-hydratés de
la même façon au démarrage de l'app.

---

### Entrée 1.7 — Point 6 : redirection après connexion/inscription réussie

**Objectif.** Vérifier que la redirection post-succès est bien câblée après
login et register, et clarifier si une modification UI était nécessaire.

**Prompt principal (recopié tel quel) :**
> ok on passe au point 6 si j'ai bien compris on doit vérifier que la
> redirection se fait bien après une connexion ou une inscription réussie ?
> on doit aussi changer quelque chose niveau UI ?

**Repérage du code.** `login-page.ts` et `register-page.ts` redirigent
tous deux dans le callback `next` de `subscribe()` (donc uniquement en cas
de succès) : `router.navigateByUrl('/tracks')` après login,
`router.navigateByUrl('/profile')` après register.

**Conclusion.** Point déjà satisfait par le starter — aucune modification
de code ni d'UI nécessaire, contrairement à ce que l'utilisateur imaginait
possible. Vérification faite par lecture de code (pas de requête réseau
associée à ce comportement client-side, donc pas de capture Network
pertinente pour ce point contrairement au point 3).

**Fichiers effectivement modifiés.** `compte-rendu/TP1.md` (case cochée,
section "Vérification — Point 6") ; `RAPPORT_IA_MODELE.md` (cette entrée).
Aucun code applicatif touché.

**Ce que je sais expliquer sans l'agent.** Pourquoi la redirection est
placée dans le callback `next` et pas ailleurs (elle ne doit se déclencher
qu'en cas de succès réel de la requête, jamais sur une erreur 400/401) ; la
différence entre un point de vérification (lecture de code, comportement
déjà présent) et un point d'implémentation (comme les points 1+2).

---

### Entrée 1.8 — Point 7 : bouton de déconnexion, puis 3 ajustements UI suite au test manuel

**Objectif.** Ajouter un déclencheur UI pour `AuthService.logout()` (déjà
existant et fonctionnel), avec cadrage préalable des fichiers avant
codage, comme pour les points 1+2.

**Prompt principal du cadrage (recopié tel quel) :**
> oui on passe au point 7, avant de changer quoi que ce soit repérons le
> code à modifier/ajouter

**Plan validé avant implémentation.** `app.ts` : injection d'`AuthService`
et `Router`, méthode `logout()`. `app.html` : bouton "Déconnexion" affiché
seulement si connecté, lien "Connexion" sinon. Décision de conception
demandée et validée par l'utilisateur : redirection vers `/login` après
déconnexion (plutôt que de rester sur une page qui ne devrait plus être
accessible).

**Implémentation initiale.** Faite telle que planifiée, `npm run build`
réussi. L'utilisateur teste manuellement et valide, avec trois retours
supplémentaires dans la foulée :

> Bon ça marche bien mais ya quelques changemets a apporter deja sur le
> style le nouveau bouton a un bon design mais il est different des autres
> ca cree une incoherence donc faut faire passer tout les autres a ce
> nouveau style. Ensuite quand on est sur la page des tracks on ne sait pas
> qui est connecte ca serait bien de lavoir quelque part et aussi faire
> disparaitre les boutons profile et tracks quand personne n est connecte
> genre niveau visibilite localise bien tout les channgememts a faire

**Diagnostic avant de coder (demandé explicitement : localiser avant de
changer).** Vérification que la règle globale `button {}` de `styles.css`
s'applique déjà de façon identique à tous les boutons de l'app (aucune
surcharge par composant trouvée) — l'incohérence perçue n'était donc pas
entre boutons, mais entre le nouveau `<button>` du nav (stylé) et les
`<a>` du nav (texte blanc simple, `header a { color: white; }`). Plan
présenté et validé pour les 3 demandes avant tout changement de code.

**Implémentation des 3 ajustements :**
1. `styles.css` — nouvelle règle `header nav a, header nav button` unifiant
   visuellement liens et bouton du nav uniquement (pas d'impact sur les
   `<a>` ailleurs dans l'app).
2. `app.html` + `app.ts` — affichage `Connecté : {{ user.name }}` dans le
   header (visible sur toutes les pages). A nécessité de traiter la nuance
   notée à l'entrée 1.6 (point 5) : ajout d'un appel `auth.profile()` dans
   le constructeur de `AppComponent`, exécuté une fois si un token existe
   déjà au démarrage, pour que `currentUser` reste cohérent avec `token`
   après un F5.
3. `app.html` — liens "Backing tracks"/"Profil" déplacés dans le même
   `@if (auth.token())` que le bouton Déconnexion.

`npm run build` : succès après implémentation initiale et après les 3
ajustements.

**Question posée pendant le test, avec réponse (recopiée tel quel) :**
> c est parfait, par contre une question quand je me deconnecte c est
> normal qu il ne se passe rien dans le dev tools ?

Oui, normal : un JWT est stateless (pas de table de sessions côté
backend), donc rien à annuler côté serveur au logout — confirmé par
l'absence de route `logout` dans `API_CONTRACT.md` et `backend/src/app.js`.
Le nettoyage est entièrement côté client (`localStorage` + Signals), d'où
l'absence de requête réseau. Limite notée en passant (hors scope TP) : un
token émis avant déconnexion reste valide côté serveur jusqu'à son
expiration naturelle, faute de mécanisme de révocation.

**Fichiers effectivement modifiés.** `app.ts`, `app.html`, `styles.css`
(implémentation + 3 ajustements) ; `compte-rendu/TP1.md` (case cochée,
section complète) ; `RAPPORT_IA_MODELE.md` (cette entrée).
`frontend-starter/analyse.md` à mettre à jour dans la foulée (entrée
suivante).

**Preuve de fonctionnement.** `npm run build` réussi à chaque étape. Test
manuel confirmé par l'utilisateur : bouton/liens visuellement cohérents,
nom affiché et persistant après F5, liens masqués si déconnecté,
redirection vers `/login` après déconnexion fonctionnelle.

**Ce que je sais expliquer sans l'agent.** Pourquoi un JWT stateless ne
nécessite aucune requête réseau pour se "déconnecter", et sa limite (pas de
révocation possible) ; pourquoi `currentUser` avait besoin d'un
rechargement explicite au démarrage alors que `token` non ; pourquoi
unifier visuellement `<a>` et `<button>` par CSS n'efface pas leur
différence sémantique en HTML (navigation vs action).

---

### Entrée 1.9 — Points 8+9 : bug de chargement du profil trouvé en test, correction, vérification de la modification

**Objectif.** Vérifier le chargement (`GET /api/users/me`) et la
modification (`PUT /api/users/me`) du profil.

**Prompts principaux (recopiés tels quels) :**
> ok pour les parties 8 et 9 regarde mes captures le profil ne charge pas
> /api/users/me mais la modification marche
>
> C est valide lets go

**Diagnostic (avant tout changement de code).** Capture fournie par
l'utilisateur montrant `/profile` affichant déjà les données du profil
sans aucune requête `GET /api/users/me` dans Network (seules `login` et
`tracks` présentes). Cause identifiée : `profile-page.ts` affiche les
données via le Signal partagé `auth.currentUser()`, déjà rempli avant
d'arriver sur la page — par la réponse du login (`storeAuthentication()`)
et/ou par le rechargement automatique ajouté au point 7 dans
`AppComponent`. Le bouton "Charger mon profil" appelle bien
`auth.profile()` au clic, mais rien n'obligeait à cliquer puisque
l'affichage ne dépendait pas de cette action — en plus de contredire
l'intitulé du point 8, ça bloquait la production de la capture "Lecture
`/api/users/me`" exigée par le Checkpoint du TP1.

**Plan proposé et validé avant implémentation.** Un seul fichier :
`profile-page.ts` — appel de `this.load()` dans le constructeur du
composant, pour que l'arrivée sur `/profile` (la vraie "demande" du
profil) déclenche systématiquement un `GET /api/users/me`, indépendamment
de l'état global. Bouton "Charger mon profil" conservé comme
rafraîchissement manuel.

**Vérifications réalisées.** `npm run build` réussi. Capture fournie par
l'utilisateur après correction : `GET /api/users/me` → `200 OK` apparaît
bien dès l'arrivée sur `/profile`, avant tout clic.

**Point 9 (modification du nom) : aucun changement nécessaire.** Capture
fournie par l'utilisateur montrant `PUT /api/users/me` → `200 OK` après
modification du nom en "Test", propagé jusqu'au Signal `currentUser`
(visible dans le header : "Connecté : Test"), cohérent avec le
fonctionnement déjà vérifié au point 5 (entrée 1.6).

**Fichiers effectivement modifiés.** `profile-page.ts` (ajout du
constructeur) ; `compte-rendu/TP1.md` (2 cases cochées, section complète
avec 3 captures) ; `RAPPORT_IA_MODELE.md` (cette entrée) ; 3 captures
copiées dans `compte-rendu/captures/tp1-mission1-point8-*.png` et
`tp1-mission1-point9-*.png` (fournies par l'utilisateur, sans donnée
sensible visible, copiées sans floutage). `frontend-starter/analyse.md` à
mettre à jour dans la foulée (entrée suivante).

**Preuve de fonctionnement.** Captures avant/après pour le point 8
(absence puis présence du `GET /api/users/me`), capture du `PUT` réussi
pour le point 9.

**Ce que je sais expliquer sans l'agent.** Pourquoi un Signal partagé peut
masquer l'absence d'un vrai appel réseau (l'affichage "a l'air" de
marcher sans que le mécanisme censé le déclencher fonctionne) ; pourquoi
la navigation vers une page est le bon endroit pour déclencher un
chargement "à la demande", plutôt que de dépendre d'un état déjà rempli
par une action précédente sans rapport (ici, le login).

---

### Entrée 1.10 — Point 10 : gestion d'un 401, retour vers `/login`

**Objectif.** `authGuard` ne vérifiait que la présence d'un token, jamais
sa validité côté serveur — un token expiré/invalide laissait l'app dans un
état incohérent (visuellement connecté, fonctionnellement cassé). Traiter
tout `401` comme une session invalide : nettoyer l'état local et rediriger
vers `/login`.

**Prompt principal du cadrage (recopié tel quel) :**
> parfait explique moi rapidement le but et cible les modifs a faire

**Diagnostic et plan validés avant codage.** Fichier ciblé :
`authInterceptor`, seul point de passage de toutes les requêtes/réponses
HTTP. Point de conception discuté et validé : ne déclencher le nettoyage/
redirection que si un token était attaché à la requête en échec — un
`401` sur `/api/auth/login` (mauvais mot de passe, pas de token) reste
géré localement par `login-page.ts`, sans quoi son message d'erreur
casserait.

**Implémentation.** `catchError` ajouté au pipe de l'intercepteur :
si `token` présent et `error.status === 401`, appel à `auth.logout()` puis
`router.navigateByUrl('/login')`, avant de relancer l'erreur
(`throwError`) pour que le composant appelant garde son propre traitement
d'erreur s'il en a un. `npm run build` : succès.

**Confusion de test résolue (recopiée tel quel) :**
> c est presque bon je retourne bien vers login mais le nav ne change pas
> [...]
> non mais c est bon avec F5 tout est bon

Diagnostic posé via deux questions ciblées (méthode de test exacte, état
précis du header) : l'utilisateur testait en corrompant `gpc_token` dans
`localStorage` **sans recharger la page**. Ce n'était pas un bug de
l'intercepteur : le Signal `token` d'`AuthService` ne lit `localStorage`
qu'une seule fois, à la création du service — le modifier directement ne
touche pas le Signal déjà en mémoire, donc aucune requête n'utilisait le
token corrompu, donc aucun `401` ne pouvait se produire. Après un F5 (le
Signal se ré-hydrate depuis la valeur corrompue), le comportement attendu
a été confirmé : redirection vers `/login` **et** header repassé en mode
déconnecté.

**Fichiers effectivement modifiés.**
`shared/interceptors/auth.interceptor.ts` ; `compte-rendu/TP1.md` (case
cochée, section complète) ; `RAPPORT_IA_MODELE.md` (cette entrée).
`frontend-starter/analyse.md` à mettre à jour dans la foulée (entrée
suivante). Mission 1 (TP1) complète : 10/10 points.

**Preuve de fonctionnement.** `npm run build` réussi. Confirmation orale
de l'utilisateur après test avec F5 : redirection + header déconnecté
conformes.

**Ce que je sais expliquer sans l'agent.** Pourquoi un Signal initialisé
depuis `localStorage` au démarrage d'un service ne se resynchronise pas
automatiquement si on modifie `localStorage` en direct (il faut un
rechargement complet de l'app) ; pourquoi il ne fallait réagir au `401`
que sur les requêtes ayant un token, pour ne pas interférer avec la
gestion d'erreur déjà en place sur `/login` ; pourquoi centraliser cette
logique dans l'intercepteur plutôt que de la dupliquer dans chaque
composant qui appelle une route protégée.

---

### Entrée 1.11 — Clôture du TP1 : Questions du sujet, Checkpoint et livrables

**Objectif.** Finaliser `compte-rendu/TP1.md` : répondre aux 3 questions du
sujet laissées en suspens, relier le Checkpoint Network aux captures déjà
prises au fil des points plutôt que d'en reprendre de nouvelles, cocher les
livrables du TP1 et rédiger l'explication "Signal vs `localStorage`".

**Prompt principal (recopié tel quel) :**
> bah normalement on a tout jai pris des captures au fur et a mesure

**Ce qui a été fait.**
1. **Questions du sujet** répondues : modèle utilisé (Claude Sonnet 5 via
   Claude Code) et suivi de consommation/conseil de choix de modèle
   (référencé depuis `CONSEILS_POUR_UTIISER_ASSISTANT_AI.md`, §10) ; table
   des 4 routes backend utilisées par la Mission 1 ; localisation exacte
   (fichiers + lignes) de la mise à jour du profil, back (`backend/src/app.js:249-268`)
   et front (`profile-page.html` → `profile-page.ts` → `AuthService.update()`).
2. **Checkpoint Network** : plutôt que de demander 3 nouvelles captures
   redondantes, réutilisation des captures déjà prises aux points 3, 8 et 9
   (connexion réussie/refusée, lecture/modification `/api/users/me`),
   confirmé par l'utilisateur comme suffisant.
3. **Livrables TP1** cochés (code complété, schéma de connexion déjà fait
   en Mission 0, capture Network, `RAPPORT_IA_MODELE.md` à jour).
4. **Section "Signal vs `localStorage`"** rédigée : différence
   persistance/réactivité, pourquoi `AuthService` combine les deux pour
   `token`, et pourquoi `currentUser` a dû apprendre à se "ré-hydrater"
   explicitement (lien avec les nuances découvertes aux points 5, 7 et 10).

**Fichiers effectivement modifiés.** `compte-rendu/TP1.md` (Questions du
sujet, Checkpoint, Livrables, section Signal vs localStorage) ;
`RAPPORT_IA_MODELE.md` (cette entrée). Aucun code applicatif touché.

**Ce que je sais expliquer sans l'agent.** La différence entre persistance
(`localStorage`, survit à un F5 mais pas réactif) et réactivité (Signal,
réactif mais volatile), et pourquoi les combiner nécessite une étape
explicite de ré-hydratation au démarrage — le fil conducteur de plusieurs
bugs/nuances rencontrés tout au long de la Mission 1 (points 5, 7, 8, 10).

---

## TP2 — Bibliothèque Upload et Lecture Audio

> Travail effectué sur la branche Git `TP2` (créée par l'utilisateur),
> fusionnée dans `main` en fin de TP.

### Entrée 2.1 — Mission 2 : bibliothèque paginée (état des lieux + ajout du Signal `error`)

**Objectif.** Le sujet demande d'"implémenter **ou vérifier**" la
pagination serveur. Faire l'état des lieux du starter avant de coder quoi
que ce soit.

**Prompts principaux (recopiés tels quels) :**
> Bon on attaque le TP2, on procède toujours de la même manière, étape par
> étape en comprenant tout et en documentant/historisant et gardant à jour
> tout ce qu'il faut.
>
> ok déjà on commence par revoir cette histoire de signals, concrètement
> c'est quoi ? et comment c'est implémenté ?
>
> ok et cette erreur on va la voir où concrètement ?
>
> ok tu peux implémenter [...] d'ailleurs je précise pour le TP2 j'ai crée
> une nouvelle branche "TP2" on va travailler dedans puis on fera un merge
> à la fin

**Détour pédagogique avant le code.** Explication des Signals (Angular)
demandée avant de continuer : ce que c'est concrètement (une valeur
réactive lue via l'appel `signal()`, écrite via `.set()`/`.update()`, qui
notifie automatiquement Angular sans détection de changement manuelle),
illustrée directement avec le code déjà présent dans `tracks-page.ts`
(`tracks`, `page`, `pages`, `loading`). Puis clarification sur
l'emplacement exact où le futur message d'erreur allait s'afficher
(card "Mes pistes", sous le bouton "Actualiser"), validée avant codage.

**État des lieux (avant tout changement).** Relecture de
`track.service.ts`, `tracks-page.ts`, `tracks-page.html` : l'essentiel de
la Mission 2 était déjà présent dans le starter — `TrackService.list()`
transmet bien `page`/`limit`, les Signals `tracks`/`page`/`pages`/`loading`
existent, `@for`/`@empty`/`@if` sont utilisés, les boutons Préc./Suiv. sont
désactivés aux bornes, et chaque changement de page refait une vraie
requête HTTP (pas de découpage local). **Seul manquant : un Signal
`error`** — un échec de `GET /api/tracks` ne faisait qu'un
`console.error`, invisible pour l'utilisateur.

**Plan validé puis implémenté.** `tracks-page.ts` : Signal
`error = signal('')`, remis à vide en début de `load()`, rempli avec
`error.error?.message` (ou message par défaut) dans le callback d'erreur.
`tracks-page.html` : affichage conditionnel `@if (error())`, même
emplacement/style que "Chargement…" et que le pattern déjà utilisé en
TP1 sur `/login`/`/register`.

**Vérifications réalisées.** `npm run build` : succès. Test manuel de
l'utilisateur : backend coupé volontairement, clic "Actualiser" → message
"Chargement des pistes impossible" affiché au bon endroit, ancienne liste
conservée en dessous (comportement cohérent avec le code : `tracks.set()`
n'est appelé que dans le callback `next`, jamais vidé en cas d'erreur).

**Fichiers effectivement modifiés.** `tracks-page.ts`, `tracks-page.html` ;
`compte-rendu/TP2.md` (prérequis + Mission 2 cochés, tableau "déjà présent
vs ajouté", capture) ; `RAPPORT_IA_MODELE.md` (cette entrée) ; 1 capture
copiée dans `compte-rendu/captures/tp2-mission2-erreur-liste-backend-down.png`.
`frontend-starter/analyse.md` à mettre à jour dans la foulée (entrée
suivante).

**Preuve de fonctionnement.** `npm run build` réussi. Capture fournie par
l'utilisateur montrant le message d'erreur affiché après coupure
volontaire du backend.

**Ce que je sais expliquer sans l'agent.** Ce qu'est un Signal Angular
concrètement (création `signal()`, lecture `nom()`, écriture
`.set()`/`.update()`) et pourquoi il évite la détection de changement
manuelle ; pourquoi la plupart des exigences de la Mission 2 étaient déjà
couvertes par le starter (vérifier avant d'implémenter évite de dupliquer
du code existant) ; pourquoi l'ancienne liste reste affichée sous le
message d'erreur plutôt que de disparaître (le Signal `tracks` n'est
modifié que par un succès).

---

### Entrée 2.2 — Vérification concrète : une requête HTTP par changement de page

**Objectif.** L'utilisateur voulait revoir où, précisément, le sujet
interdisant "récupérer toutes les pistes puis les découper localement" est
respecté dans le code — puis le constater concrètement dans Network.

**Prompts principaux (recopiés tels quels) :**
> "Après chaque changement de page, effectuer une nouvelle requête HTTP.
> [...]" on peut revenir sur ça rapidement tu peux juste me dire où c'est
> fait ?
>
> d'accord mais pour l'instant les boutons sont désactivés, tu peux les
> activer le temps que je teste et on les désactive après. Passe aussi la
> limite de tracks par page à 2

**Explication donnée avant de toucher au code.** Repérage des 3 endroits
du flux : `go()` (déclencheur), `load()` (nouvel appel HTTP à chaque fois,
pas de cache), `TrackService.list()` (`page`/`limit` en query params,
filtrage fait côté serveur). Clarifié que les boutons Préc./Suiv.
n'étaient pas buggés : avec 5 pistes de test et `limit=5` (défaut), tout
tient sur une seule page, donc les deux boutons restent désactivés en
permanence — rien à voir avec le code, juste un jeu de données trop petit
pour observer plusieurs pages. Pas besoin de forcer leur état (ce qui
aurait contredit l'exigence "désactivés aux bornes", déjà validée) : faire
passer la limite à 2 suffisait à les débloquer naturellement.

**Changement temporaire.** `tracks-page.ts`, `load()` :
`this.service.list(this.page())` → `this.service.list(this.page(), 2)`
avec un commentaire `// TODO` explicite, le temps du test utilisateur.
`npm run build` : succès. Une fois le test confirmé par l'utilisateur
(capture Network : 4 requêtes distinctes `tracks?page=1/2/2/3&limit=2`,
dont un retour en arrière), le changement a été **entièrement annulé**
(retour à `this.service.list(this.page())`, `npm run build` re-vérifié) —
aucune trace dans le code final.

**Fichiers effectivement modifiés (net, après annulation du test).**
`compte-rendu/TP2.md` (nouvelle sous-section "Preuve Network" avec la
capture) ; `RAPPORT_IA_MODELE.md` (cette entrée) ; capture copiée dans
`compte-rendu/captures/tp2-mission2-network-pagination.png`. Aucun
changement net sur `tracks-page.ts` (modifié puis annulé dans le même
échange).

**Preuve de fonctionnement.** Capture Network fournie par l'utilisateur :
4 requêtes `GET /api/tracks?page=...&limit=2` distinctes, une par
navigation de page.

**Ce que je sais expliquer sans l'agent.** Pourquoi des boutons
"désactivés aux bornes" peuvent sembler cassés alors qu'ils sont juste
correctement bloqués faute de données suffisantes pour avoir plusieurs
pages ; pourquoi modifier une valeur de test doit être fait de façon
traçable (commentaire `TODO`) et annulé explicitement plutôt que laissé en
place "au cas où".

---

### Entrée 2.3 — Mission 3 : identification du flux upload/lecture (sans code)

**Objectif.** Clôturer formellement la Mission 2, puis démarrer la
Mission 3 exactement comme le sujet le demande : identifier d'abord dans
le code (fichiers + méthodes) le flux upload et lecture, avant toute
implémentation.

**Prompt principal (recopié tel quel) :**
> parfait on peut cloturer la mission 2, prochain objectif faire la
> mission 3 et ensuite personnaliser l'app avec les parties facultatives
> et avancées

**Identification réalisée (lecture seule, aucune modification).**
7 étapes localisées avec fichier + numéro de ligne : choix du fichier
(`tracks-page.html:12` → `tracks-page.ts:26-29`), construction du
`FormData` et appel HTTP d'upload (`track.service.ts:17-21`), récupération
du `Blob` (`track.service.ts:24-28`), création de l'`ObjectURL` et
affectation au lecteur (`tracks-page.ts:67-77`, `tracks-page.html:41`),
révocation — **partielle seulement** : de l'URL précédente à chaque
lecture, pas encore à la destruction du composant. Contrôles backend
identifiés (`backend/src/app.js`) : fichier obligatoire, taille max 25 Mo,
6 types MIME autorisés, vérification de propriété à la lecture, erreurs
Multer converties en `400` — aucun dupliqué côté frontend.

**Vérification concrète demandée par l'utilisateur avant de continuer**
(recopiée tel quel) :
> je vais juste aller vérifier ce point dans mon navigateur et t'envoyer
> une capture pour le compte-rendu : "Dans l'onglet Network [...] repérez
> aussi l'intercepteur qui ajoute le JWT à la requête audio."

Deux captures fournies (réponse `200 OK` avec `Content-Type: audio/mpeg`
et `Accept-Ranges: bytes` ; requête avec header `Authorization: Bearer
<JWT>` présent). La seconde contenait le JWT en clair — floutée avant
intégration (même règle qu'en TP1 : jamais de JWT/mot de passe visible
dans le compte-rendu), en conservant tous les autres en-têtes lisibles
(`Referer`, `Sec-Ch-Ua`, etc.).

**État des lieux checklist Mission 3**, établi avant tout codage : sur 11
exigences, 1 déjà faite (formulaire vidé + retour page 1), 1 partielle
(bouton désactivé mais pas d'anti double-soumission), 1 partielle
(cards basiques), 8 absentes — contrairement à la Mission 2, cette mission
demande une vraie quantité d'implémentation.

**Fichiers effectivement modifiés.** `compte-rendu/TP2.md` (identification
complète de la Mission 3, tableau des contrôles backend, état des lieux
de la checklist, réponse à "pourquoi la validation frontend ne remplace
pas le backend", 2 captures) ; `RAPPORT_IA_MODELE.md` (cette entrée) ; 2
captures copiées dans `compte-rendu/captures/tp2-mission3-audio-*.png`
(dont une floutée). Aucun code applicatif touché — étape d'identification
pure, conforme à la consigne du sujet.

**Preuve de fonctionnement.** Captures Network fournies par l'utilisateur
confirmant la présence du header `Authorization` sur la requête audio.

**Ce que je sais expliquer sans l'agent.** Pourquoi la validation
frontend n'est qu'un confort d'UX et ne remplace jamais la validation
backend (le frontend est entièrement contournable, ex. via `curl`) ;
pourquoi l'intercepteur JWT ne peut agir que sur les requêtes passées par
`HttpClient`, jamais sur une URL directement posée dans un attribut HTML
comme `src`.

---

### Entrée 2.4 — Mission 3, points 1+2 : validation frontend du fichier + message d'erreur

**Objectif.** Reproduire côté client les mêmes règles que le backend
(type MIME, taille max 25 Mo) pour donner un retour immédiat, sans
attendre l'aller-retour réseau — sans jamais remplacer la validation
backend.

**Prompts principaux (recopiés tels quels) :**
> oui ça me va fait ça
>
> voilà j'ai testé mais il y a juste une petite incohérence dans le
> message j'ai sélectionnné une image et l'erreur me dit : "format audio
> non accepté", je pense que ça serait mieux de mettre "format non
> accepté" de manière plus générique
>
> J'ai pas de fichier audio de plus de 25mo

**Plan validé puis implémenté.** `tracks-page.ts` : constantes
`ALLOWED_AUDIO_TYPES` (mêmes 6 types MIME que `backend/src/app.js`) et
`MAX_FILE_SIZE` (25 Mo) ; Signal `uploadError` ; `choose()` réécrit pour
valider type puis taille, ne stocker `this.file` que si les deux passent
(le bouton "Envoyer" reste désactivé sinon, sans logique
supplémentaire). `tracks-page.html` : affichage conditionnel de
`uploadError()` entre le champ fichier et le bouton. `npm run build` :
succès.

**Erreur trouvée et corrigée pendant le test.** Message initial "Format
audio non accepté" incohérent pour un fichier qui n'est pas du tout un
audio (l'utilisateur avait sélectionné une image) — corrigé en "Format
non accepté", plus générique.

**Test du cas "fichier trop volumineux" sans fichier réel disponible.**
L'utilisateur n'avait pas de fichier audio de plus de 25 Mo sous la main.
Un fichier factice de 26 Mo (`fichier-trop-gros-test.mp3`, contenu
arbitraire, seule la taille et l'extension comptent pour cette
vérification côté client) a été généré dans le répertoire scratchpad de
la session, utilisé pour le test, puis supprimé une fois la capture
obtenue — aucune trace de ce fichier de test dans le dépôt.

**Fichiers effectivement modifiés.** `tracks-page.ts`, `tracks-page.html` ;
`compte-rendu/TP2.md` (2 cases cochées, section "Implémentation —
validation frontend + message d'erreur" avec code et 2 captures) ;
`RAPPORT_IA_MODELE.md` (cette entrée) ; 2 captures copiées dans
`compte-rendu/captures/tp2-mission3-validation-*.png`.

**Preuve de fonctionnement.** `npm run build` réussi. Deux captures
fournies par l'utilisateur : fichier non audio → "Format non accepté" ;
fichier `.mp3` factice de 26 Mo → "Fichier trop volumineux (25 Mo
maximum)" — bouton "Envoyer" grisé dans les deux cas.

**Ce que je sais expliquer sans l'agent.** Pourquoi valider le type ET la
taille côté client avant d'autoriser l'envoi, en réutilisant exactement
les mêmes règles que `backend/src/app.js` plutôt que d'en inventer de
nouvelles ; pourquoi ne pas stocker `this.file` en cas d'échec suffit à
désactiver le bouton sans dupliquer la condition ; comment fabriquer un
fichier de test de taille contrôlée sans dépendre d'un vrai fichier audio
volumineux.

---

### Entrée 2.5 — Mission 3, points 3+4 : état de chargement + anti double-soumission

**Objectif.** Donner un retour visuel pendant l'upload et empêcher un
second clic sur "Envoyer" tant qu'une requête est déjà en cours.

**Prompts principaux (recopiés tels quels) :**
> aller on fait comme ça
>
> c'est trop rapide génère moi un truc plus gros

**Plan validé puis implémenté.** Signal `uploading` ; garde
`if (!this.file || this.uploading()) return;` en tête de `upload()` ;
mis à `true` avant l'appel HTTP, à `false` dans les callbacks `next` et
`error`. Bouton `[disabled]="!file || uploading()"`, message "Envoi en
cours…" affiché pendant ce temps. `npm run build` : succès.

**Difficulté de test et solution.** `localhost` a un débit local trop
élevé pour observer l'état de chargement avec les petits fichiers de
test existants — l'upload se termine avant même le rendu visuel. Un
fichier `.mp3` factice de 20 Mo (contenu aléatoire arbitraire, sous la
limite de 25 Mo pour rester valide) a été généré dans le répertoire
scratchpad, combiné avec le throttling réseau "Slow 3G" de DevTools pour
ralentir artificiellement l'envoi et rendre l'état visible. Fichier
supprimé après le test.

**Fichiers effectivement modifiés.** `tracks-page.ts`, `tracks-page.html` ;
`compte-rendu/TP2.md` (2 cases cochées, section "Implémentation" avec
code, méthode de test expliquée, capture) ; `RAPPORT_IA_MODELE.md` (cette
entrée) ; capture copiée dans
`compte-rendu/captures/tp2-mission3-upload-envoi-en-cours.png`. Le
fichier `.mp3` factice de test a réellement été envoyé et a créé une
piste dans la bibliothèque du compte de test (le backend ne vérifie que
type/taille, pas le contenu réel) — sans conséquence sur un compte de
test, pas de suppression possible pour l'instant (fonctionnalité
facultative non implémentée).

**Preuve de fonctionnement.** `npm run build` réussi. Capture fournie par
l'utilisateur (throttling 3G actif) : message "Envoi en cours…" et
bouton "Envoyer" grisé pendant que la requête `tracks` est encore
"Pending" dans Network.

**Ce que je sais expliquer sans l'agent.** Pourquoi la taille d'un
fichier n'est pas le facteur limitant sur un réseau local (c'est la
latence et la bande passante qui comptent, très favorables sur
`localhost`) ; pourquoi combiner un Signal d'état de chargement avec la
condition de désactivation du bouton dans la **même** garde
(`if (!this.file || this.uploading())`) évite d'avoir deux logiques
séparées à synchroniser.

---

### Entrée 2.6 — Mission 3, points 5+6 : message de succès + erreurs serveur (upload), bug "Failed to fetch" corrigé

**Objectif.** Afficher un message de succès après upload et un message
d'erreur compréhensible en cas d'échec côté serveur — les deux
regroupés après discussion, car ce sont les deux issues du même
callback `subscribe()`.

**Prompt principal du cadrage (recopié tel quel) :**
> Ok faisons le point sur les erreurs serveur et le message de succès et
> on voit si c'est pertinent de les faire tout les deux en même temps

**Plan validé puis implémenté.** Signal `uploadSuccess` ajouté ;
`uploadError` réutilisé pour l'erreur serveur (même rôle que pour la
validation de fichier) ; les deux vidés au début de chaque tentative et
à chaque nouvelle sélection de fichier.

**Bug trouvé pendant le test (pas une simple question de texte) :**
> ok c'est fonctionnel mais on va faire une modif, "failed to fetch"
> c'est pas lisible pour un utilisateur remplace par "échec de l'envoi"
> et pour le message de succés met le en vert par opposition au rouge du
> message d'erreur et met "ajouté avec succès"

Le code faisait confiance à `error.error?.message` dans tous les cas.
Diagnostic : `error.status === 0` signifie qu'aucune réponse n'est venue
du serveur (backend coupé) — dans ce cas `error.error` est une erreur
technique du navigateur (`TypeError: Failed to fetch`), pas le JSON
applicatif du backend. Correction : fonction `serverErrorMessage(error,
fallback)`, qui n'utilise le message du backend que si `error.status > 0`,
sinon un message de repli fixe. **Appliquée aussi à `load()`** (Mission 2)
qui avait la même faille latente, non encore visible mais bien réelle —
pas seulement à l'endroit signalé par l'utilisateur.

**Ajustements de forme.** Message "Échec de l'envoi" en repli ; message
de succès accordé au féminin ("« titre » ajoutée avec succès.",
correction de l'accord par rapport à la demande initiale "ajouté", pour
s'accorder avec "piste") ; nouvelle classe CSS `.success` (même vert que
le reste de l'app) en symétrie de `.error`.

**Fichiers effectivement modifiés.** `tracks-page.ts`, `tracks-page.html`,
`styles.css` ; `compte-rendu/TP2.md` (2 cases cochées, section
"Implémentation" avec code, diagnostic du bug, 3 captures) ;
`RAPPORT_IA_MODELE.md` (cette entrée) ; 3 captures copiées dans
`compte-rendu/captures/tp2-mission3-{erreur-failed-to-fetch-avant,
succes-avant-couleur, erreur-echec-envoi-apres}.png`.

**Preuve de fonctionnement.** `npm run build` réussi à chaque étape.
Captures avant/après confirmant la disparition du message technique
"Failed to fetch", remplacé par "Échec de l'envoi" (upload) et
"Chargement des pistes impossible" (liste), backend toujours coupé dans
les deux cas.

**Ce que je sais expliquer sans l'agent.** Pourquoi `error.status === 0`
signale une absence totale de réponse serveur (à distinguer d'un vrai
code d'erreur HTTP) et pourquoi `error.error` n'est alors pas le JSON
applicatif attendu ; pourquoi corriger ce genre de bug à l'endroit
signalé ne suffit pas — il faut vérifier si la même faille existe
ailleurs dans le code (ici, `load()` aussi) plutôt que de se limiter au
symptôme rapporté.

---

### Entrée 2.7 — Mission 3, point : affichage du morceau en cours de lecture

**Objectif.** Indiquer visuellement quelle piste correspond au lecteur
`<audio>` affiché après un clic sur ▶.

**Prompts principaux (recopiés tels quels) :**
> Parfait on passe à l'affichage du morceaua en cours de lecture
>
> Dans l'ensemble je suis ok mais je pense qu'on pourrait aussi ajouter
> le titre de la piste au niveau du lecteur audio qui apparaît

**Plan ajusté en cours de cadrage.** Plan initial : Signal
`playingTrackId` (juste l'id). Ajusté suite à la demande de
l'utilisateur pour aussi afficher le titre près du lecteur : stocker la
**piste entière** (`playingTrack = signal<Track | null>(null)`) plutôt
que juste son id, pour donner accès au titre à deux endroits (badge dans
la liste + titre au-dessus du lecteur) sans dupliquer de logique ni
chercher la piste dans `tracks()` (qui est paginé et pourrait ne plus
contenir la piste jouée si la page a changé entre-temps).

**Implémentation.** `play()` : `playingTrack.set(track)` dans le
callback `next` (en même temps que `audioUrl`, donc toujours cohérent),
remis à `null` sur erreur. Template : badge "▶ En cours de lecture"
(texte, pas seulement une couleur, pour l'accessibilité) sous le titre de
la piste active dans le `@for` ; "Lecture : *titre*" au-dessus du lecteur
`<audio>`. Nouvelle classe CSS `.now-playing`. `npm run build` : succès.

**Fichiers effectivement modifiés.** `tracks-page.ts`, `tracks-page.html`,
`styles.css` ; `compte-rendu/TP2.md` (case cochée, section
"Implémentation" avec code et capture) ; `RAPPORT_IA_MODELE.md` (cette
entrée) ; capture copiée dans
`compte-rendu/captures/tp2-mission3-piste-en-cours-de-lecture.png`.

**Preuve de fonctionnement.** `npm run build` réussi. Capture fournie
par l'utilisateur confirmant la cohérence entre le badge dans la liste et
le titre affiché au-dessus du lecteur, en changeant de piste.

**Ce que je sais expliquer sans l'agent.** Pourquoi stocker la piste
entière plutôt qu'un simple id évite d'avoir à la rechercher dans une
liste paginée qui peut avoir changé ; pourquoi un indicateur d'état
(ici "en cours de lecture") doit toujours comporter du texte, pas
seulement une couleur, pour rester perceptible avec un lecteur d'écran.

---

### Entrée 2.8 — Mission 3, point : erreur audio compréhensible (+ 2 incohérences corrigées)

**Objectif.** Afficher un message compréhensible quand la lecture échoue
— deux causes distinctes identifiées avant de coder : échec de la
requête HTTP (déjà catché mais juste loggé) et fichier reçu mais
illisible par le navigateur (événement natif de l'élément `<audio>`,
hors du `subscribe()`).

**Prompts principaux (recopiés tels quels) :**
> parfait on passe à l'erreur de lecture compréhensible
>
> parfait on fait comme ça
>
> tu peux me générer un fichier de test avec un contenu iliisible comme
> t'a fait tout à l'heure pour le test de taille du fichier

**Plan validé puis implémenté.** Signal `audioError` ; rempli par
`serverErrorMessage()` (déjà utilisé pour `load()`/`upload()`) dans le
callback `error` de `play()`, et par une nouvelle méthode
`onAudioError()` branchée sur `(error)` de `<audio>` pour le cas
"fichier illisible". Message affiché au-dessus du lecteur.

**Génération d'un fichier de test.** `.mp3` factice de 50 Ko (contenu
aléatoire, valide pour le type/la taille — accepté à l'upload comme au
point précédent — mais indécodable comme audio réel), généré dans le
scratchpad, utilisé pour déclencher `onAudioError()`, supprimé après le
test.

**Deux incohérences trouvées pendant le test, recopiées tel quel :**
> ok le message en bas s'affiche bien mais j'ai quelques incohérences au
> niveaiu des autres messages, pour être raccord, il faudrait que le
> badge en cours de lecture soit remplacé par "erreur" et aussi le
> message de succès au niveau de l'ajour devrait disparaître lorsque
> j'effectue une autre action

1. **Badge de liste incohérent.** `playingTrack` était rempli dès le
   téléchargement du `Blob`, avant de savoir si le navigateur pouvait le
   lire — le badge "En cours de lecture" restait donc affiché même en
   échec. Nouveau Signal `playbackFailed`, mis à `true` uniquement par
   `onAudioError()` — **jamais** par l'échec HTTP, sciemment : si une
   piste différente jouait déjà, elle ne doit pas être faussement
   marquée en erreur par l'échec d'une tentative sur une autre piste.
2. **Message de succès de l'upload qui persistait** après une action sans
   rapport (clic sur ▶). `uploadSuccess` vidé en tout début de `load()`
   et de `play()`. A nécessité de réordonner `upload()` : appeler
   `load()` **avant** de fixer le message de succès, sinon `load()`
   l'aurait effacé aussitôt (il le vide lui aussi en tout début).

**Fichiers effectivement modifiés.** `tracks-page.ts` (Signaux
`audioError`, `playbackFailed`, méthode `onAudioError()`, réordonnancement
de `upload()`, vidage de `uploadSuccess` dans `load()`/`play()`) ;
`tracks-page.html` (message d'erreur, binding `(error)`, badge
conditionnel) ; `styles.css` (règle `.track small.error`, même
contrainte de spécificité CSS que `.now-playing`) ; `compte-rendu/TP2.md`
(case cochée, section complète avec 3 captures) ; `RAPPORT_IA_MODELE.md`
(cette entrée).

**Preuve de fonctionnement.** `npm run build` réussi à chaque étape.
Capture avant (badge et message incohérents) puis après (badge "⚠ Erreur
de lecture", message de succès disparu) fournies par l'utilisateur.

**Ce que je sais expliquer sans l'agent.** Pourquoi il faut deux Signaux
distincts (`playingTrack` pour "quel titre est chargé", `playbackFailed`
pour "est-ce que ça s'est bien passé") plutôt qu'un seul état combiné,
pour ne pas propager l'échec d'une tentative à une piste différente
toujours en cours de lecture ; pourquoi l'ordre des opérations compte
quand plusieurs méthodes se remettent à zéro mutuellement (`load()` vide
`uploadSuccess`, donc l'appeler avant de le fixer, pas après).

---

### Entrée 2.9 — Mission 3, point : révocation de l'`ObjectURL` à la destruction du composant

**Objectif.** `play()` révoque déjà l'ObjectURL précédente à chaque
nouvelle lecture, mais la dernière créée restait en mémoire si
l'utilisateur quittait `/tracks` sans relire une autre piste —
`URL.createObjectURL` garde le `Blob` référencé jusqu'à révocation
explicite, indépendamment du cycle de vie Angular.

**Prompt principal (recopié tel quel) :** "oui faisons ça"

**Implémentation.** `TracksPageComponent implements OnDestroy` ;
`ngOnDestroy()` révoque `audioUrl()` s'il existe. `npm run build` :
succès.

**Méthode de vérification (proposée faute d'effet visible à l'écran).**
Lecture d'une piste, récupération de l'URL du lecteur via
`document.querySelector('audio').src`, navigation vers `/profile`, puis
`fetch()` sur cette URL depuis la console : doit échouer si la
révocation fonctionne.

**Fichiers effectivement modifiés.** `tracks-page.ts` (`OnDestroy`,
`ngOnDestroy()`) ; `compte-rendu/TP2.md` (case cochée, section
"Implémentation" avec code, méthode de test, capture) ;
`RAPPORT_IA_MODELE.md` (cette entrée) ; capture copiée dans
`compte-rendu/captures/tp2-mission3-objecturl-revoquee.png`.

**Preuve de fonctionnement.** `npm run build` réussi. Capture fournie par
l'utilisateur : `fetch()` sur l'ObjectURL après avoir quitté `/tracks` →
`TypeError: Failed to fetch`, confirmant que l'URL a bien été révoquée.

**État de la Mission 3.** 10/11 points de la checklist traités ; il ne
reste que les cards responsives/accessibles avec plus de métadonnées.

**Ce que je sais expliquer sans l'agent.** Pourquoi `URL.createObjectURL`
garde une référence mémoire indépendante du cycle de vie du composant
Angular, et pourquoi ça justifie un nettoyage explicite dans
`ngOnDestroy` plutôt que de compter sur le garbage collector ; comment
vérifier qu'une révocation a bien eu lieu sans effet visible à l'écran
(tenter un `fetch()` sur l'URL et observer l'échec).

---

### Entrée 2.10 — Mission 3 : questions mémoire, buffering, streaming (pédagogie, sans code)

**Objectif.** Répondre aux 5 questions du sujet sur la mémoire, le
buffering et le streaming audio. Méthode demandée par l'utilisateur :
répondre aux questions une par une, lui essayant d'abord, l'agent
corrigeant et localisant le code à l'appui.

**Prompt principal du cadrage (recopié tel quel) :**
> maintenant il faut qu'on réponde à ses questions, on va les faire une
> par une je vais d'abord essayer d'y répondre puis tu vas me corriger et
> m'aider à localiser les éléments de code qui expliquent les réponses

**Déroulé, question par question (réponses de l'utilisateur recopiées,
puis correction/complément apportés) :**

1. *Streaming backend ?* Réponse initiale correcte sur le principe
   ("ça correspond au streaming") mais sans savoir où dans le code.
   Localisé : `backend/src/app.js:394`, `res.sendFile()` (utilise
   `fs.createReadStream()` en interne). Preuve additionnelle apportée :
   l'en-tête `Accept-Ranges: bytes`, déjà visible dans une capture prise
   en Mission 3, confirme le streaming sans avoir besoin d'un nouveau
   test.
2. *Moment de réception côté Angular ?* L'utilisateur cherchait dans
   `tracks-page.ts` sans trouver. Recentré sur `track.service.ts:24-28`
   (`audio()`, pas de `reportProgress: true`) : `HttpClient` assemble
   toute la réponse avant de déclencher `next` une seule fois — contraste
   direct avec le streaming du backend (streaming "en transit", pas dans
   ce que voit le code Angular).
3. *100 morceaux : tout en mémoire à l'affichage ?* L'utilisateur a
   demandé confirmation ("tout les paquets sont déjà arrivés ?") avant de
   répondre à la question 3 elle-même — confirmé. Sa réponse à la
   question 3 était juste sur le fond ("seul le fichier en cours de
   lecture est chargé") ; complétée avec la justification code précise
   demandée par le sujet : `TrackService.list()` ne renvoie que du JSON
   (jamais de binaire), et `play()` ne garde qu'une seule URL à la fois
   (révocation de l'ancienne avant la nouvelle).
4. *Différence avec 100 `<audio>` en URL directe ?* Réponse initiale
   incomplète (seulement "toutes les requêtes partiraient à l'affichage").
   Point manquant, plus important que la performance : ces requêtes ne
   passent jamais par `authInterceptor` (pas de `HttpClient`), donc aucun
   header `Authorization` → les 100 échoueraient en `401` sur la route
   protégée — rupture fonctionnelle totale, pas qu'un problème de perf.
   Relié à l'explication de l'intercepteur déjà donnée plus tôt en
   Mission 3.
5. *Pourquoi révoquer l'`ObjectURL` ?* Réponse initiale correcte sur le
   fond (éviter l'accumulation de plusieurs fichiers en mémoire).
   Complétée avec la nuance technique : la correspondance
   `blob:...` ↔ `Blob` est maintenue par le navigateur indépendamment de
   toute référence JavaScript, donc ce n'est pas un simple défaut de
   nettoyage mais une fuite **garantie** sans révocation explicite —
   d'où les deux endroits de révocation dans le code (`play()` et
   `ngOnDestroy()`) pour deux fuites distinctes.

**Fichiers effectivement modifiés.** `compte-rendu/TP2.md` (les 5
réponses complètes, avec renvois code et captures déjà existantes, dans
la section "Questions — mémoire, buffering, streaming") ;
`backend/analyse.md` (note sur `Range`/`res.sendFile` mise à jour :
passée de "non testé/documenté" à "confirmé en pratique", avec renvoi
vers la capture Mission 3) ; `RAPPORT_IA_MODELE.md` (cette entrée). Aucun
code applicatif touché — exercice pédagogique pur, pas d'implémentation.

**Preuve de fonctionnement.** Aucune nouvelle preuve technique
nécessaire : toutes les réponses s'appuient sur du code et des captures
déjà vérifiés aux entrées précédentes (2.1 à 2.9).

**Ce que je sais expliquer sans l'agent.** La différence entre streaming
réseau (backend → navigateur, par morceaux) et streaming applicatif
(backend → composant Angular, qui lui attend le tout) ; pourquoi un objet
JavaScript référencé uniquement via une Object URL échappe au garbage
collector habituel ; pourquoi la vraie raison du `Blob`/`ObjectURL` dans
ce projet est l'authentification JWT, pas une préférence de style.

---

### Entrée 2.11 — Mission 3 : cards responsives et accessibles, puis passage à Angular Material

**Objectif.** Dernier point de la checklist Mission 3 : transformer la
liste de pistes en cards responsives/accessibles (titre, nom original,
format, taille, date, action de lecture).

**Prompts principaux (recopiés tels quels) :**
> Aller on s'y attaque, choissisons d'abord quel genre de card on va
> implémenter
>
> Je vois mais on va rendre ça encore plus beau, déjà détaille moi un peu
> plus ce que t'as fait exactement
>
> ok je vois, on peut pas utiliser un composant de la bibliothèque
> graphique angular ?

**Étape 1 — CSS fait maison.** Choix du style demandé via question à
options avec previews ASCII (liste de mini-cards empilées vs grille) —
utilisateur choisit les mini-cards empilées. Implémenté : `<ul>`/`<li>`
sémantique, métadonnées complètes, bug corrigé au passage (taille
affichée en octets bruts étiquetés "Ko").

**Étape 2 — détail demandé avant d'aller plus loin.** Explication fichier
par fichier de ce qui avait été fait (`tracks-page.ts`, `.html`,
`styles.css`), avant que l'utilisateur ne demande le passage à Angular
Material.

**Étape 3 — décision d'installer Angular Material.** Nouvelle dépendance
= vraie décision de projet, posée via question à options (installer
maintenant vs rester en CSS fait maison) plutôt que tranchée seule.
Utilisateur choisit l'installation.

**Implémentation.** `ng add @angular/material` (thème custom,
typographie, animations). **Dépendance manquante trouvée et corrigée
pendant le build** : `@angular/animations` pas installé du tout
(`ng add` ne l'ajoute pas automatiquement dans cette version), build en
échec — ajouté en `22.1.4` pour matcher le reste du projet. Palette
changée de `mat.$azure-palette` à `mat.$green-palette`. **Conflits avec
le CSS existant trouvés et corrigés** : la règle globale `button {}`
s'appliquait aussi aux boutons Material (restreinte via `:not(...)`) ;
le fond de `body` posé par Material écrasait le vert de marque (fixé
explicitement). Cards en `mat-card appearance="outlined"`.

**Incohérence de couleur trouvée et corrigée** (recopié tel quel) :
> c'est good, maintenant tu peux implémenter le paginator [...] juste le
> vert du bouton je le trouve pas cohérent avec le reste du menu garde
> l'îcone triangle verte au milieu mais le fond passe à du blanc cassé

Le vert "primary" généré par Material à partir de `mat.$green-palette`
ne correspond pas exactement à `#1d755e`. Question posée (bouton rond
plein vert vs icône subtile) avant de corriger ; couleurs fixées
directement (`!important` nécessaire pour l'emporter sur les variables
CSS internes de `mat-mini-fab`) plutôt que `color="primary"`.

**Espacement corrigé** : `mat-card-header` + `mat-card-actions` séparés
remplacés par un seul `mat-card-content` en flex-row, qui laissaient un
grand vide vertical (paddings Material empilés).

**Fichiers effectivement modifiés.** `tracks-page.ts`, `tracks-page.html`,
`styles.css`, `main.ts`, `material-theme.scss` (créé par le schematic),
`package.json`/`package-lock.json` (`@angular/material`, `@angular/cdk`,
`@angular/animations`) ; `compte-rendu/TP2.md` (case cochée, section
complète avec 3 captures) ; `RAPPORT_IA_MODELE.md` (cette entrée) ; 3
captures copiées dans `compte-rendu/captures/tp2-mission3-cards-*.png`.

**Preuve de fonctionnement.** `npm run build` réussi à chaque étape.
Captures avant/après confirmant la correction de couleur, confirmées
par l'utilisateur ("c'est good").

**Ce que je sais expliquer sans l'agent.** Pourquoi une palette Material
générée à partir d'une teinte générique ne correspond jamais exactement
à une couleur de marque précise, et pourquoi fixer les couleurs
directement (avec `!important`) est parfois nécessaire face aux
variables CSS internes d'un composant tiers ; pourquoi installer une
bibliothèque de composants est une décision de projet à exposer
explicitement, pas un simple détail d'implémentation.

---

### Entrée 2.12 — Mission 2 AVANCÉ : `mat-paginator`

**Objectif.** Bonus facultatif du sujet TP2 (Mission 2) : remplacer le
pager fait maison par le composant Paginator d'Angular Material.

**Prompt principal (recopié tel quel) :** implicite, enchaîné après la
validation de la couleur du bouton de lecture ("maintenant tu peux
implémenter le paginator puis m'expliquer comment tout ça marche").

**Implémentation.** `<mat-paginator [length] [pageSize] [pageIndex]
[pageSizeOptions] (page)="onPage($event)">`. Nouveau Signal `total`
(`response.total`, jamais récupéré jusqu'ici) ; Signal `pages` devenu
inutile et supprimé (`mat-paginator` recalcule lui-même le nombre de
pages). `onPage()` reconvertit `pageIndex` (0-based) en `page` (1-based,
cohérent avec le contrat `?page=1` de l'API). Bonus fonctionnel :
sélection de la taille de page (5/10/20), absente de l'ancien pager.
`.pager`/`go()` supprimés (code mort).

**Fichiers effectivement modifiés.** `tracks-page.ts`, `tracks-page.html`,
`styles.css` ; `compte-rendu/TP2.md` (case AVANCÉ cochée, section
implémentation) ; `RAPPORT_IA_MODELE.md` (cette entrée).

**Preuve de fonctionnement.** `npm run build` réussi.

**Ce que je sais expliquer sans l'agent.** Pourquoi `mat-paginator` est
un composant sans état propre (il faut toujours recharger les données
soi-même au changement de page) ; pourquoi reconvertir l'index 0-based
de Material vers le `page` 1-based de l'API évite une confusion
silencieuse (décalage d'une page).

---

### Entrée 2.13 — Amélioration facultative : suppression avec confirmation + rafraîchissement

**Objectif.** Permettre de supprimer une piste (`DELETE /api/tracks/:id`,
déjà fonctionnel côté backend), avec confirmation avant d'agir.

**Prompt principal (recopié tel quel) :**
> Maintenant j'aimerais implémenter quelques améliorations facultatives,
> à commencer par la supression avec confirmation
>
> C'est good implémente

**Plan validé puis implémenté.** `TrackService.delete(id)`. Confirmation
via `MatDialog` (plutôt qu'un `window.confirm()` basique) — cohérent
avec le reste de la page en Material, implémentée avec un simple
`<ng-template>` dans `tracks-page.html`, sans composant séparé. Point
facultatif suivant du sujet ("rafraîchissement après suppression")
regroupé dans la foulée, car c'est littéralement la même action
(`204` reçu → nettoyage + rechargement) : nettoyage du lecteur si la
piste supprimée était en cours de lecture, recul d'une page si c'était
la dernière piste d'une page non-1, `load()` dans tous les cas.

**Fichiers effectivement modifiés.** `track.service.ts`, `tracks-page.ts`,
`tracks-page.html`, `styles.css` ; `compte-rendu/TP2.md` (2 cases
cochées, section implémentation complète) ; `RAPPORT_IA_MODELE.md`
(cette entrée).

**Preuve de fonctionnement.** `npm run build` réussi. Tests manuels
confirmés par l'utilisateur : suppression normale, et suppression de la
dernière piste d'une page non-1 (recul de page vérifié).

**Ce que je sais expliquer sans l'agent.** Pourquoi regrouper deux points
facultatifs du sujet en une seule implémentation a du sens quand ils
décrivent en réalité la même action vue sous deux angles ; pourquoi
nettoyer l'état du lecteur après suppression évite de laisser l'UI dans
un état incohérent (un lecteur "actif" pointant vers un fichier qui
n'existe plus côté serveur).

---

### Entrée 2.14 — Ajustement UX : lecteur audio déplacé dans la card de la piste

**Objectif.** Déplacer le lecteur `<audio>`, affiché jusqu'ici dans un
bloc unique sous la liste des pistes, directement dans la card de la
piste en cours de lecture.

**Prompt principal (recopié tel quel) :**
> J'ai fait les tests tout est bon. Par contre je me rends compte que ça
> serait mieux de mettre le la barre de lecture du son directement dans
> la card correspondante plutôt que en bas

**Implémentation.** `@if (track.id === playingTrack()?.id && audioUrl())`
ajouté dans chaque card, sous `.track-content` ; bloc "Lecture : titre" +
lecteur global en bas de liste supprimé (redondant avec le badge
"▶ En cours de lecture" déjà présent dans la card concernée).

**Fichiers effectivement modifiés.** `tracks-page.html`, `styles.css` ;
`compte-rendu/TP2.md`/`RAPPORT_IA_MODELE.md` (documentés dans l'entrée
2.11, cette fonctionnalité en faisant partie intégrante du travail sur
les cards).

**Preuve de fonctionnement.** `npm run build` réussi. Confirmé par
l'utilisateur après test manuel ("oui c'est bon").

**Ce que je sais expliquer sans l'agent.** Pourquoi `playingTrack` et
`audioUrl` (deux Signals globaux au composant, pas par piste) suffisent
pour afficher le lecteur au bon endroit malgré une liste de plusieurs
pistes : un seul `@if` par piste compare son id à `playingTrack()?.id`,
donc un seul lecteur s'affiche jamais à la fois, peu importe le nombre
de cards dans la liste.

---

### Entrée 2.15 — Amélioration facultative : filtre par titre (premier changement backend)

**Objectif.** Filtrer la liste des pistes par titre, "de manière assez
basique juste avec la requête backend" (demande explicite de
l'utilisateur).

**Prompts principaux (recopiés tels quels) :**
> je veux bien qu'on fasse le filtre par titre, de manière assez basique
> juste avec la requête backend
>
> oui implémente

**Plan proposé et validé avant codage.** Signalé explicitement : premier
changement backend de toute la session (TP1 et TP2 étaient restés 100%
frontend). Plan : `GET /api/tracks` accepte `title` optionnel (regex
Mongo insensible à la casse), `API_CONTRACT.md` mis à jour dans la même
modification, frontend avec Signal `titleFilter` + champ de recherche.

**Implémentation backend.** `backend/src/app.js` : paramètre `title`
ajouté au filtre Mongoose existant (`ownerId`). Fonction `escapeRegExp()`
ajoutée pour échapper l'entrée utilisateur avant injection dans la
regex — sans ça, un titre comme `.*` matcherait tout, ou un pattern
pathologique pourrait ralentir le serveur (ReDoS). `npm test` (backend) :
2/2 toujours au vert. Vérifié que `app.js` se charge sans erreur
(`node -e "require('./src/app.js')"`) avant de lancer les tests.

**Implémentation frontend.** `TrackService.list(page, limit, title)` ;
Signal `titleFilter`, méthode `applyFilter()` (remet `page` à 1).

**Bug utilisateur signalé, diagnostiqué et corrigé (pas un problème
backend) :**
> ça ne marche pas, j'ai l'impression que la requête passe sans prendre
> en compte el filtre

Diagnostic demandé d'abord : redémarrage du backend oublié (hypothèse
raisonnable vu que c'était le premier changement backend jamais fait
dans cette session) — écartée après vérification des logs serveur et de
l'onglet Network (capture fournie : `GET /api/tracks?page=1&limit=5`,
**sans** `title` du tout). Cause réelle : `<form (ngSubmit)="applyFilter()">`
sur un composant qui n'importe que `ReactiveFormsModule` (pas
`FormsModule`, pas de `[formGroup]`) — ni `NgForm` ni
`FormGroupDirective` ne s'attachent à ce `<form>`, donc `(ngSubmit)` ne
se liait à rien côté Angular ; le clic déclenchait la soumission
**native** du navigateur, qui rechargeait toute l'app (perdant le champ
de recherche), d'où la requête sans filtre observée — en réalité un
tout nouveau chargement initial, pas un vrai appel à `applyFilter()`.
Corrigé en supprimant le `<form>` : `(keyup.enter)` sur l'input et
`(click)` sur le bouton appellent directement `applyFilter()`, sans
aucune soumission de formulaire.

**Fichiers effectivement modifiés.** `backend/src/app.js`,
`API_CONTRACT.md` ; `track.service.ts`, `tracks-page.ts`,
`tracks-page.html`, `styles.css` ; `backend/analyse.md` (description de
la route + table des routes) ; `compte-rendu/TP2.md` (case cochée,
section complète) ; `RAPPORT_IA_MODELE.md` (cette entrée).

**Preuve de fonctionnement.** `npm run build` (frontend) et `npm test`
(backend) réussis. Captures fournies par l'utilisateur (logs backend,
Network) ayant servi au diagnostic du bug `ngSubmit`. Fonctionnement
confirmé par l'utilisateur après correction.

**Ce que je sais expliquer sans l'agent.** Pourquoi `ngSubmit` ne
fonctionne que si `NgForm` (`FormsModule`) ou `FormGroupDirective`
(`[formGroup]`, `ReactiveFormsModule`) sont présents sur le `<form>`, et
pourquoi l'absence silencieuse de liaison peut ressembler à "ça ne fait
rien" plutôt qu'à une erreur visible ; pourquoi échapper une entrée
utilisateur avant de l'injecter dans une regex est nécessaire des deux
côtés (sécurité serveur), pas juste une bonne pratique côté validation
frontend ; pourquoi vérifier l'URL exacte de la requête réseau (pas
seulement son statut) est la première chose à faire quand "ça ne marche
pas" — ça distingue immédiatement un problème serveur (requête correcte,
mauvaise réponse) d'un problème client (requête elle-même incorrecte ou
absente).

---

### Entrée 2.16 — Mise en place d'un harnais de test automatisé, et correctif trouvé grâce à lui

**Objectif.** Répondre à une question méthodologique de l'utilisateur sur
les limites de test de l'assistant, puis mettre en place les capacités
manquantes sur demande.

**Prompts principaux (recopiés tels quels) :**
> il te faudrait quoi pour lancer l'appli et la tester toi même ?
>
> met en place tout

**Diagnostic initial (question précédente).** Expliqué la distinction
entre ce qui était déjà possible sans rien installer (`npm run build`,
`npm test` backend, scripts Node ponctuels, lecture statique du code) et
ce qui manquait pour un vrai pilotage navigateur (Playwright/Chromium,
jamais installés jusqu'ici) — avec le compromis explicite : pollution du
dépôt projet (`package.json`) si installé au mauvais endroit.

**Mise en place.**
1. **`curl`** : déjà disponible, aucune installation. Compte de test
   jetable créé via `POST /api/auth/register`
   (`claude-test-bot@example.com`) pour obtenir un token JWT réutilisable
   sans dépendre des identifiants réels de l'utilisateur.
2. **Playwright + Chromium headless** : installés **exclusivement dans
   le répertoire scratchpad de la session**, jamais dans
   `frontend-starter/` ni `backend/` — décision volontaire pour ne rien
   ajouter au dépôt que l'utilisateur doit rendre. Vérifié que les deux
   serveurs (backend `:3000`, frontend `:4200`) tournaient déjà avant de
   construire le harnais dessus, plutôt que d'en relancer de nouveaux
   (risque de conflit de port).
3. Script de fumée (`smoke-test.js`) écrit et exécuté pour valider le
   harnais de bout en bout : login automatique, navigation vers
   `/tracks`, capture d'écran.

**Découverte immédiate grâce à ce premier test.** La capture du smoke
test montrait `mat-paginator` avec ses textes par défaut en anglais
("Items per page:", "0 of 0"), alors que toute l'application est en
français — un bug trouvé par l'assistant lui-même au tout premier essai
du nouvel outil, pas signalé par l'utilisateur.

**Correction, demandée ensuite ("corrige").** `MatPaginatorIntl`
(mécanisme d'i18n fourni par Angular Material) étendu dans une nouvelle
classe `FrenchPaginatorIntl`, fournie globalement dans `main.ts` (utile
pour tout usage futur de `mat-paginator` ailleurs dans l'app, pas
seulement sur `/tracks`). `npm run build` : succès. **Re-vérifié par
l'assistant lui-même** en relançant le smoke test Playwright après le
correctif — capture confirmant "Pistes par page :" et "0 sur 0" en
français, sans qu'aucun test manuel de l'utilisateur n'ait été
nécessaire pour cette vérification précise.

**Fichiers effectivement modifiés.** `main.ts`,
`shared/i18n/french-paginator-intl.ts` (nouveau) ; `compte-rendu/TP2.md`
(section correctif + section harnais de test, capture) ;
`RAPPORT_IA_MODELE.md` (cette entrée). Rien dans
`frontend-starter/package.json`/`backend/package.json` — le harnais de
test lui-même vit entièrement hors du dépôt.

**Preuve de fonctionnement.** `npm run build` réussi. Deux captures
Playwright (avant/après correctif), prises et vérifiées par l'assistant
sans intervention de l'utilisateur pour cette étape précise — première
fois dans la session qu'une fonctionnalité est validée visuellement sans
capture fournie par l'utilisateur.

**Ce que je sais expliquer sans l'agent.** Pourquoi installer un outil de
test dans le répertoire du projet lui-même (plutôt que dans un espace
séparé) aurait pollué ce qui doit être rendu pour la notation ; pourquoi
`mat-paginator`, comme beaucoup de composants Angular Material, n'a pas
de traduction française par défaut et nécessite un provider `*Intl`
dédié ; la différence entre une vérification que l'assistant peut faire
seul (rendu HTML/CSS statique, capture d'écran) et une vérification qui
reste du ressort de l'utilisateur (ressenti UX, préférence visuelle).

---

_Points suivants du TP2 à compléter au fur et à mesure._
