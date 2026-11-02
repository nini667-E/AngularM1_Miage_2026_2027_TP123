# REPORT — Card Vault (mini projet TP4 à TP6)

> Rapport demandé par le sujet ([SUJET_ETUDIANT_TP456.md](SUJET_ETUDIANT_TP456.md)) :
> travail effectué, choix techniques, fonctionnalités implémentées et
> résultats des tests. Mis à jour à la fin de chaque étape.
>
> Journal détaillé étape par étape : [compte-rendu/V2.md](compte-rendu/V2.md).
> Échanges avec l'assistant IA : [RAPPORT_IA_MODELE.md](RAPPORT_IA_MODELE.md), section V2.

**État au 02/11/2026** : conception terminée (points 1 à 4 du sujet) ;
étapes 0 (préparation), 1 (nettoyage, identité, navigation), 2 (albums),
3 (cartes et classeur), 4 (amis), 5 (partage) et 6 (likes et
commentaires) terminées. Prochaine étape : 7 (découverte : récents,
activité, recherche).

**Fonctionnalités disponibles** : inscription, connexion, profil ;
navigation ; **albums** (créer, modifier, supprimer ; thème facultatif
type / série / extension choisi dans le catalogue TCGdex et vérifié par le
serveur ; visibilité publique ou privée ; page « Mes albums ») ;
**cartes** (recherche dans le catalogue TCGdex, verdict de cohérence avec
le thème, ajout avec la photo de sa carte, classeur 3×3 paginé et
filtrable par catégorie, zoom photo / image officielle, retrait) ;
**amis** (recherche de collectionneurs par pseudo, invitation, acceptation,
refus, annulation, retrait, badge d'invitations reçues, bouton « Inviter »
sur l'album d'un autre) ; **partage** (un album privé est partagé avec des
amis cochés dans une fenêtre, décocher arrête le partage, retirer un ami
arrête ses partages ; onglet « Partagés avec moi ») ; **likes et
commentaires** (cœur et commentaires pour les amis, **réponses du
propriétaire** sous leurs commentaires, lecture seule pour les autres
visiteurs, suppression de ses réactions et, pour le propriétaire, de
celles reçues).

## 1. Le projet

**Card Vault** est un réseau social de collectionneurs de cartes Pokémon.
Chaque utilisateur range les **photos de ses cartes** dans des **albums**
présentés comme un **classeur**, choisit qui peut les voir, et échange avec
ses **amis** (likes, commentaires, activité).

Le projet part du prototype des TP1 à TP3 (version V1, tag `v1.0`), dont
il réutilise l'authentification, l'upload avec progression, la pagination
et les composants d'interface. La partie audio de la V1 est retirée.

## 2. Fonctionnalités retenues (point 1 du sujet)

