# Compte-rendu de TP — mode d'emploi

Ce dossier contient le journal de bord personnel (`TP1.md`, `TP2.md`,
`TP3.md`) : ce qui a été fait, mission par mission, expliqué avec mes propres
mots, avec preuves à l'appui. Il est **complémentaire** à deux autres
documents, à ne pas confondre :

| Document | Contenu | Qui l'écrit | Quand |
|---|---|---|---|
| `backend/analyse.md`, `frontend-starter/analyse.md` | Photo technique **actuelle** de l'architecture (stable, pas un historique) | Assistant IA, à ma demande, mis à jour à la fin de chaque mission | Après chaque mission complétée |
| `compte-rendu/TP1.md` / `TP2.md` / `TP3.md` (ce dossier) | Journal **chronologique** : ce que j'ai fait, pourquoi, preuves (captures Network, captures UI), réponses aux questions du sujet | Moi, avec mes mots | Au fil de chaque mission |
| `RAPPORT_IA_MODELE.md` (racine) | Rapport **d'usage de l'IA** : prompts envoyés, plan proposé, vérifications faites, erreurs rejetées, fichiers modifiés | Moi (avec l'aide de l'assistant pour la mise en forme) | Après chaque mission où l'IA a été utilisée |

## Organisation des preuves

Les captures d'écran vont dans `compte-rendu/captures/`, nommées
`tpX-missionY-sujet.png` (exemple : `tp1-mission1-network-login.png`), et
sont liées depuis le fichier `TPX.md` correspondant avec une syntaxe Markdown
standard : `![description](captures/tp1-mission1-network-login.png)`.

## Rythme conseillé, par mission

1. Implémenter la mission.
2. Vérifier que ça fonctionne réellement (Network, console, comportement UI).
3. Prendre les captures demandées par le sujet et les ranger dans `captures/`.
4. Rédiger la section correspondante dans `TPX.md` (avec mes mots).
5. Mettre à jour `RAPPORT_IA_MODELE.md` si un assistant IA a été utilisé.
6. Demander la mise à jour des sections concernées de `analyse.md`
   (back et/ou front selon ce qui a changé).
7. Passer à la mission suivante.
