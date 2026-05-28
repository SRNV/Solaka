# MEMORY — sola-catholica

Contexte complet du projet pour tout agent IA. Lire ce fichier avant toute intervention.

---

## Projet

Application full-stack d'apologétique catholique avec globe 3D et visualisation biblique interactive.

**Repo :** `c:\Users\rudy_\Desktop\bible2\sola-catholica\`

---

## Stack

| Couche | Technologie |
|--------|-------------|
| Front | React + TypeScript + Vite 5 |
| 3D | Three.js + React Three Fiber + Drei |
| Routing | React Router v6 |
| State | Zustand |
| Back | Bun (runtime natif TS) + Express |
| Compression | `compression()` gzip sur toutes les réponses |
| Docker | Compose : service `front` (:5173), service `back` (:3001) |
| Proxy | Vite proxifie `/api` → `http://back:3001` |

---

## Architecture back — DDD

```
back/src/
  domain/                    ← entités pures
    Bible.ts                 ← BibleBook, BibleBookMeta, BibleVerseRelation, VerseRef, King, HistoricalPeriod, BibleEvent
    GeoMap.ts                ← GeoMap { id, label, year }
    BiblicalPlace.ts
    repositories/
      IGeoMapRepository.ts   ← interface findAll() / findById()
  application/useCases/
    GeoMapUseCases.ts        ← GetAllGeoMaps, GetGeoMapById
    BiblicalPlaceUseCases.ts
    ObjectionUseCases.ts
    CategoryUseCases.ts
  infrastructure/
    JsonBibleStore.ts        ← charge bible.json, kings, periods, events ; index versets ; relCache ; chapterCache
    FileGeoMapRepository.ts  ← lit back/data/geojson/, protection path traversal, parse année depuis nom
    BiblicalPlaceRepository.ts
  api/routes/
    bible.ts                 ← tous les endpoints /api/bible/*
    geomap.ts                ← GET /api/geomap, GET /api/geomap/:id, POST /api/geomap/batch
    biblicalPlaces.ts
    objections.ts
    categories.ts
  index.ts                   ← point d'entrée Bun, enregistre middlewares + routers
```

---

## Architecture front