| Domaine | Fonctionnalités | Exigence du sujet couverte |
|---|---|---|
| Albums | créer, modifier, supprimer ; thème **facultatif** = **type** et/ou **série** (avec **extension** facultative) ; sans thème : collection libre | — |
| Visibilité | **public** : visible par tous, trouvable par la recherche, affiché dans les récents ; **privé** : visible par moi et par les amis avec qui je le partage ; privé non partagé = brouillon | fichiers publics / privés |
| Partage | partager un album privé avec des amis choisis un par un ; **arrêter un partage** à tout moment ; retirer un ami arrête ses partages ; albums reçus dans l'onglet « Partagés avec moi » ; liste conservée (inactive) si l'album passe public ; seul le propriétaire arrête un partage | partage avec des amis, stopper un partage |
| Cartes | photo de la carte + **carte choisie dans le catalogue TCGdex** ; badge catégorie (Pokémon / Dresseur / Énergie et sous-catégorie) ; filtre par catégorie dans l'album | upload de fichiers |
| Cohérence du thème | un **Pokémon** ou une **Énergie typée** doit avoir le type de l'album ; **Dresseurs** et **Énergies sans type** toujours acceptés ; série et extension s'appliquent à toutes les cartes | — |
| Amis | rechercher par pseudo, inviter, accepter, refuser (sans prévenir l'expéditeur), annuler, retirer ; invitations croisées acceptées automatiquement ; badge d'invitations reçues | réseau social : inviter / ajouter / supprimer des amis |
| Activité | fil d'activité des amis (albums créés, cartes ajoutées, commentaires), limité à ce que je peux voir | voir l'activité des amis |
| Réactions | likes et commentaires **réservés aux amis** ; le propriétaire n'aime ni ne commente son album, il **répond** aux commentaires (un niveau) ; lecture seule pour les autres visiteurs ; suppression de mes réactions et de celles reçues sur mes albums ; réactions d'un ex-ami conservées | — |
| Découverte | **récemment ajoutés** (albums publics) ; **recherche** (titre, propriétaire, type, série, extension) parmi ce que je peux voir | récents, search files |
| Profil | pseudo, avatar, bio ; albums visibles | — |

**Ce qui n'est pas vérifié, et pourquoi.** Vérifier automatiquement qu'une
photo montre bien une carte Pokémon demanderait un modèle de vision
artificielle (à entraîner, ou une API payante non déterministe) : hors
périmètre. L'application garantit à la place que le fichier est
**réellement une image**, et que la **carte déclarée**, choisie dans un
catalogue officiel, respecte le thème de l'album.

## 3. Interfaces (point 2 du sujet)

Interface en **Angular Material** au maximum, thème **sombre or / bleu
nuit** (reflet or métallique, une couleur par type). Le thème « holo »
violet / cyan choisi d'abord a été abandonné le 01/11/2026 après essai :
jugé trop « généré par IA », trop générique.

| Écran | Contenu |
|---|---|
| Barre du haut | Accueil · Recherche · Amis (badge d'invitations) · menu profil |
| Accueil | albums récemment ajoutés + activité des amis |
| Profil | avatar, bio, bouton d'ami, albums visibles |
| Album | **classeur 3×3** paginé, filtre par catégorie, likes, commentaires, actions du propriétaire |
| Ajout de carte | `MatStepper` : 1) recherche de la carte (`MatAutocomplete`, vignettes officielles, contrôle du thème) ; 2) photo, avec barre de progression |
| Partage | fenêtre où l'on coche des amis (décocher = arrêter le partage) |
| Amis | onglets amis / invitations reçues / envoyées + recherche d'utilisateurs |
| Recherche | barre + filtres type / série / extension, résultats paginés |

Mise en valeur des images : cadre au format d'une carte (63 × 88), coins
arrondis, reflet au survol, zoom en fenêtre, squelettes de
chargement, emplacements vides façon pochettes de classeur.

## 4. Choix techniques (point 3 du sujet)

