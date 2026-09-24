# Compte-rendu — TP3 : Fiabilisation et enrichissement du frontend

> Sujet : `../SUJET_ETUDIANT_TP3.md`. Voir aussi `../backend/analyse.md`,
> `../frontend-starter/analyse.md` et `../RAPPORT_IA_MODELE.md`.

## Prérequis vérifiés

- [ ] TP1 et TP2 fonctionnels (connexion, profil, pagination, upload, lecture)

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

Au moins 3 tests parmi la liste du sujet :

- [ ] `AuthService.login()` → `POST /api/auth/login` avec le bon corps
- [ ] `TrackService.list()` transmet `page`/`limit`
- [ ] L'intercepteur ajoute `Authorization` si un token existe
- [ ] Le guard redirige un utilisateur sans token
- [ ] Le composant affiche une erreur après un échec HTTP
- [ ] La suppression appelle `DELETE /api/tracks/:id` et recharge la liste
- [ ] L'upload met à jour la progression et traite l'erreur

Résultats attendus vs observés : …

### Extension backend (facultative)

- [ ] `401` sans JWT
- [ ] `401` avec JWT invalide
- [ ] Upload sans fichier
- [ ] Type MIME refusé
- [ ] Pagination `page`/`limit`
- [ ] Accès interdit à la piste d'un autre utilisateur

## Vérifications finales

- [ ] Tests frontend lancés
- [ ] Tests backend lancés
- [ ] `npm run build` exécuté sans erreur
- [ ] Aucune donnée sensible journalisée dans la console

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
