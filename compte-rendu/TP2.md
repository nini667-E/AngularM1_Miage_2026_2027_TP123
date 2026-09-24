# Compte-rendu — TP2 : Bibliothèque Upload et Lecture Audio

> Sujet : `../SUJET_ETUDIANT_TP2.md`. Voir aussi `../backend/analyse.md`,
> `../frontend-starter/analyse.md` et `../RAPPORT_IA_MODELE.md`.

## Prérequis vérifiés

- [ ] TP1 fonctionnel (connexion, profil)
- [ ] Backend lancé
- [ ] `proxy.conf.json` pointe vers le bon port

## Mission 2 — Bibliothèque paginée

_À compléter :_

- [ ] `TrackService.list(page, limit)` transmet réellement `page`/`limit`
- [ ] Signals : `tracks`, `page`, `pages`, `loading`, erreur
- [ ] Affichage `@for` / `@empty` / `@if`
- [ ] Boutons Précédent/Suivant désactivés aux bornes
- [ ] Une requête HTTP par changement de page (pas de découpage local)

### AVANCÉ (facultatif)

- [ ] Angular Material Paginator
- [ ] Pagination Mongoose (`aggregate-paginate-v2`) — **implique de modifier
      le backend et `API_CONTRACT.md`**

## Mission 3 — Upload et lecture audio

_Identifier d'abord dans le code (fichiers + méthodes) :_

- Choix du fichier : …
- Construction du `FormData` : …
- Appel HTTP d'upload : …
- Récupération du `Blob` : …
- Création de l'`ObjectURL` : …
- Affectation au lecteur `<audio>` : …
- Révocation de l'ancienne URL : …

### Flux expliqué avec mes mots

- Upload : composant → service → `HttpClient` → API : …
- Lecture : API → `Blob` → `ObjectURL` → lecteur audio : …
- Intercepteur JWT sur la requête audio : …
- Pourquoi une URL directe dans `src` ne reçoit pas le header `Authorization` : …

### Checklist d'implémentation

- [ ] Validation frontend du fichier (type/taille) avant l'appel HTTP
- [ ] Message d'erreur clair si fichier invalide
- [ ] Pourquoi la validation frontend ne remplace pas la validation backend : …
- [ ] État de chargement pendant l'envoi
- [ ] Bouton désactivé, anti double-soumission
- [ ] Affichage des erreurs serveur
- [ ] Message de succès
- [ ] Formulaire vidé + rechargement page 1 après succès
- [ ] Cards responsives et accessibles (titre, nom original, format, taille, date, action de lecture)
- [ ] Affichage du morceau en cours de lecture
- [ ] Erreur audio compréhensible
- [ ] Révocation de l'`ObjectURL` à la destruction du composant

### Questions — mémoire, buffering, streaming

- Le backend envoie-t-il le fichier entier en mémoire ou progressivement depuis le disque ? …
- Avec `responseType: "blob"`, à quel moment le composant reçoit-il le fichier ? …
- 100 morceaux dans la liste : les 100 fichiers sont-ils chargés en mémoire à l'affichage ? Justifier avec le code. …
- Différence avec 100 `<audio>` utilisant une URL HTTP directe ? …
- Pourquoi révoquer l'URL créée par `URL.createObjectURL` ? …

## Améliorations facultatives

- [ ] Barre de progression de l'upload
- [ ] Suppression avec confirmation
- [ ] Rafraîchissement après suppression
- [ ] Formatage lisible taille/date
- [ ] Filtre par titre
- [ ] AVANCÉ — image de couverture (upload ou recherche via tags ID3 / web service)

## Checkpoint — Onglet Network

- [ ] Changement de page modifie bien le paramètre `page`
- [ ] Upload multipart avec `audio` et `title`
- [ ] Réponse de lecture = flux audio
- [ ] Erreur `400` affichée pour fichier invalide
- [ ] Une piste n'est lisible que par son propriétaire

## Livrables TP2

- [ ] Code frontend complété
- [ ] Cards de bibliothèque lisibles
- [ ] Capture Network pagination ou upload : `![...](captures/tp2-....png)`
- [ ] Capture/démo lecture audio authentifiée
- [ ] Explication écrite du choix `Blob`/`ObjectURL`
- [ ] Réponses aux questions mémoire/buffering/streaming