| Sujet | Choix | Raison |
|---|---|---|
| Stack | Angular 22 + Material 22 ; Node/Express 5 + Mongoose/MongoDB Atlas (base `card-vault`) | continuité avec la V1 |
| Modèles | `User` (+ bio, avatar), `Album` (visibilité, thème, `sharedWith`), `Card`, `Friendship`, `Like`, `Comment`, `Activity` | — |
| Règles d'accès | deux fonctions centrales testées : `canView(album, user)` et `canReact(album, user)` | une seule règle, pas d'oubli |
| Catalogue | API publique **TCGdex** (gratuite, sans clé, en français), **appelée par le backend** | le contrôle du thème doit être fait par le serveur (un client peut mentir) ; cache |
| Type des Énergies | `types` de TCGdex s'il existe, sinon déduit du nom (variantes *Electrik*, *Lightning*…), sinon « sans type » | données TCGdex incomplètes pour les Énergies |
| Série exclue | *Pokémon Pocket* (cartes numériques, impossibles à photographier) | — |
| Amis (02/11/2026) | modèle `Friendship` : **un lien par paire** d'utilisateurs (clé unique formée des deux identifiants triés), `pending` puis `accepted`, supprimé au refus ou au retrait | pas de doublon, même si deux invitations partent au même instant ; une seule requête filtrée par action, sur la paire du token |
| Partage (02/11/2026) | liste `sharedWith` dans l'album, **remplacée en entier** par le propriétaire (liste vide = plus de partage) ; `canView` l'inclut ; retirer un ami fait un `$pull` dans les deux sens | une seule règle d'accès pour l'album, ses cartes et ses photos ; l'amitié n'a pas à être revérifiée à chaque lecture |
| Réactions (02/11/2026) | `Like` unique par personne et par album (index unique + `upsert`), `Comment` de 500 caractères, compteurs sur l'album ; `404` si l'album n'est pas visible, `403` s'il l'est mais que la réaction est interdite | pas de like en double ; le refus d'une action ne révèle rien de plus que ce que l'utilisateur voit déjà |
| Affichage des images | **URL signées temporaires** (HMAC-SHA256, échéance arrondie à l'heure : 1 à 2 h) | `<img>` n'envoie pas le JWT ; même URL pendant l'heure, donc cache du navigateur et chargement différé |
| Traitement des images | **`sharp`** : vérification que c'est une image, miniature, redressement, suppression des métadonnées EXIF (GPS) | performance et vie privée |
| Recadrage (01/11/2026) | **`ngx-image-cropper`** côté Angular (cadre au format carte 63:88, rotation par quarts de tour) ; seules les **coordonnées** sont envoyées, `sharp` découpe l'original côté serveur | pochettes remplies par la carte seule, sans perte de qualité |
| V1 | audio supprimé ; authentification, upload avec progression, pagination, SnackBar réutilisés | V1 conservée via le tag `v1.0` |

### 4.1 Utilisation de l'API TCGdex (étape 3)

TCGdex est une base publique de toutes les cartes Pokémon (gratuite, sans
clé, en français). Elle est interrogée **uniquement par le backend** ;
seules ses images officielles, publiques, sont chargées directement par le
navigateur. Données et images : propriété de Pokémon / Nintendo, utilisées
ici dans un cadre non commercial, avec la mention « Données : TCGdex ».

| Besoin | Requête TCGdex | Mémoire serveur |
|---|---|---|
| Listes du thème d'un album | `/types`, `/series`, `/series/:id` | 24 h |
| Recherche de carte | `/cards?name=…&pagination:itemsPerPage=20` (+ `set.id=` si l'album a une extension) | 24 h par recherche |
| Nom des extensions dans les résultats | `/sets` (202 extensions, un seul appel) | 24 h |
| Détail d'une carte (catégorie, types) | `/cards/:id` | 24 h |
| Série d'une carte (absente du détail) | `/sets/:id` | 24 h |

**Limites de l'API gérées par le serveur.** La recherche ne renvoie ni le
type ni l'extension (complétés par le serveur), ne sait pas filtrer par
série (le serveur marque les cartes compatibles et les place en tête) et
inclut les cartes Pocket (retirées). Le type des Énergies manque souvent :
il est déduit du nom (mots français et anglais, établis sur les 130 noms
d'Énergies réels). Certaines cartes n'ont pas d'image officielle
(vignette de remplacement). TCGdex injoignable : `502`, message clair.

**Pourquoi par le backend.** 1) La cohérence avec le thème doit être
décidée par le serveur : il récupère lui-même la carte à partir de son
identifiant, un client modifié ne peut donc pas mentir sur son type. 2) La
mémoire : une carte n'est demandée qu'une fois. 3) Le serveur assemble une
réponse prête à afficher. 4) Une seule adresse (`/api`) pour Angular.

## 5. Découpage du travail (point 4 du sujet)

| Étape | Contenu | État |
|---|---|---|
| 0 | Préparation : branche `V2`, règles, documents, base `card-vault` | ✅ 01/11/2026 |
| 1 | Nettoyage de l'audio, identité Card Vault, thème sombre, navigation | ✅ 01/11/2026 |
| 2 | Albums : CRUD, visibilité, thème | ✅ 01/11/2026 |
| 3 | Cartes et classeur : catalogue, cohérence, photos, URL signées | ✅ 01/11/2026 |
| 4 | Amis | ✅ 02/11/2026 |
| 5 | Partage et arrêt du partage | ✅ 02/11/2026 |
| 6 | Likes et commentaires | ✅ 02/11/2026 |
| 7 | Découverte : récents, activité, recherche | à faire |
| 8 | Profil, finitions, check-up, tag `v2.0` | à faire |

Chaque étape comprend : backend (+ `API_CONTRACT.md`), tests backend,
frontend, tests frontend, build, vérification dans le navigateur,
documentation.

## 6. Résultats des tests

Détail (tableaux attendu / observé) : [Tests.md](Tests.md), section V2.

