# Compte-rendu — TP2 : Bibliothèque Upload et Lecture Audio

> Sujet : `../SUJET_ETUDIANT_TP2.md`. Voir aussi `../backend/analyse.md`,
> `../frontend-starter/analyse.md` et `../RAPPORT_IA_MODELE.md`.

## Prérequis vérifiés

- [x] TP1 fonctionnel (connexion, profil) — 10/10 points de la Mission 1, cf. `TP1.md`
- [x] Backend lancé
- [x] `proxy.conf.json` pointe vers le bon port

## Mission 2 — Bibliothèque paginée

- [x] `TrackService.list(page, limit)` transmet réellement `page`/`limit`
- [x] Signals : `tracks`, `page`, `pages`, `loading`, erreur
- [x] Affichage `@for` / `@empty` / `@if`
- [x] Boutons Précédent/Suivant désactivés aux bornes
- [x] Une requête HTTP par changement de page (pas de découpage local)

### Bilan : ce qui était déjà là vs ce qui a été ajouté

Le sujet précise "implémenter **ou vérifier**" — l'essentiel de cette
mission était déjà fait dans le starter :

| Exigence | État |
|---|---|
| `TrackService.list(page, limit)` → `GET /api/tracks?page=&limit=` | ✅ déjà présent (`track.service.ts`, `params: { page, limit }`) |
| Signal `tracks` | ✅ déjà présent (`tracks-page.ts`) |
| Signal `page` | ✅ déjà présent |
| Signal `pages` | ✅ déjà présent |
| Signal `loading` | ✅ déjà présent |
| Signal erreur | ❌ **absent** → **ajouté** cette mission |
| `@for`/`@empty`/`@if` | ✅ déjà présent (`tracks-page.html`) |
| Boutons Préc./Suiv. désactivés aux bornes | ✅ déjà présent (`[disabled]="page() === 1"` / `pages()`) |
| Une requête HTTP par changement de page | ✅ déjà présent (`go()` → `load()`, pas de découpage local) |

**Seul ajout réel : le Signal `error`.** Avant, un échec de
`GET /api/tracks` (backend indisponible, etc.) ne faisait que passer un
`console.error(...)` — rien de visible pour l'utilisateur, la liste
restait affichée telle quelle (potentiellement obsolète) sans aucune
explication.

**Fichiers modifiés :**

| Fichier | Changement |
|---|---|
| `tracks-page.ts` | Ajout `readonly error = signal('')` ; remis à vide en début de `load()` ; rempli avec `error.error?.message` (ou message par défaut) dans le callback `error` |
| `tracks-page.html` | `@if (error()) { <p class="error">{{ error() }}</p> }` ajouté dans la card "Mes pistes", juste sous le bouton "Actualiser" — même emplacement que "Chargement…", même classe `.error` que sur `/login`/`/register` en TP1 |

```ts
load(): void {
  this.loading.set(true);
  this.error.set('');
  this.service.list(this.page()).subscribe({
    next: (response) => { ...; this.loading.set(false); },
    error: (error: { error?: { message?: string } }) => {
      console.error('[TracksPage] Chargement impossible', error);
      this.loading.set(false);
      this.error.set(error.error?.message ?? 'Chargement des pistes impossible');
    },
  });
}
```

`npm run build` : succès.

**Test manuel (preuve en capture).** Backend coupé volontairement, puis
clic sur "Actualiser" : le message "Chargement des pistes impossible"
s'affiche bien au bon endroit. Comportement noté au passage, cohérent avec
le code (`tracks.set(...)` n'est appelé que dans le callback `next`) : la
liste précédemment chargée **reste affichée** sous le message d'erreur,
plutôt que de disparaître — l'utilisateur garde accès à ses dernières
données connues plutôt que de se retrouver devant une liste vide.

![Backend coupé : message d'erreur affiché sous "Actualiser", ancienne liste de pistes toujours visible en dessous](captures/tp2-mission2-erreur-liste-backend-down.png)

### Preuve Network — une requête HTTP par changement de page

Avec les 5 pistes de test, `limit=5` (valeur par défaut) ne produit qu'une
seule page — impossible de voir les boutons Préc./Suiv. réagir dans ce cas
(ils sont désactivés aux deux bornes en même temps, ce qui est le
comportement attendu, pas un bug). Pour vérifier concrètement le point
"une requête HTTP par changement de page", la limite a été passée
temporairement à `2` dans `tracks-page.ts` (`this.service.list(this.page(), 2)`),
le temps du test, puis remise à sa valeur par défaut (`5`) juste après —
aucune trace de ce changement ne reste dans le code final.

![Onglet Network : 4 requêtes distinctes tracks?page=1/2/2/3&limit=2, une par clic Préc./Suiv., dont un retour en arrière](captures/tp2-mission2-network-pagination.png)

Confirmé : chaque navigation entre pages déclenche une nouvelle requête
`GET /api/tracks?page=...&limit=...` avec le bon numéro de page — aucun
découpage local d'une liste déjà téléchargée.

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