```
front/src/
  components/
    graph/                   ← visualisation 3D (voir détail ci-dessous)
    bible/BibleDrawer.tsx    ← drawer lecture biblique
    layout/Layout.tsx        ← shell app
  lib/BibleMap/
    BibleMap.tsx             ← globe 3D, boutons projection GeoJSON
    scene.ts                 ← Three.js : caméra ortho, matcap, GPU picking, projection, labels 2D canvas
    borders.ts               ← LineSegments GeoJSON, computeFeatureCentroids
  lib/games/src/             ← Framework de mini-jeux multijoueurs
    components/
      Gamepad3D.tsx          ← Point d'entrée manette unifiée (SVG ou procédurale)
      svgGamepad/
        SvgGamepadScene.tsx  ← Scène R3F haute performance, boucle imperative
      GameLobby.tsx          ← Ecran d'accueil (QR Code + liste joueurs)
    hooks/
      useSvgZones.ts         ← Parser SVG dynamique (type:slot)
      useGamepadInput.ts     ← Gestionnaire d'input throttlé sans re-render
      useControllerRoom.ts   ← Synchronisation état manette (Master, Phase, persistance localStorage)
    lib/metel/
      Metel.tsx              ← Console de jeu (Vue "Serveur")
      MetelGame.tsx          ← Scène R3F complète (Physics cannon.js, TileGrid, spheres, effets)
      MetelController.tsx    ← Déclinaison manette pour Métel
  hooks/
    useApi.ts                ← fetch simple via fetchOnce
    usePaginatedAllApi.ts    ← fetch toutes les pages (limit=50000), via fetchOnce
    useBibleSearchParam.ts   ← lit ?search= et ouvre le drawer
    useCommentIndex.ts       ← usePatristicCommentIndex, pré-charge index patristic
    useStompRelations.ts     ← stream STOMP /user/queue/relations, batch 50ms
    useStompSearch.ts        ← stream STOMP /user/queue/search, batch 50ms
  store/
    apiCache.ts              ← fetchOnce : Map module-level, déduplication in-flight
    activeRelations.store.ts ← displayRelations, drawerRelations, searchHitUuids, activeSearchTarget, activeVerseUuids (ReadonlySet<string>)
    tradition.store.ts       ← showCath, showProt, showPulse
    graphMode.store.ts       ← sortMode, histSubMode, histSecondaryFrise
    yearMarkers.store.ts     ← yearPoints, scrubberWorldX, cameraX, cameraZoom, canvasContainerEl, invalidateCanvas
    timeline.store.ts        ← isPlaying, playSpeed, play, pause, stop, setSpeed
    historicalData.store.ts  ← kings, periods, events (lazy-loaded)
    bible.store.ts           ← bibleStore.events/kings/periods/books/structure/bookOrder/relations/chapter/search
    geomap.store.ts          ← geomapStore.list / byId
  contexts/
    BibleDrawerContext.tsx   ← open, close, openMany, target, targets, historicalDate, setHistoricalDate, showInMapCount, mapTargets
  models/                    ← tous les types .d.ts — jamais d'interface inline dans les composants
    bible.d.ts               ← BibleStructureBook, BibleBookMeta, BibleBookOrder, BibleRelation, King, HistoricalPeriod, BibleEvent, BookSortMode, HistoricalSubMode
    graph.d.ts               ← Pos3, LayoutResult, ArcSeg, LaneInfo, BraceCircle, ArcGeometryResult
    api.d.ts                 ← Category, Objection, PaginatedResponse<T>, GeoMap, BiblicalPlace
    patristic.d.ts           ← PatristicPersonSnippet, CommentSummary, PatristicCommentResult, PatristicCommentsPage
    bibleDrawer.d.ts         ← ChildResult, SoloItem, GroupItem, VerseListItem
    contexts.d.ts            ← BibleTarget, ArcRef, BibleDrawerCtx
    stores.d.ts              ← StoredVerse, VerseRef, RelRow, RelationsState, PatristicCommentState
    bibleMap.d.ts            ← CameraState, PlaceItem, PersonPin, SceneControls, LineSegment, …
  utils/
    graphLayout.ts           ← computeLayout → LayoutResult
    graphConstants.ts        ← CUBE_S, BRACE_MARGIN, couleurs, constantes scène
    graphShaders.ts          ← GLSL pour arcs et scrubber
    graphRelations.ts        ← normalizeRelations, computeArcSegments
```

---

## Composants graph/ — hiérarchie

```
GraphPage                      ← shell pur : BibleMapFeature + GlobalPlayerComponent (aucune prop partagée)
├── BibleMapFeature            ← globe autonome, lit activeVerseUuids depuis activeRelations.store
└── GlobalPlayerComponent      ← graph 3D + 4 rows CSS flex (height: 500px, bottom: 0)
    ├── HoverPanel             ← info verset survolé (topRow, in-flow)
    ├── ControlIcons           ← tous les boutons icônes ronds (topRow) — lit ses propres stores
    ├── Canvas principal       ← frameloop="demand", orthographic
    │   ├── Cubes              ← GPU instanced 66k+ versets
    │   ├── CommentSquaresMesh ← carrés commentaires patristiques
    │   ├── HoverPlane         ← détection hover/clic livres
    │   ├── ScrubberCanvas     ← scrubber historique (GLSL mask)
    │   ├── RelationsCanvas    ← arcs GLSL
    │   └── SearchBadgesCanvas ← badges résultats de recherche
    ├── Canvas SectionMarkers  ← frises historiques (frameloop="always")
    ├── SearchFeature          ← <SearchInput> direct dans controlsRow (pleine largeur)
    └── SortFeature            ← render null — lance uniquement les effets lazy-load kings/periods/events
```

### Layout CSS des 4 rows (GraphPage.module.css)

```
.graphWrapper  → position: absolute; bottom: 0; height: 500px; flex-direction: column
  .topRow      → flex: 2   — play btn + HoverPanel (left) | ControlIcons (right)
  .playerRow   → flex: 9   — canvas 3D principal
  .markersRow  → flex: 3   — SectionMarkers canvas
  .controlsRow → flex: 1   — SearchFeature (pleine largeur)
```

### ControlIcons — contenu