| Étape | Backend | Frontend | Build | Navigateur |
|---|---|---|---|---|
| 1 (01/11/2026) | 6/6 | 23/23 (7 fichiers) | ✅ | ✅ 11 vérifications |
| 2 (01/11/2026) | 29/29 (5 fichiers) | 56/56 (14 fichiers) | ✅ | ✅ 12 vérifications, vrai TCGdex, 2 comptes |
| 3 (01/11/2026) | 66/66 (7 fichiers) | 78/78 (17 fichiers) | ✅ | ✅ 15 vérifications, vrai TCGdex, vraies photos de test (GPS, orientation), 2 comptes |
| 3, recadrage (01/11/2026) | 74/74 (7 fichiers) | 84/84 (17 fichiers) | ✅ | ✅ photo couchée et décentrée : rotation, cadre ajusté, carte rangée droite au format carte |
| 4 (02/11/2026) | 91/91 (8 fichiers) | 110/110 (20 fichiers) | ✅ | ✅ 27 vérifications, vraie base, 3 comptes |
| 5 (02/11/2026) | 102/102 (9 fichiers) | 125/125 (21 fichiers) | ✅ | ✅ 28 vérifications, vraies photos, 3 comptes |
| 6 (02/11/2026) | 116/116 (10 fichiers) | 146/146 (24 fichiers) | ✅ | ✅ 28 vérifications, 3 comptes |
| 6, réponses du propriétaire (02/11/2026) | 118/118 | 153/153 | ✅ | ✅ 14 vérifications |

**Méthode.** Les tests frontend simulent le backend
(`provideHttpClientTesting()`) ; les tests backend n'utilisent pas MongoDB
(requêtes rejetées avant la base, ou méthodes de modèle simulées). Chaque
étape est complétée par une **vérification croisée** : des bugs sont
introduits volontairement pour s'assurer que les tests échouent.

**Enseignement de l'étape 1.** La vérification croisée a révélé qu'une
assertion `toContain` sur une valeur `undefined` réussit dans la version de
Vitest du projet : un test « la page est protégée » ne pouvait donc pas
détecter une page non protégée. Les assertions concernées ont été
corrigées (comparaison exacte), et la règle est appliquée à tous les tests
de la V2.

**Enseignement de l'étape 2.** 13 bugs introduits volontairement : 12
détectés d'emblée, le 13e (champ de thème vide envoyé au serveur) a révélé
un cas non testé (album sans thème), ajouté. Et deux défauts ne pouvaient
être vus que dans un vrai navigateur : l'absence de `<base href="/">`
(ouvrir directement l'adresse d'un album donnait une page blanche) et une
fenêtre de formulaire coupée. Les tests unitaires et la vérification
navigateur sont complémentaires.

**Enseignement de l'étape 3.** 22 bugs introduits volontairement, tous
détectés après l'ajout d'un test : traiter la photo **avant** le contrôle du
thème ne changeait pas le résultat final (les fichiers étaient nettoyés), un
test rend désormais l'ordre des contrôles visible. Les photos sont testées
avec de vraies images : redressement et suppression des données GPS sont
vérifiés, pas supposés. Dans le navigateur : focus mal placé à l'ouverture
de la fenêtre d'ajout (la frappe était perdue) et cartes compatibles noyées
en fin de liste, deux défauts d'ergonomie corrigés.

**Enseignement de l'étape 4 (02/11/2026).** 27 bugs introduits
volontairement (13 backend, 14 frontend), tous détectés après l'ajout
d'un test. Le bouton d'amitié affiché sur son propre album n'était vu par
aucun test : le cas existe juste après un F5, avant le rechargement du
profil. Et un défaut n'était visible que sur une capture : le badge
« petit » de Material 3 n'affiche qu'un point, alors que le test, qui lit
le nombre dans la page, passait.

**Enseignement de l'étape 5 (02/11/2026).** 24 bugs introduits
volontairement, tous détectés dès le premier passage : les tests avaient
été écrits en pensant aux deux points de vue (propriétaire et
destinataire) et aux deux sens du retrait d'un ami. Ajouter le partage à
la seule règle `canView` a suffi pour que les cartes et les photos
suivent : c'est l'intérêt d'une règle d'accès centralisée.

**Enseignement de l'étape 6 (02/11/2026).** 28 bugs introduits
volontairement, tous détectés après l'ajout d'un test : on vérifiait que le
propriétaire voit le bouton « retirer ce like », pas qu'un ami ne le voit
pas. Comme à l'étape 4, un défaut n'était visible que sur une capture : le
cœur « Aimé » restait vide, la police d'icônes étant chargée sans son axe
de remplissage. Enfin, un test devenu lent à mesure que la suite grossissait
a été diagnostiqué (dépassement de temps, pas d'erreur) et stabilisé.
