# Compte-rendu — TP3 : Fiabilisation et enrichissement du frontend

> Sujet : `../SUJET_ETUDIANT_TP3.md`. Voir aussi `../backend/analyse.md`,
> `../frontend-starter/analyse.md` et `../RAPPORT_IA_MODELE.md`.

## Prérequis vérifiés

- [x] TP1 et TP2 fonctionnels (connexion, profil, pagination, upload, lecture) — 100% des points obligatoires + plusieurs AVANCÉ/facultatifs, mergés dans `main`

## Mission 5 — Suppression d'une piste

_À compléter :_

- [ ] Action "Supprimer" dans chaque card
- [ ] Confirmation avant suppression
- [ ] État de suppression (anti double-clic)
- [ ] Message de succès/erreur (SnackBar Angular Material)
- [ ] Mise à jour de la liste après suppression
- [ ] Gestion piste déjà supprimée / n'appartenant pas à l'utilisateur

Composant et service concernés : …

Pourquoi le guard Angular et l'interface ne suffisent pas à sécuriser la
suppression (c'est le backend qui vérifie le JWT et le propriétaire) : …

## Mission 6 — Progression de l'upload

_À compléter :_

- [ ] État "pas d'upload en cours"
- [ ] État "upload en cours" avec pourcentage
- [ ] État "réussite"
- [ ] État "échec"
- [ ] Contrôles désactivés pendant l'envoi, pas de double soumission

Pourquoi un upload avec progression ne se traite pas comme une requête HTTP
à réponse finale unique : …

## Mission 7 — Tests automatisés

**Approche choisie** : commencer par cette mission en premier (plutôt que
dans l'ordre du sujet), puisque la plupart des autres missions du TP3
étaient déjà partiellement faites pendant le TP2. Méthodologie complète,
inventaire détaillé et règles de travail dans `../Tests.md` (document de
référence, mis à jour au fil du TP3).

Au moins 3 tests parmi la liste du sujet :

- [x] `AuthService.login()` → `POST /api/auth/login` avec le bon corps
- [x] `TrackService.list()` transmet `page`/`limit`
- [x] L'intercepteur ajoute `Authorization` si un token existe
- [x] Le guard redirige un utilisateur sans token
- [ ] Le composant affiche une erreur après un échec HTTP (test de composant, en attente)
- [ ] La suppression appelle `DELETE /api/tracks/:id` et recharge la liste (avec la Mission 5)
- [ ] L'upload met à jour la progression et traite l'erreur (avec la Mission 6)

**4/7 faits, minimum de 3 déjà dépassé.** Détail des assertions et des
résultats dans `../Tests.md`.

**État des lieux trouvé avant d'écrire le moindre test** (0:00–0:15 du
déroulé conseillé) : `npm test` frontend ne fonctionnait pas du tout —
`jsdom` manquant et `angular.json` sans configuration `build:development`
(dépendance implicite du target `test`). Les deux corrigés avant de
pouvoir écrire quoi que ce soit.

**Bonus** (motivés par des bugs réels trouvés en TP1/TP2, pas demandés
par le sujet) : `serverErrorMessage()`, `formatFileSize()`,
`formatAudioType()` — exportées depuis `tracks-page.ts` et testées
isolément. Détail dans `../Tests.md`.

### Extension backend (facultative)

- [ ] `401` sans JWT
- [ ] `401` avec JWT invalide
- [ ] Upload sans fichier
- [ ] Type MIME refusé
- [ ] Pagination `page`/`limit`
- [ ] Accès interdit à la piste d'un autre utilisateur

Analyse préalable (dans `../Tests.md`) : seul le dernier cas a vraiment
besoin de MongoDB — le middleware `auth` ne vérifie que la signature du
JWT, jamais l'existence de l'utilisateur en base. Pas encore implémenté,
à faire sur demande.

## Vérifications finales

- [x] Tests frontend lancés — 5 fichiers, 15 tests, tous au vert
- [x] Tests backend lancés — 2/2 toujours au vert (non modifiés)
- [x] `npm run build` exécuté sans erreur
- [ ] Aucune donnée sensible journalisée dans la console (à revérifier une fois Missions 5/6 faites)

## Restitution orale — points à savoir expliquer

1. Pourquoi la suppression passe par un service : …
2. Comment le backend protège la suppression : …
3. Comment Angular calcule le pourcentage d'upload : …
4. Pourquoi les tests HTTP n'ont pas besoin de MongoDB : …
5. Ce que vérifie un test d'intercepteur ou de guard : …
6. Différence test unitaire / test d'intégration : …

## Livrables TP3

- [ ] Suppression fonctionnelle d'une piste
- [ ] Progression d'upload (ou état d'upload géré à défaut)
- [ ] Au moins 3 tests frontend
- [ ] Rapport des tests (attendu vs observé)
- [ ] Capture Network suppression + upload : `![...](captures/tp3-....png)`
- [ ] `npm run build` exécuté
- [ ] `RAPPORT_IA_MODELE.md` à jour
