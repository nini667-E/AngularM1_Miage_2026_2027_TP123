# REPORT — Card Vault (mini projet TP4 à TP6)

> Rapport demandé par le sujet ([SUJET_ETUDIANT_TP456.md](SUJET_ETUDIANT_TP456.md)) :
> travail effectué, choix techniques, fonctionnalités implémentées et
> résultats des tests. Mis à jour à la fin de chaque étape.
>
> Journal détaillé étape par étape : [compte-rendu/V2.md](compte-rendu/V2.md).
> Échanges avec l'assistant IA : [RAPPORT_IA_MODELE.md](RAPPORT_IA_MODELE.md), section V2.

**État au 01/11/2026** : conception terminée (points 1 à 4 du sujet) ;
étapes 0 (préparation) et 1 (nettoyage, identité, navigation) terminées.
Prochaine étape : 2 (albums).

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
| Albums | créer, modifier, supprimer ; thème = **type** et/ou **série** (avec **extension** facultative) | — |
| Visibilité | **public** : visible par tous, trouvable par la recherche, affiché dans les récents ; **privé** : visible par moi et par les amis avec qui je le partage ; privé non partagé = brouillon | fichiers publics / privés |
| Partage | partager un album privé avec des amis choisis un par un ; **arrêter un partage** à tout moment ; retirer un ami arrête ses partages | partage avec des amis, stopper un partage |
| Cartes | photo de la carte + **carte choisie dans le catalogue TCGdex** ; badge catégorie (Pokémon / Dresseur / Énergie et sous-catégorie) ; filtre par catégorie dans l'album | upload de fichiers |
| Cohérence du thème | un **Pokémon** ou une **Énergie typée** doit avoir le type de l'album ; **Dresseurs** et **Énergies sans type** toujours acceptés ; série et extension s'appliquent à toutes les cartes | — |
| Amis | inviter, accepter, refuser, retirer | réseau social |
| Activité | fil d'activité des amis (albums créés, cartes ajoutées, commentaires), limité à ce que je peux voir | voir l'activité des amis |
| Réactions | likes et commentaires **réservés aux amis** (et au propriétaire) ; suppression de mes réactions et de celles reçues sur mes albums | — |
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
| Affichage des images | **URL signées temporaires** (HMAC, 1 h) | `<img>` n'envoie pas le JWT ; cache et chargement différé |
| Traitement des images | **`sharp`** : vérification que c'est une image, miniature, redressement, suppression des métadonnées EXIF (GPS) | performance et vie privée |
| V1 | audio supprimé ; authentification, upload avec progression, pagination, SnackBar réutilisés | V1 conservée via le tag `v1.0` |

## 5. Découpage du travail (point 4 du sujet)

| Étape | Contenu | État |
|---|---|---|
| 0 | Préparation : branche `V2`, règles, documents, base `card-vault` | ✅ 01/11/2026 |
| 1 | Nettoyage de l'audio, identité Card Vault, thème sombre, navigation | ✅ 01/11/2026 |
| 2 | Albums : CRUD, visibilité, thème | à faire |
| 3 | Cartes et classeur : catalogue, cohérence, photos, URL signées | à faire |
| 4 | Amis | à faire |
| 5 | Partage et arrêt du partage | à faire |
| 6 | Likes et commentaires | à faire |
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