Boutons icônes 26×26px, rangée unique dans topRow. Groupes séparés par `<Sep />` :
1. Sort mode : Classic (ListIcon) / Historique (ClockIcon) / Taille (BarChartIcon)
2. *(mode historical seulement)* Frises : Rois (CrownIcon) / Périodes (PeriodsIcon) / Événements (BoltIcon)
3. *(mode historical seulement)* Sub-mode : Période auteur (QuillIcon) / Composition (LayersIcon) / Rédaction finale (SealIcon)
4. Tradition : Catholique (CrossIcon) / Protestant (BookIcon) / Pulse (PulseIcon)
5. *(si drawerRelations)* Effacer filtre (FilterClearIcon)
6. *(mode historical seulement)* Speed pills : `SPEEDS = [0.5, 1, 2, 5]` depuis `useTimelineStore`

---

## Hooks graph/ (front/src/components/graph/)

| Hook | Rôle |
|------|------|
| `useTimeline` | Play/pause interval 15Hz, scrubber drag worldX→year, sync drawer→scrubber. Retourne `{ isPlaying, handlePlay, handleScrubberMouseDown, handleRef }` |
| `useRelations` | STOMP relations, normalisation, `stompRelations` |
| `useYearMarkers` | Points year↔worldX pour la frise historique |
| `useHoverPanel` | État hover (book, cubeUuid, panelData, arcXs) |
| `useCommentHighlights` | `activeVerseUuids` (ReadonlySet), `commentExtraXSet`, `commentHoverRange` |
| `useSceneColors` | `colorMap`, `bookHasRelation`, `destUuids` |
| `useHoveredPeriod` | Plage de dates survolée (mode historical) |

---

## Données statiques back

```
back/src/data/
  bible.json          ← bible complète
  book-order.json     ← ordre historique livres
  kings.json          ← rois
  periods.json        ← périodes historiques
  events.json         ← événements bibliques
back/data/geojson/    ← GeoJSON datés servis via REST
  projection_countries.geojson  ← frontières modernes (toujours présent)
  world_bc700.geojson           ← nom format : world_bc{N} → year=-N, world_{N} → year=N
```

---

## Types TypeScript principaux (front/src/models/)

| Type | Description |
|------|-------------|
| `BibleBookMeta` | name, number, alias, author, chapterCount |
| `BibleStructureBook` | name, number, chapters[] avec verseCount et uuids |
| `BibleBookOrder` | name, number, authorPeriod?, mainComposition?, finalRedaction? (intervalles de dates) |
| `BibleRelation` | from, toFrom, toTo, trad ('c'\|'p'), relType |
| `BibleEvent` | name, type, year, priority ('major'\|'middle'\|'minor') |
| `HistoricalPeriod` | name, start, end, type ('domination'\|'exile'\|'other') |
| `King` | name, reign:{start,end\|null}, kingdom:{judah,israel}, saint |
| `BookSortMode` | `'classic' \| 'historical' \| 'size'` |
| `HistoricalSubMode` | `'authorPeriod' \| 'mainComposition' \| 'finalRedaction'` |
| `LayoutResult` | totalX, maxTowerY, bookLabels, uuidRefMap, … |
| `PaginatedResponse<T>` | `{ data: T[], total, limit, offset }` |

---

## Endpoints REST back

```
GET  /api/bible/books                          → PaginatedResponse<BibleBookMeta>
GET  /api/bible/structure                      → PaginatedResponse<BibleStructureBook>
GET  /api/bible/book-order                     → PaginatedResponse<BibleBookOrder>
GET  /api/bible/kings                          → PaginatedResponse<King>
GET  /api/bible/periods                        → PaginatedResponse<HistoricalPeriod>
GET  /api/bible/events                         → PaginatedResponse<BibleEvent>
GET  /api/bible/relations                      → PaginatedResponse<BibleRelation>
GET  /api/bible/search?q=                      → PaginatedResponse<VerseSearchResult>
GET  /api/bible/books/:book/chapters/:chapter  → BibleChapterResponse
GET  /api/geomap                               → GeoMap[]
GET  /api/geomap/:id                           → GeoJSON FeatureCollection
POST /api/geomap/batch                         → GeoJSON[]
```

