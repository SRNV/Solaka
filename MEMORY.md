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
    graph/GraphPage.tsx      ← page principale : graph 3D livres, frises historiques, arcs relations
    bible/BibleDrawer.tsx    ← drawer lecture biblique
    layout/Layout.tsx        ← shell app
  lib/BibleMap/
    BibleMap.tsx             ← globe 3D, boutons projection GeoJSON
    scene.ts                 ← Three.js : caméra ortho, matcap, GPU picking, projection, labels 2D canvas
    borders.ts               ← LineSegments GeoJSON, computeFeatureCentroids
  hooks/
    useApi.ts                ← fetch simple via fetchOnce
    usePaginatedAllApi.ts    ← fetch toutes les pages (limit=500), via fetchOnce
    useBibleSearchParam.ts   ← lit ?search= et ouvre le drawer
  store/
    apiCache.ts              ← fetchOnce : Map module-level, déduplication in-flight
    bible.store.ts           ← bibleStore.events/kings/periods/books/structure/bookOrder/relations/chapter/search
    geomap.store.ts          ← geomapStore.list / byId
  contexts/
    BibleDrawerContext.tsx   ← open, close, openMany, target, targets, setHistoricalDate, showInMapCount, mapTargets
  types/
    bible.ts                 ← tous les types TS partagés côté front
  utils/
    bibleRef.ts              ← parseRef
```

---

## Données statiques back

```
back/src/data/
  bible.json          ← bible complète
  book-order.json     ← ordre historique livres (composition, redaction, events dates)
  kings.json          ← rois
  periods.json        ← périodes historiques
  events.json         ← événements bibliques
back/data/geojson/    ← GeoJSON datés servis via REST
  projection_countries.geojson  ← frontières modernes (toujours présent)
  world_bc700.geojson           ← nom format : world_bc{N} → year=-N, world_{N} → year=N
  world_2010.geojson
  …
