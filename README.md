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

### Graphe biblique 3D

Le cœur de l'application. Chaque livre de la Bible est représenté comme un objet 3D dans un espace navigable. Les versets sont reliés entre eux par des arcs colorés selon leur type de relation :

- **Citation** — un texte cité mot pour mot dans un autre livre
- **Typologie** — une réalité de l'Ancien Testament qui préfigure le Nouveau
- **Accomplissement** — une prophétie et son accomplissement explicite
- **Allusion** — un écho thématique ou lexical entre deux passages
- **Parallèle** — deux récits racontant le même événement (ex. évangiles synoptiques)
- **Thématique** — deux textes partageant un même thème théologique

Un drawer latéral permet de naviguer livre par livre et chapitre par chapitre, d'afficher le texte de chaque verset avec son contexte, et de voir tous les liens qui le traversent. Les arcs sont colorés selon la tradition (catholique, protestante) et la nature de la relation.

### Globe historique

Un globe 3D (Three.js, projection orthographique) affiche les frontières géopolitiques du monde biblique à différentes époques. Un curseur de date permet de faire évoluer la carte entre — 700 av. J.-C. et aujourd'hui : les empires assyrien, babylonien, perse, grec, romain, byzantin… apparaissent et disparaissent au fil du temps.

Les **lieux bibliques géocodés** (villes, régions mentionnées dans la Bible) sont superposés sur le globe et s'activent lorsqu'un verset les cite. Les labels s'affichent avec un système de détection de collision pour éviter les chevauchements, et leur taille s'adapte au niveau de zoom.

### Voyages des apôtres

Les trajets missionnaires des apôtres (Pierre, Paul et ses cinq voyages, Jean, Thomas…) sont tracés sur le globe sous forme de traits animés. Un **pulse gaussien** se déplace le long du trait pour indiquer le sens de déplacement.

La progression du trajet est **synchronisée avec la date historique** : lorsque l'utilisateur change l'année dans le curseur, chaque voyage se découpe progressivement jusqu'au dernier lieu atteint à cette date. La transition est fluide (interpolation GSAP sur le paramètre `uMaxT` dans le shader). Le portrait de l'apôtre glisse le long du trajet au fil du temps.

Les apôtres sont identifiables par leur photo (extraite de Wikidata / Wikipédia) affichée sous forme de billboard sur le globe, avec un encadrement coloré selon leur statut (apôtre, Père de l'Église, Magistère).

### Commentaires patristiques et Magistère

Pour chaque verset, les commentaires des Pères de l'Église et des documents du Magistère sont disponibles dans une modale dédiée. On peut :

- **Trier** par date (chronologique), ordre alphabétique ou longueur du commentaire
- **Filtrer** par auteur via un menu déroulant
- **Naviguer** entre les versets d'un même passage sans fermer la modale (flèches ou touches ← →)

Les commentaires patristiques et magistériels sont visuellement séparés et colorés différemment (violet pour les Pères, or pour le Magistère). Les auteurs sont représentés par leurs portraits dans un sprite atlas partagé.

### Objections théologiques

Une section dédiée aux questions apologétiques courantes : chaque objection est accompagnée d'une réponse argumentée et des références bibliques et patristiques correspondantes.

### Recherche

Recherche plein texte sur l'ensemble de la Bible. Les résultats renvoient directement au verset dans le graphe et ouvrent le drawer de lecture.

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