STOMP WebSocket Bible (`ws://{host}/stomp`) :
- `/user/queue/relations?trad=c,p&q=…` — relations filtrées par tradition + query
- `/user/queue/search?q=…` — résultats de recherche

STOMP WebSocket Games (`ws://{host}:5000/stomp`) :
- `/topic/room/{roomId}` — Topic unifié (Inputs + Événements de room)

---

## Performances & cache

### Back
- **`relCache`** : relations pré-calculées dans le constructeur de `JsonBibleStore` (dédupliquées, triées par priorité). `getRelations()` = O(1) slice.
- **`chapterCache`** : `Map<"bookName|chapterNum", object>` pré-remplie au démarrage. `getChapter()` = O(1). `invalidateChapter()` disponible.
- **gzip** : `compression()` Express sur toutes les réponses.

### Front
- **`fetchOnce`** : Map module-level. Si la requête est in-flight, retourne la même Promise. Aucun doublon réseau.
- **`usePaginatedAllApi`** : utilise `fetchOnce` par page. `limit=50000` pour minimiser les requêtes.
- **Lazy loading** : `events`, `kings`, `periods` chargés uniquement au premier passage en mode `historical` via `SortFeature` (effets only, render null).
- **`frameloop="demand"` + invalidateCanvas** : le canvas principal ne re-rend que si `invalidate()` est appelé. Enregistré dans `yearMarkers.store` via `onCreated={({ invalidate }) => setInvalidateCanvas(invalidate)}`. Tout code impératif (drag handlers, timers) qui modifie la scène doit appeler `useYearMarkersStore.getState().invalidateCanvas?.()`.
- **Vite dev** : `optimizeDeps.include` pour Three.js/Fiber/Drei. `server.warmup.clientFiles` pour les gros fichiers. `npx vite optimize` avant `npm run dev` pour éviter le premier chargement lent.
- **Volume nommé node_modules** : `front_node_modules` Docker volume nommé — persiste entre restarts.

---

## Globe 3D — points clés (scene.ts)

- Caméra orthographique, matcap texture.
- GPU picking pour sélection de features.
- `setProjection(url)` : charge un GeoJSON daté, race-condition évitée par compteur `reqId` en closure IIFE.
- `createBorders(url)` : frontières pays via `fetchOnce` (pas de re-fetch).
- `r = 1.001` pour les projections (même Z que les borders, jamais affichés simultanément → pas de z-fighting).
- `drawLabels()` : canvas 2D overlay `pointer-events:none`, frustum culling + dot product face avant.
- `activeVerseUuids` (ReadonlySet) transmis depuis `activeRelations.store` via `BibleMapFeature`.

---

## Conventions UX & règles importantes

- **Clic gauche = pan** sur tous les canvas Three.js (`mouseButtons: { LEFT: 2, MIDDLE: 1, RIGHT: 0 }`).
- **`setHistoricalDate`** (change le GeoJSON du globe) : déclenché uniquement à l'ouverture du drawer (`target` change), **jamais** sur le hover des livres.
- **Couleur gold** : `0xD4AC0D` — ne jamais changer.
- **GeoJSON** : ne jamais importer en statique côté front — toujours passer par `/api/geomap/:id`.
- **`activeVerseUuids`** : type `ReadonlySet<string>` dans le store (pas `Set<string>`).
- **Communication inter-composants** : `GlobalPlayerComponent` et `BibleMapFeature` sont frères, aucune prop partagée — uniquement via stores Zustand.

### cannon.js / @react-three/cannon

- **Resize via `key=`** : quand un corps physique est recrée (`key={radius}`), tout `useRef` local à ce composant repart de zéro. Les refs qui doivent survivre (ex. invincibilité, position sauvegardée) doivent vivre dans le composant parent et être passés en prop.
- **Pénétration initiale au spawn** : lors du spawn ou resize, forcer `py = max(py, TILE_THICK + radius + 0.15)` et `vy = 0` pour éviter le bond causé par la résolution de collision cannon.js au premier frame.
- **Effet visuel d'invincibilité** : clignoter le mesh via `ref.current.visible = Math.floor(now/120) % 2 === 0` dans `useFrame` — ne pas passer par un état React.
- **Détection atterrissage** : utiliser un ref `justLanded` mis à `true` dans `onCollide` (si `airborne` était `true`) et consommé dans `useFrame` — `onCollide` et `useFrame` ne s'exécutent pas dans le même tick.

