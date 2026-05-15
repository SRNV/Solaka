# Sola Catholica

Application web d'apologétique catholique : graphe biblique 3D interactif, globe historique, commentaires patristiques et documents du Magistère.

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 · TypeScript · Vite · Three.js (React Three Fiber) · Zustand |
| Backend | Bun · Express · TypeScript · WebSocket / STOMP |
| Infra | Docker Compose (deux services : `back :3001`, `front :5173`) |
| Tests | Cypress (E2E front) · Bun test (back) |

---

## Lancer le projet

### Avec Docker (recommandé)

```bash
docker-compose up
```

- Frontend : http://localhost:5173  
- Backend  : http://localhost:3001

Le frontend attend que le backend soit sain (`/api/health`) avant de démarrer.

### Sans Docker

```bash
# Backend (Bun requis)
cd back
bun install
bun --watch src/index.ts   # dev (hot reload)
bun src/index.ts           # prod

# Frontend
cd front
npm install
npm run dev
```

Variables d'environnement backend (voir `docker-compose.yml` pour les valeurs par défaut) :

| Variable | Description |
|----------|-------------|
| `PORT` | Port du serveur Express (défaut : 3001) |
| `BIBLE_PATH` | Chemin vers `bible.json` |
| `GEOMAP_PATH` | Répertoire des GeoJSON historiques |
| `PATRISTIC_COMMENTS_PATH` | Commentaires des Pères de l'Église |
| `MAGISTERE_COMMENTS_PATH` | Documents du Magistère |
| `DATA_PATH` | Objections théologiques |

---

## Architecture

### Backend — DDD

```
back/src/
├── domain/          # Entités : Bible, GeoMap, BiblicalPlace, Author…
├── application/
│   └── useCases/    # Logique métier (GetChapter, GetComments…)
├── infrastructure/  # JsonBibleStore, repositories (caches en mémoire)
└── api/routes/      # bible, geomap, apostles, patristic, magistere…
```

Deux caches en mémoire construits au démarrage : `relCache` (relations pré-calculées) et `chapterCache` (chapitres enrichis, lookup O(1)).

### Frontend — React + Three.js

```
front/src/
├── components/
│   ├── bible/       # BibleDrawer, CommentModal, VerseRow…
│   ├── graph/       # GraphPage, frises historiques (rois, périodes, événements)
│   └── layout/      # Shell, Sidebar, BottomNav
├── lib/
│   └── BibleMap/    # Scène Three.js (globe, bordures, voyages des apôtres)
│       ├── scene.ts                  # Entrée principale de la scène
│       ├── AnimatedLineService.ts    # Trait animé (shader GLSL, pulse gaussien)
│       ├── AuthorBillboardService.ts # Portraits sur le globe (sprite atlas)
│       └── PersonJourneyService.ts   # Trajet daté d'une personne
├── store/           # Zustand (bible.store, comment.store…)
├── data/            # atlas.json, authorPositions.json (générés par scrapp/)
└── contexts/        # BibleDrawerContext (date historique, verset cible)
```

---

## Fonctionnalités principales

**Graphe biblique 3D**  
Livres comme cubes, versets reliés par des arcs colorés (citation, typologie, accomplissement, allusion, parallèle, thématique). Navigation par livre / chapitre dans un drawer latéral.

**Globe historique**  
Carte 3D avec frontières géopolitiques datées (GeoJSON), labels des pays, places bibliques géocodées, zoom centré sur le curseur.

**Voyages des apôtres**  
Traits animés (shader écran-espace, pulse gaussien), progression clippée selon la date historique via `uMaxT`, portraits des apôtres sur le trajet (atlas sprite sheet).

**Commentaires patristiques**  
Commentaires des Pères de l'Église et du Magistère sur chaque verset, filtrables par auteur, triables par date / ordre alphabétique / longueur.

**Objections & réfutations**  
Questions théologiques avec réponses et références bibliques associées.

**Recherche**  
Recherche plein texte dans toute la Bible.

---

## Données

Les données sont générées par les scripts dans `../scrapp/` et montées en lecture seule via Docker volumes.

| Fichier source | Contenu |
|---------------|---------|
| `scrapp/output/bible.json` | Texte intégral de la Bible avec métadonnées |
| `scrapp/output/authors.json` | Auteurs patristiques et magistériels |
| `scrapp/output/comments.json` | Commentaires patristiques |
| `back/data/geojson/` | Frontières GeoJSON par époque (`world_bc700.geojson`, etc.) |
| `back/data/geojson/apostles/` | Trajets GeoJSON des apôtres (un fichier par apôtre) |

### Atlas des portraits (`scrapp/`)

Voir [`scrapp/ATLAS_BUILD.md`](../scrapp/ATLAS_BUILD.md) pour les instructions de (re)génération de l'atlas PNG et du JSON d'index. À relancer si le nombre d'auteurs change.

---

## Scripts utiles

```bash
# Frontend
npm run build          # Build de production
npm run cypress:open   # Tests E2E interactifs
npm run cypress:run    # Tests E2E CI

# Backend
bun test src/tests/    # Tests unitaires
```

---

## Structure du dépôt parent

```
bible2/
├── sola-catholica/    # Ce projet (front + back)
├── scrapp/            # Scripts de scraping et génération des données
└── objections.json    # Base des objections théologiques
```