```

---

## Types TypeScript principaux (front/src/types/bible.ts)

| Type | Description |
|------|-------------|
| `BibleBookMeta` | name, number, alias, author, chapterCount |
| `BibleStructureBook` | name, number, chapters[] avec verseCount et uuids |
| `BibleBookOrder` | name, number, composition?, redaction?, events? (intervalles de dates) |
| `BibleChapterResponse` | book + chapter avec verses enrichis (target VerseRef résolu) |
| `BibleRelation` | from, toFrom, toTo, trad ('c'\|'p'), relType |
| `BibleEvent` | name, type, year, priority ('major'\|'middle'\|'minor') |
| `HistoricalPeriod` | name, start, end, type ('domination'\|'exile'\|'other') |
| `King` | name, reign:{start,end\|null}, kingdom:{judah,israel}, saint |
| `BookSortMode` | `'classic' \| 'historical' \| 'size'` |
| `HistoricalSubMode` | `'composition' \| 'redaction' \| 'events'` |
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

---

## Performances & cache

### Back
- **`relCache`** : relations pré-calculées dans le constructeur de `JsonBibleStore` (dédupliquées, triées par priorité). `getRelations()` = O(1) slice.
- **`chapterCache`** : `Map<"bookName|chapterNum", object>` pré-remplie au démarrage. Chaque chapitre est enrichi une fois (verseIndex lookups + tri). `getChapter()` = O(1). `invalidateChapter(bookRef, chapterNum)` pour mise à jour.
- **gzip** : `compression()` Express sur toutes les réponses.

### Front
- **`fetchOnce`** : Map module-level. Si la requête est in-flight, retourne la même Promise. Si le résultat est en cache, retourne immédiatement. Aucun doublon réseau.
- **`usePaginatedAllApi`** : utilise `fetchOnce` par page. `limit=500` pour minimiser le nombre de requêtes.
- **Lazy loading** : `events`, `kings`, `periods` chargés uniquement au premier passage en mode `historical`, stockés dans le store.
- **Affichage progressif (Staggered UI)** : Les relations reçues via STOMP sont mises en file d'attente et affichées une par une toutes les 250ms (côté front) pour garantir la fluidité de l'UI même avec 1000+ utilisateurs.
- **Stabilisation des sélecteurs Store** : Utilisation systématique de `useMemo` sur les sélecteurs Zustand (ex: `Object.values(rels)`) pour éviter les boucles infinies de re-rendu dues à des références d'arrays instables.
- **Vite (Optimisations de performance)** :
    - **Browser Setup** : Utiliser un profil sans extensions ou le mode incognito. Ne **pas** cocher "Disable Cache" dans les DevTools (casse le caching 304).
    - **Warmup** : `server.warmup.clientFiles` utilisé pour pré-transformer les fichiers critiques (`App`, `GraphPage`, `BibleMap`, `scene`, `BibleDrawer`).
    - **Explicit Imports** : Préférer `import './Component.tsx'` (avec extension) pour réduire les `resolve.extensions` filesystem checks.
    - **Avoid Barrel Files** : Ne pas utiliser de `index.ts` qui ré-exporte tout (ex: `src/utils/index.ts`) car cela force le chargement de fichiers inutiles.
    - **TS Config** : `moduleResolution: "bundler"` et `allowImportingTsExtensions: true` activés pour utiliser les extensions `.ts`/`.tsx` dans les imports.
    - **Optimize Deps** : `optimizeDeps.include` pour Three.js + Fiber + Drei pour éviter les re-optimisations au runtime.
    - **Native Tooling** : Préférer le CSS natif (nesting supporté via Lightning CSS/PostCSS) aux préprocesseurs (Sass/Less).
    - **SVG Handling** : Ne pas transformer les SVGs en composants React (ex: SVGR) ; les importer comme URLs ou strings si possible.
    - **Lightning CSS** : Utiliser Lightning CSS comme transformateur et minificateur CSS (expérimental dans Vite).
    - **Audit Vite Plugins** : Éviter les opérations lourdes dans `buildStart`, `config` et `configResolved` (retarde le démarrage).
    - **Profiling** : Utiliser `vite --profile` + `speedscope` pour identifier les bottlenecks.
    - **Use Lesser Tooling** : Préférer le CSS natif à Sass/Less. Ne pas transformer les SVGs en composants (SVGR) si possible.

---

## Globe 3D — points clés (scene.ts)

- Caméra orthographique, matcap texture.
- GPU picking pour sélection de features.
- `setProjection(url)` : charge un GeoJSON daté, race-condition évitée par compteur `reqId` en closure IIFE. Masque les anciens borders.
- `createBorders(url)` : frontières pays via `fetchOnce` (pas de re-fetch).
- `r = 1.001` pour les projections (même Z que les borders, jamais affichés simultanément → pas de z-fighting).
- `computeFeatureCentroids()` : positions des labels de régions.
- `drawLabels()` : canvas 2D overlay `pointer-events:none`, frustum culling + dot product face avant.
- `pendingAlpha` : flag pour activer l'alpha texture après chargement asynchrone.

---

## Layout frises historiques (GraphPage, composant interne SectionMarkers)

```ts
const ANCHOR      = -10 - 120 * px;   // référence Y commune (px = viewport.height / size.height)
const PERIOD_Y    = ANCHOR;            // frise périodes (plus haute)
const BY          = ANCHOR - 36 * px; // frise livres
const EVENT_Y     = ANCHOR - 90 * px; // frise événements (pins vers le haut, labels dessous)
const KING_Y_JUDAH   = ANCHOR - 175 * px;
const KING_Y_ISRAEL  = ANCHOR - 205 * px;
const KING_Y_UNIFIED = ANCHOR - 190 * px;
```

---

## Conventions UX & règles importantes

- **Clic gauche = pan** sur tous les canvas Three.js (`mouseButtons: { LEFT: 2, MIDDLE: 1, RIGHT: 0 }`).
- **`setHistoricalDate`** (change le GeoJSON du globe) : déclenché uniquement à l'ouverture du drawer (`target` change), **jamais** sur le hover des livres.
- **Labels events** : positionnés sous le trait horizontal de base (`EVENT_Y - 24*px`).
- **Trait horizontal events** : ligne à `EVENT_Y` reliant le min/max X de tous les événements.
- **GeoJSON** : ne jamais importer en statique côté front — toujours passer par `/api/geomap/:id`.

---

## Règles de collaboration

- Ne jamais déclarer un `useCallback`/`useEffect` qui référence un `useState` avant sa déclaration.
- Lire les diagnostics TypeScript post-edit et corriger immédiatement.
- Pas de `localStorage` pour le cache (limite 5MB, refusé par l'utilisateur).
- Réponses courtes — l'utilisateur lit les diffs directement.
- Ne pas créer de fichiers de documentation sauf si demandé.
- Tout changement doit compiler sans erreur TS.