---

## Règles de collaboration

- Ne jamais déclarer un `useCallback`/`useEffect` qui référence un `useState` avant sa déclaration.
- Lire les diagnostics TypeScript post-edit et corriger immédiatement.
- Pas de `localStorage` pour le cache (limite 5MB).
- Réponses courtes — l'utilisateur lit les diffs directement.
- Ne pas créer de fichiers de documentation sauf si demandé.
- Tout changement doit compiler sans erreur TS.
- Pas de commentaires sauf si le WHY est non-évident.
- Ne pas recreer : `TimelineControls.tsx`, `TraditionFeature.tsx` — leur logique est dans `useTimeline.ts` et `ControlIcons.tsx`.

---

## Notes temporaires & Testing

- **CORS / Origins** : Les serveurs (`back` Bun et `games-server` C#) sont configurés pour accepter plusieurs origines via les variables d'environnement `CORS_ORIGIN` et `ALLOWED_ORIGINS` dans le `docker-compose.yml`. 
- **⚠️ Accès Mobile** : Pour tester sur téléphone via le réseau local, il est **impératif** d'ajouter l'IP locale de la machine hôte (ex: `http://192.168.1.XX:5173`) dans ces listes d'origines autorisées.
- **Game Server** : Le serveur de jeux est en C# (port 5000), supporte STOMP via un topic unifié `/topic/room/{roomId}`. Les manettes s'identifient via un en-tête `x-controller-id` lors de la souscription et incluent `type: 'input'` dans leurs messages `SEND`.
- **Persistance** : Le `controllerId` est stocké dans le `localStorage` du navigateur pour permettre la reprise de session (Takeover) après fermeture d'onglet ou déconnexion réseau.
- **Synchronisation** : Pas de contrôle de dérive temporelle (latency check) sur le serveur pour accommoder les horloges client variées. Le nettoyage des sessions cible uniquement le `SessionId` spécifique pour éviter les race conditions lors des reconnexions rapides.
- **Assets** : Utilisation de `apng_to_sheet.py` pour convertir les animations APNG en spritesheets horizontaux optimisés.
- **Animations** : `SpriteAnim.tsx` supporte `randomRotation: true`. `HIT_ANIM` et `WRONG_ANSWER_ANIM` utilisent cette rotation et des spritesheets (`2_sheet.png`, `sheet.png`). Introduction de `HitAnimService.tsx` pour des séquences d'impact multi-couches gérées par GSAP.

---

## Gamepad Framework (SVG & 3D)

### Architecture Modulaire et Dynamique
- **Infrastructure unifiée** : Le composant `.\front\src\lib\games\src\components\Gamepad3D.tsx` est l'unique point d'entrée pour toutes les manettes. Il gère l'alternance intelligente entre un layout basé sur un fichier SVG (chargé via `svgUrl`) et un layout procédural de secours (`computeZones`).
- **Parsing SVG sémantique** : `.\front\src\lib\games\src\hooks\useSvgZones.ts` implémente une grammaire stricte pour les IDs d'éléments SVG : `/^\((<type>[:<slot>])\)<name>/`.
    - **Types** : `joystick` (axe 2D avec asset GLB), `button` (impulsion + durée), `boolean` (état on/off pur).
    - **Exemple ID** : `(joystick:left)stick_left` ou `(button:diamond-right)A`.
    - **Slots de Thème** : Permettent de mapper une forme SVG aux couleurs du thème (`diamond-right` pour le bouton A, `diamond-bottom` pour B, `center` pour les boutons de menu).
    - **Validation** : Le système rejette (avec message d'erreur UI) toute manette SVG ayant des noms d'entrée (`name`) dupliqués.
- **Identité du Joueur** : Le pseudonyme (géré par `.\front\src\lib\games\src\hooks\usePseudo.ts`) et le nom du thème actuel sont affichés en haut à droite de la manette, à côté du bouton plein écran, pour une identification rapide.

### Optimisations de Haute Performance (Cible : 100+ Joueurs)
Pour supporter des flux massifs d'entrées (60 messages/sec par joueur) sans saturer le thread principal :
- **Politique "Zero React per-input"** : Les entrées réseau ne déclenchent **aucun re-render React**. Les données sont stockées dans des `useRef`. La boucle `useFrame` (60 FPS) dans `.\front\src\lib\games\src\components\svgGamepad\SvgGamepadScene.tsx` lit directement ces buffers pour mettre à jour la scène.
- **Boucle de rendu Impérative** :
    - **Calculs sans allocation** : Utilisation systématique d'objets pré-alloués (`THREE.Vector3`, `THREE.Matrix4`) pour éviter la pression sur le Garbage Collector.
    - **Throttling de la Console** : Le composant `.\front\src\lib\games\src\lib\metel\Metel.tsx` (console de jeu) rafraîchit l'affichage des cartes de joueurs à **30Hz** maximum via un timer indépendant, divisant par deux l'overhead CPU de l'UI.
- **Bufferisation STOMP** : Les messages d'entrée sont traités "at-rate" (au rythme du rafraîchissement écran), garantissant que la charge de calcul reste proportionnelle au FPS et non au volume de messages reçus.

### Fidélité Visuelle et Physique 3D
- **Joystick Asset-based** : Utilisation de `joystick.glb`.
    - **Pivot & Orientation** : Le modèle a son pivot à la base. L'orientation est calculée via un `lookAt` dynamique vers la position du doigt dans l'espace monde.
    - **Facteur d'inclinaison** : Intensité fixée à **1.203** pour une sensation mécanique accentuée.
    - **Echelle Proportionnelle** : Le corps et la tête du joystick sont à **0.85** du rayon défini dans le SVG, tandis que la base ("le pied") reste à **1.0** pour ancrer visuellement l'objet.
- **Système de Matériaux** :
    - **Garantie de Thème** : Injection forcée via une procédure de `traverse` sur les modèles GLB. Chaque mesh reçoit le matériau du thème actuel (MatCap ou Standard avec émissivité).
    - **Persistance** : Le thème et la texture MatCap sont sauvegardés en `localStorage` et réappliqués instantanément au montage du composant (`useGamepadCommon.ts`).
- **Post-processing** : Utilisation d'un `OutlinePass` haute fidélité incluant les joysticks GLB, synchronisé avec la couleur d'accentuation du thème.

### Logique métier et UX Gamepad
- **Rôle Master** : Identification automatique de la première manette connectée comme "Master" via un flag serveur, visualisée par une LED verte (`masterIndicator`).
- **Prévention de la mise en veille** : Utilisation de la `Screen Wake Lock API` (via `useWakeLock.ts`) pour empêcher le téléphone de se verrouiller tant que la manette est active.
- **Résilience Réseau** : Lors d'une reconnexion, la manette synchronise son état UI avec la `phase` actuelle de la partie (waiting/playing) transmise par le serveur.
- **Mode Développeur** : Bouton "Ouvrir une manette" présent dans le lobby uniquement si `import.meta.env.DEV` est vrai.
- **Interaction** : Le retour haptique visuel (explosions de particules, tremblement de scène `shakeRef`) est déclenché par les événements `onButtonDown` pour renforcer l'immersion.

---

## Verse Battle — Fixes techniques

### Branches volantes (Flying Branches)
- **Problème** : Les branches restaient statiques en coordonnées monde après leur spawn, alors que le terrain (roll, yaw, bumps) continuait de se déformer dynamiquement.
- **Solution** : Recalcul de `wx`, `wy` et de l'orientation (`surfaceQuat`) à chaque frame dans `useFrame`. Les branches suivent désormais parfaitement les ondulations du terrain.

### Wobble / Jitter (Vibrations)
- **Problème** : Micro-décalages entre l'intégration de `delta` pour la position `z` et le temps absolu `t` utilisé par les shaders pour les ondes du terrain.
- **Solution** : Synchronisation absolue. On stocke `spawnT` et `spawnZ`, et on dérive `z` directement : `s.z = spawnZ + vz * (t - spawnT)`. Cela élimine toute dérive temporelle et "colle" les objets aux crêtes de vagues du terrain.
