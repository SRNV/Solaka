import { describe, it, expect, beforeAll } from 'bun:test';

const BASE = process.env.API_URL ?? 'http://localhost:3001';

// Helper : GET + parse JSON, vérifie status 200
async function get<T>(path: string): Promise<{ data: T; ms: number; bytes: number }> {
  const t = Date.now();
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  const ms = Date.now() - t;
  expect(res.status, `GET ${path} → ${res.status}`).toBe(200);
  return { data: JSON.parse(text) as T, ms, bytes: text.length };
}

// Attendre que le back soit prêt (warmup chapterCache)
beforeAll(async () => {
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${BASE}/api/health`).catch(() => null);
    if (r?.ok) { ready = true; break; }
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!ready) throw new Error('Back not ready after 60s');
});

// ── Health ────────────────────────────────────────────────────────────────────

describe('health', () => {
  it('retourne ok', async () => {
    const { data } = await get<{ status: string }>('/api/health');
    expect(data.status).toBe('ok');
  });
});

// ── Bible / books ─────────────────────────────────────────────────────────────

describe('GET /api/bible/books', () => {
  it('retourne une liste paginée de livres', async () => {
    const { data, ms } = await get<any>('/api/bible/books?limit=100');
    expect(data.data).toBeArray();
    expect(data.total).toBeGreaterThan(0);
    expect(data.data[0]).toMatchObject({ name: expect.any(String), chapterCount: expect.any(Number) });
    expect(ms).toBeLessThan(500);
  });

  it('respecte limit et offset', async () => {
    const { data: page1 } = await get<any>('/api/bible/books?limit=5&offset=0');
    const { data: page2 } = await get<any>('/api/bible/books?limit=5&offset=5');
    expect(page1.data).toHaveLength(5);
    expect(page2.data[0].name).not.toBe(page1.data[0].name);
  });
});

// ── Bible / structure ─────────────────────────────────────────────────────────

describe('GET /api/bible/structure', () => {
  it('retourne la structure avec chapitres et uuids', async () => {
    const { data, ms } = await get<any>('/api/bible/structure?limit=10');
    expect(data.data[0]).toMatchObject({ name: expect.any(String), chapters: expect.any(Array) });
    const book = data.data.find((b: any) => b.chapters?.length > 0);
    expect(book).toBeDefined();
    const ch = book.chapters[0];
    expect(typeof ch.verseCount).toBe('number');
    expect(Array.isArray(ch.uuids)).toBe(true);
    expect(ms).toBeLessThan(500);
  });

  it('verseNumbers présent sur chaque chapitre, même longueur que uuids', async () => {
    const { data } = await get<any>('/api/bible/structure?limit=10');
    for (const book of data.data) {
      for (const ch of book.chapters ?? []) {
        expect(Array.isArray(ch.verseNumbers)).toBe(true);
        expect(ch.verseNumbers.length).toBe((ch.uuids ?? []).length);
      }
    }
  });

  it('Jean 5 — verseNumbers saute le v.4 (textuel incertain, pas de doublon d\'index)', async () => {
    const { data } = await get<any>('/api/bible/structure?limit=100');
    const jean = data.data.find((b: any) => b.name === 'Jean');
    const ch5  = jean?.chapters.find((c: any) => c.number === 5);
    expect(ch5).toBeDefined();
    // Aucun verset numéro 4 dans Jean 5
    expect(ch5.verseNumbers.indexOf(4)).toBe(-1);
    // Le verset 8 existe et est à un index > 0
    const idx8 = ch5.verseNumbers.indexOf(8);
    expect(idx8).toBeGreaterThan(0);
    expect(ch5.uuids[idx8]).toBeDefined();
  });

  it('Jean 5 — verseNumbers[i] != i+1 pour les versets après la lacune', async () => {
    const { data } = await get<any>('/api/bible/structure?limit=100');
    const jean = data.data.find((b: any) => b.name === 'Jean');
    const ch5  = jean?.chapters.find((c: any) => c.number === 5);
    // Le 4e élément du tableau (index 3) doit être 5, pas 4 (i+1)
    expect(ch5.verseNumbers[3]).toBe(5);
    // Le 7e élément (index 6) doit être 8, pas 7
    expect(ch5.verseNumbers[6]).toBe(8);
  });

  it('Jean 5 — uuid du verset 8 dans la structure correspond au verset retourné par le chapitre', async () => {
    const { data: struct } = await get<any>('/api/bible/structure?limit=100');
    const jean  = struct.data.find((b: any) => b.name === 'Jean');
    const ch5   = jean?.chapters.find((c: any) => c.number === 5);
    const idx8  = ch5.verseNumbers.indexOf(8);
    const uuidV8 = ch5.uuids[idx8];

    // Récupérer le chapitre complet et vérifier que l'uuid correspond au verset 8
    const { data: chRes } = await get<any>('/api/bible/books/Jean/chapters/5');
    const v8 = chRes.chapter.verses.find((v: any) => v.number === 8);
    expect(v8).toBeDefined();
    expect(v8.uuid).toBe(uuidV8);
  });

  it('verseNumbers strictement croissants dans chaque chapitre', async () => {
    const { data } = await get<any>('/api/bible/structure?limit=100');
    for (const book of data.data) {
      for (const ch of book.chapters ?? []) {
        const nums: number[] = ch.verseNumbers ?? [];
        for (let i = 1; i < nums.length; i++) {
          expect(nums[i]).toBeGreaterThan(nums[i - 1]);
        }
      }
    }
  });

  it('recherche "Jean 5:8" retourne exactement le verset 8 (pas le 7)', async () => {
    const { data } = await get<any>('/api/bible/search?q=Jean%205%3A8&limit=5');
    expect(data.data.length).toBe(1);
    expect(data.data[0].bookName).toBe('Jean');
    expect(data.data[0].chapterNumber).toBe(5);
    expect(data.data[0].verseNumber).toBe(8);
  });

  it('uuid de Jean 5:8 (structure) correspond au verset retourné par search', async () => {
    const { data: struct } = await get<any>('/api/bible/structure?limit=100');
    const jean    = struct.data.find((b: any) => b.name === 'Jean');
    const ch5     = jean?.chapters.find((c: any) => c.number === 5);
    const idx8    = ch5.verseNumbers.indexOf(8);
    const uuidV8  = ch5.uuids[idx8];

    const { data: search } = await get<any>('/api/bible/search?q=Jean%205%3A8&limit=1');
    expect(search.data[0].uuid).toBe(uuidV8);
  });
});

// ── Bible / book-order ────────────────────────────────────────────────────────

describe('GET /api/bible/book-order', () => {
  it('retourne les livres avec dates', async () => {
    const { data, ms } = await get<any>('/api/bible/book-order?limit=100');
    expect(data.data).toBeArray();
    expect(data.total).toBeGreaterThan(0);
    expect(ms).toBeLessThan(200);
  });
});

// ── Bible / chapter ───────────────────────────────────────────────────────────

describe('GET /api/bible/books/:book/chapters/:chapter', () => {
  it('retourne le chapitre enrichi depuis le cache', async () => {
    const { data, ms } = await get<any>('/api/bible/books/Gen%C3%A8se/chapters/1');
    expect(data.book).toMatchObject({ name: 'Genèse' });
    expect(data.chapter.verses).toBeArray();
    expect(data.chapter.verses.length).toBeGreaterThan(0);
    expect(data.chapter.verses[0]).toHaveProperty('content');
    expect(ms).toBeLessThan(300);
  });

  it('chapitre mis en cache — 2e appel plus rapide', async () => {
    const { ms: ms1 } = await get<any>('/api/bible/books/Jean/chapters/3');
    const { ms: ms2 } = await get<any>('/api/bible/books/Jean/chapters/3');
    expect(ms2).toBeLessThanOrEqual(ms1 + 20);
  });

  it('retourne 404 pour un livre inexistant', async () => {
    const res = await fetch(`${BASE}/api/bible/books/Inconnu/chapters/1`);
    expect(res.status).toBe(404);
  });

  it('les versets ont des relations enrichies', async () => {
    const { data } = await get<any>('/api/bible/books/Jean/chapters/1');
    const versesWithRel = data.chapter.verses.filter((v: any) => v.related_to?.length > 0);
    expect(versesWithRel.length).toBeGreaterThan(0);
    const rel = versesWithRel[0].related_to[0];
    expect(rel).toHaveProperty('target');
  });
});

// ── Bible / kings ─────────────────────────────────────────────────────────────

describe('GET /api/bible/kings', () => {
  it('retourne les rois', async () => {
    const { data, ms } = await get<any>('/api/bible/kings?limit=100');
    expect(data.data).toBeArray();
    expect(data.total).toBeGreaterThan(0);
    expect(data.data[0]).toHaveProperty('name');
    expect(ms).toBeLessThan(200);
  });
});

// ── Bible / periods ───────────────────────────────────────────────────────────

describe('GET /api/bible/periods', () => {
  it('retourne les périodes historiques', async () => {
    const { data } = await get<any>('/api/bible/periods?limit=100');
    expect(data.data).toBeArray();
    expect(data.data[0]).toMatchObject({ name: expect.any(String), start: expect.any(Number) });
  });
});

// ── Bible / events ────────────────────────────────────────────────────────────

describe('GET /api/bible/events', () => {
  it('retourne les événements', async () => {
    const { data } = await get<any>('/api/bible/events?limit=200');
    expect(data.data).toBeArray();
    expect(data.data[0]).toMatchObject({ name: expect.any(String), year: expect.any(Number) });
  });
});

// ── Bible / relations ─────────────────────────────────────────────────────────

describe('GET /api/bible/relations', () => {
  it('retourne des relations paginées', async () => {
    const { data, ms } = await get<any>('/api/bible/relations?limit=100&offset=0');
    expect(data.data).toBeArray();
    expect(data.total).toBeGreaterThan(1000);
    expect(data.data[0]).toMatchObject({ from: expect.any(String), toFrom: expect.any(String), relType: expect.any(String) });
    expect(ms).toBeLessThan(500);
  });
});

// ── Bible / search ────────────────────────────────────────────────────────────

describe('GET /api/bible/search', () => {
  it('recherche par mot clé', async () => {
    const { data, ms } = await get<any>('/api/bible/search?q=amour&limit=20');
    expect(data.data).toBeArray();
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0]).toMatchObject({ content: expect.any(String), bookName: expect.any(String) });
    expect(ms).toBeLessThan(1000);
  });

  it('recherche par référence (Jn 3:16)', async () => {
    const { data } = await get<any>('/api/bible/search?q=Jean%203%3A16&limit=5');
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0].chapterNumber).toBe(3);
    expect(data.data[0].verseNumber).toBe(16);
  });

  it('retourne vide pour une requête sans résultat', async () => {
    const { data } = await get<any>('/api/bible/search?q=zzzzinexistant&limit=5');
    expect(data.total).toBe(0);
  });

  it('plusieurs références séparées par ; (Jn 3:16 ; Gn 1:1)', async () => {
    const { data } = await get<any>('/api/bible/search?q=Jean%203%3A16%3BGen%C3%A8se%201%3A1&limit=20');
    expect(data.data.length).toBeGreaterThanOrEqual(2);
    const books = data.data.map((v: any) => v.bookName);
    expect(books).toContain('Jean');
    expect(books).toContain('Genèse');
  });

  it('plusieurs textes séparés par ; sont en UNION (lumière ; eau)', async () => {
    const { data } = await get<any>('/api/bible/search?q=lumi%C3%A8re%3Beau&limit=100');
    // Chaque terme est indépendant : un résultat contient "lumière" OU "eau" (pas forcément les deux)
    expect(data.data.length).toBeGreaterThan(0);
    for (const v of data.data) {
      const lower = v.content.toLowerCase();
      expect(lower.includes('lumi') || lower.includes('eau')).toBe(true);
    }
    // Au moins un résultat avec "lumière" et au moins un avec "eau"
    expect(data.data.some((v: any) => v.content.toLowerCase().includes('lumi'))).toBe(true);
    expect(data.data.some((v: any) => v.content.toLowerCase().includes('eau'))).toBe(true);
  });

  it('mix référence + texte (Jn 1 ; lumière) retourne UNION des deux', async () => {
    const { data } = await get<any>('/api/bible/search?q=Jean%201%3Blumi%C3%A8re&limit=100');
    expect(data.data.length).toBeGreaterThan(0);
    // Doit contenir des versets de Jean 1 (depuis la ref)
    expect(data.data.some((v: any) => v.bookName === 'Jean' && v.chapterNumber === 1)).toBe(true);
    // Doit contenir des versets avec "lumière" (potentiellement d'autres livres)
    expect(data.data.some((v: any) => v.content.toLowerCase().includes('lumi'))).toBe(true);
    // Pas de doublon d'uuid
    const uuids = data.data.map((v: any) => v.uuid);
    expect(new Set(uuids).size).toBe(uuids.length);
  });

  it('référence chapitre entier (Jn 3)', async () => {
    const { data } = await get<any>('/api/bible/search?q=Jean%203&limit=50');
    expect(data.data.length).toBeGreaterThan(0);
    for (const v of data.data) {
      expect(v.bookName).toBe('Jean');
      expect(v.chapterNumber).toBe(3);
    }
  });

  it('plage de versets (Jn 3:16-18)', async () => {
    const { data } = await get<any>('/api/bible/search?q=Jean%203%3A16-18&limit=10');
    expect(data.data.length).toBe(3);
    const nums = data.data.map((v: any) => v.verseNumber).sort((a: number, b: number) => a - b);
    expect(nums).toEqual([16, 17, 18]);
  });

  // ── Régression: "Jean 1:1" ne doit PAS faire une recherche texte sur "jean" ──

  it('référence exacte Jean 1:1 — retourne uniquement ce verset', async () => {
    const { data } = await get<any>('/api/bible/search?q=Jean%201%3A1&limit=500');
    expect(data.data.length).toBe(1);
    expect(data.data[0].bookName).toBe('Jean');
    expect(data.data[0].chapterNumber).toBe(1);
    expect(data.data[0].verseNumber).toBe(1);
  });

  it('référence exacte ne retourne pas de versets d\'autres livres contenant le même nom ("Jean")', async () => {
    const { data } = await get<any>('/api/bible/search?q=Jean%201%3A1&limit=500');
    // Tous les résultats doivent être dans Jean 1 — aucun 1 Maccabées ni autre livre
    expect(data.data.every((v: any) => v.bookName === 'Jean')).toBe(true);
  });

  it('référence avec alias (Jn 1:1) retourne le bon verset', async () => {
    const { data } = await get<any>('/api/bible/search?q=Jn%201%3A1&limit=5');
    expect(data.data.length).toBe(1);
    expect(data.data[0].bookName).toBe('Jean');
    expect(data.data[0].verseNumber).toBe(1);
  });

  it('texte contenant "jean" comme prénom — ne confond pas avec la référence Jn', async () => {
    // "jean" comme texte libre doit trouver des versets contenant ce mot
    const { data } = await get<any>('/api/bible/search?q=jean&limit=200');
    // Doit contenir plusieurs livres (1 Maccabées, etc. où "Jean" est un prénom)
    const books = new Set(data.data.map((v: any) => v.bookName));
    expect(books.size).toBeGreaterThan(1);
  });

  it('normalisation — recherche "Jesus" fonctionne malgré accents', async () => {
    const { data } = await get<any>('/api/bible/search?q=J%C3%A9sus&limit=20');
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data.every((v: any) => /j[eé]sus/i.test(v.content))).toBe(true);
  });
});

// ── Bible / search/hits ───────────────────────────────────────────────────────

describe('GET /api/bible/search/hits', () => {
  it('retourne { data: [{uuid, relType}] } pour une référence', async () => {
    const { data, ms } = await get<any>('/api/bible/search/hits?q=Jean%203%3A16');
    expect(data.data).toBeArray();
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0]).toMatchObject({ uuid: expect.any(String), relType: expect.any(String) });
    expect(ms).toBeLessThan(500);
  });

  it('retourne { data: [{uuid, relType}] } pour un texte', async () => {
    const { data } = await get<any>('/api/bible/search/hits?q=amour');
    expect(data.data).toBeArray();
    expect(data.data.length).toBeGreaterThan(0);
    expect(data.data[0]).toHaveProperty('uuid');
    expect(data.data[0]).toHaveProperty('relType');
  });

  it('retourne vide pour une requête trop courte', async () => {
    const { data } = await get<any>('/api/bible/search/hits?q=a');
    expect(data.data).toBeArray();
    expect(data.data.length).toBe(0);
  });

  it('mix ref + texte — union des uuids (Jean 1:2 ; ange du Seigneur ; Jean 1:3)', async () => {
    const { data } = await get<any>('/api/bible/search/hits?q=Jean%201%3A2%3Bange%20du%20Seigneur%3BJean%201%3A3');
    expect(data.data.length).toBeGreaterThan(0);
    // Les uuids de Jean 1:2 et Jean 1:3 doivent être présents
    const uuids = new Set(data.data.map((h: any) => h.uuid));
    expect(uuids.size).toBe(data.data.length); // pas de doublon
    // Des versets contenant "ange du Seigneur" doivent aussi apparaître
    // (on vérifie simplement qu'il y a plus que 2 résultats, les 2 refs étant incluses)
    expect(data.data.length).toBeGreaterThan(2);
  });

  it('texte seul — pas de filtrage aux livres de la ref', async () => {
    const { data: refOnly } = await get<any>('/api/bible/search/hits?q=Jean%201');
    const { data: textOnly } = await get<any>('/api/bible/search/hits?q=lumi%C3%A8re');
    // La recherche texte doit trouver des versets hors Jean
    expect(textOnly.data.length).toBeGreaterThan(0);
    // La recherche ref Jean 1 doit donner exactement les versets de Jean 1
    expect(refOnly.data.length).toBeGreaterThan(0);
    // Les deux ensembles de résultats doivent être différents
    const refUuids = new Set(refOnly.data.map((h: any) => h.uuid));
    const textUuids = new Set(textOnly.data.map((h: any) => h.uuid));
    expect([...textUuids].some(u => !refUuids.has(u))).toBe(true);
  });
});

// ── GeoMap ────────────────────────────────────────────────────────────────────

describe('GET /api/geomap', () => {
  it('retourne la liste des cartes', async () => {
    const { data, ms } = await get<any[]>('/api/geomap');
    expect(data).toBeArray();
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toMatchObject({ id: expect.any(String), label: expect.any(String) });
    expect(ms).toBeLessThan(200);
  });

  it('retourne le GeoJSON par id', async () => {
    const maps = (await get<any[]>('/api/geomap')).data;
    const id = maps[0].id;
    const { data, ms } = await get<any>(`/api/geomap/${id}`);
    expect(data.type).toBe('FeatureCollection');
    expect(data.features).toBeArray();
    expect(ms).toBeLessThan(1000);
  });

  it('retourne 404 pour un id inexistant', async () => {
    const res = await fetch(`${BASE}/api/geomap/inexistant_xxxx`);
    expect(res.status).toBe(404);
  });
});

// ── Biblical places ───────────────────────────────────────────────────────────

describe('GET /api/biblical-places', () => {
  it('retourne des lieux par verset (Gen.1)', async () => {
    const { data, ms } = await get<any[]>('/api/biblical-places/by-verse/Gen.1');
    expect(data).toBeArray();
    expect(ms).toBeLessThan(300);
  });

  it('retourne des lieux pour Jean.3', async () => {
    const { data } = await get<any[]>('/api/biblical-places/by-verse/Jean.3');
    // Peut être vide si aucun lieu indexé pour ce chapitre
    expect(data).toBeArray();
  });

  it('les lieux ont name et lonlat', async () => {
    const { data } = await get<any[]>('/api/biblical-places');
    expect(data.length).toBeGreaterThan(0);
    const place = data[0];
    expect(typeof place.name).toBe('string');
    expect(Array.isArray(place.lonlat)).toBe(true);
    expect(typeof place.lonlat[0]).toBe('number');
    expect(typeof place.lonlat[1]).toBe('number');
  });
});

// ── Patristic / persons ───────────────────────────────────────────────────────

describe('GET /api/patristic/persons', () => {
  it('retourne une liste paginée de personnes', async () => {
    const { data, ms } = await get<any>('/api/patristic/persons?limit=50');
    expect(data.data).toBeArray();
    expect(data.total).toBeGreaterThan(0);
    expect(data.limit).toBe(50);
    expect(data.offset).toBe(0);
    expect(ms).toBeLessThan(300);
  });

  it('chaque personne a les champs attendus', async () => {
    const { data } = await get<any>('/api/patristic/persons?limit=50');
    for (const author of data.data) {
      expect(author).toMatchObject({
        uuid:          expect.any(String),
        slug:          expect.any(String),
        nameFr:        expect.any(String),
        nameEn:        expect.any(String),
        born:          expect.any(Number),
        died:          expect.any(Number),
        tradition:     expect.any(String),
        abbreviations: expect.any(Array),
      });
    }
  });

  it('total correspond au nombre réel d\'auteurs (≈48)', async () => {
    const { data } = await get<any>('/api/patristic/persons?limit=100');
    expect(data.total).toBeGreaterThanOrEqual(40);
    expect(data.total).toBeLessThanOrEqual(100);
  });

  it('respecte limit et offset', async () => {
    const { data: p1 } = await get<any>('/api/patristic/persons?limit=3&offset=0');
    const { data: p2 } = await get<any>('/api/patristic/persons?limit=3&offset=3');
    expect(p1.data).toHaveLength(3);
    expect(p2.data.length).toBeGreaterThan(0);
    expect(p2.data[0].slug).not.toBe(p1.data[0].slug);
  });
});

// ── Patristic / author by slug ────────────────────────────────────────────────

describe('GET /api/patristic/persons/:slug', () => {
  it('retourne l\'auteur "augustine" avec tous ses champs', async () => {
    const { data, ms } = await get<any>('/api/patristic/persons/augustine');
    expect(data.slug).toBe('augustine');
    expect(typeof data.nameFr).toBe('string');
    expect(typeof data.nameEn).toBe('string');
    expect(typeof data.born).toBe('number');
    expect(typeof data.died).toBe('number');
    expect(Array.isArray(data.abbreviations)).toBe(true);
    expect(data.abbreviations.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(200);
  });

  it('retourne l\'auteur "chrysostom"', async () => {
    const { data } = await get<any>('/api/patristic/persons/chrysostom');
    expect(data.slug).toBe('chrysostom');
    expect(data.born).toBeLessThan(400);
  });

  it('retourne 404 pour un slug inconnu', async () => {
    const res = await fetch(`${BASE}/api/patristic/persons/inconnu-zzz`);
    expect(res.status).toBe(404);
  });
});

// ── Patristic / comments by author ───────────────────────────────────────────

describe('GET /api/patristic/persons/:slug/comments', () => {
  it('retourne des commentaires paginés pour "augustine"', async () => {
    const { data, ms } = await get<any>('/api/patristic/persons/augustine/comments?limit=10');
    expect(data.data).toBeArray();
    expect(data.total).toBeGreaterThan(0);
    expect(data.limit).toBe(10);
    expect(ms).toBeLessThan(500);
  });

  it('chaque commentaire a l\'auteur embedé et les champs obligatoires', async () => {
    const { data } = await get<any>('/api/patristic/persons/augustine/comments?limit=20');
    for (const c of data.data) {
      expect(c).toMatchObject({
        uuid:          expect.any(String),
        personUuid:    expect.any(String),
        collection:    expect.any(String),
        text:          expect.any(String),
        verseFromUuid: expect.any(String),
        verseToUuid:   expect.any(String),
      });
      // Auteur embedé — jamais undefined (les commentaires sans auteur connu sont filtrés)
      expect(c.person).toMatchObject({ slug: 'augustine', nameFr: expect.any(String) });
      // pageOrder présent et positif
      if (c.pageOrder != null) expect(c.pageOrder).toBeGreaterThan(0);
    }
  });

  it('les enfants (children) ont person embedé et ne figurent pas au top-level', async () => {
    const { data } = await get<any>('/api/patristic/persons/augustine/comments?limit=50');
    for (const c of data.data) {
      // Aucun top-level ne doit avoir un parentUuid
      expect(c.parentUuid).toBeUndefined();
      // Si des enfants existent, chacun a person embedé
      for (const child of c.children ?? []) {
        expect(child.person).toMatchObject({ slug: expect.any(String), nameFr: expect.any(String) });
        expect(typeof child.text).toBe('string');
      }
    }
  });

  it('le champ "source" quand présent a la bonne shape', async () => {
    const { data } = await get<any>('/api/patristic/persons/augustine/comments?limit=50');
    const withSource = data.data.filter((c: any) => c.source != null);
    for (const c of withSource) {
      expect(typeof c.source.name).toBe('string');
      if (c.source.date != null)              expect(typeof c.source.date).toBe('number');
      if (c.source.position != null)          expect(typeof c.source.position).toBe('number');
      if (c.source.publication_date != null)  expect(typeof c.source.publication_date).toBe('number');
    }
  });

  it('respecte limit et offset', async () => {
    const { data: p1 } = await get<any>('/api/patristic/persons/augustine/comments?limit=5&offset=0');
    const { data: p2 } = await get<any>('/api/patristic/persons/augustine/comments?limit=5&offset=5');
    expect(p1.data).toHaveLength(5);
    expect(p2.data.length).toBeGreaterThan(0);
    expect(p2.data[0].uuid).not.toBe(p1.data[0].uuid);
  });

  it('retourne vide (pas 404) pour un auteur sans commentaires ou inconnu', async () => {
    const res = await fetch(`${BASE}/api/patristic/persons/slug-inconnu-zzz/comments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total).toBe(0);
    expect(body.data).toHaveLength(0);
  });
});

// ── Patristic / comments by verse ────────────────────────────────────────────

describe('GET /api/patristic/verses/:uuid/comments', () => {
  // Récupère dynamiquement un UUID qui a des commentaires patristiques
  let verseUuid = '';

  beforeAll(async () => {
    const { data } = await get<any>('/api/patristic/persons/chrysostom/comments?limit=1');
    verseUuid = data.data[0]?.verseFromUuid ?? '';
  });

  it('retourne des commentaires pour un verset réel', async () => {
    if (!verseUuid) return;
    const { data, ms } = await get<any>(`/api/patristic/verses/${verseUuid}/comments?limit=20`);
    expect(data.data).toBeArray();
    expect(data.total).toBeGreaterThan(0);
    expect(ms).toBeLessThan(300);
  });

  it('tous les commentaires ont verseFromUuid === uuid demandé', async () => {
    if (!verseUuid) return;
    const { data } = await get<any>(`/api/patristic/verses/${verseUuid}/comments?limit=50`);
    for (const c of data.data) {
      expect(c.verseFromUuid).toBe(verseUuid);
    }
  });

  it('chaque commentaire a l\'auteur embedé', async () => {
    if (!verseUuid) return;
    const { data } = await get<any>(`/api/patristic/verses/${verseUuid}/comments?limit=20`);
    for (const c of data.data) {
      expect(c.person).toMatchObject({
        uuid:   expect.any(String),
        slug:   expect.any(String),
        nameFr: expect.any(String),
      });
    }
  });

  it('retourne 200 vide pour un UUID inexistant (pas 404)', async () => {
    const res = await fetch(`${BASE}/api/patristic/verses/00000000-0000-0000-0000-000000000000/comments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.total).toBe(0);
  });

  it('plusieurs auteurs différents peuvent commenter le même verset', async () => {
    if (!verseUuid) return;
    const { data } = await get<any>(`/api/patristic/verses/${verseUuid}/comments?limit=100`);
    const slugs = new Set(data.data.map((c: any) => c.person?.slug).filter(Boolean));
    // Un verset important peut avoir des commentaires de plusieurs Pères
    expect(slugs.size).toBeGreaterThanOrEqual(1);
  });
});

// ── Magistère / persons ───────────────────────────────────────────────────────
// Note : ces tests passent même si scrape:magistere n'a pas encore été lancé
// (le store retourne des listes vides sans erreur).

describe('GET /api/magistere/persons', () => {
  it('retourne 200 avec { data: [] } (même si pas encore scrapé)', async () => {
    const { data, ms } = await get<any>('/api/magistere/persons');
    expect(data.data).toBeArray();
    expect(ms).toBeLessThan(200);
  });

  it('si des auteurs existent, chacun a les champs obligatoires', async () => {
    const { data } = await get<any>('/api/magistere/persons');
    for (const a of data.data) {
      expect(a).toMatchObject({
        slug:      expect.any(String),
        name:      expect.any(String),
        type:      expect.stringMatching(/^(pope|council|dicastery)$/),
        tradition: 'catholic',
      });
    }
  });

  it('les papes ont pontificate_start', async () => {
    const { data } = await get<any>('/api/magistere/persons');
    const popes = data.data.filter((a: any) => a.type === 'pope');
    for (const p of popes) {
      expect(typeof p.pontificate_start).toBe('number');
    }
  });

  it('les conciles ont council_start et council_end', async () => {
    const { data } = await get<any>('/api/magistere/persons');
    const councils = data.data.filter((a: any) => a.type === 'council');
    for (const c of councils) {
      expect(typeof c.council_start).toBe('number');
      expect(typeof c.council_end).toBe('number');
    }
  });
});

// ── Magistère / author by slug ────────────────────────────────────────────────

describe('GET /api/magistere/persons/:slug', () => {
  it('retourne 404 pour un slug inconnu', async () => {
    const res = await fetch(`${BASE}/api/magistere/persons/inconnu-zzz`);
    expect(res.status).toBe(404);
  });

  it('si "francois" existe, retourne ses infos', async () => {
    const { data: authors } = await get<any>('/api/magistere/persons');
    if (!authors.data.find((a: any) => a.slug === 'francois')) return;
    const { data } = await get<any>('/api/magistere/persons/francois');
    expect(data.slug).toBe('francois');
    expect(data.type).toBe('pope');
    expect(data.pontificate_start).toBe(2013);
  });
});

// ── Magistère / documents ─────────────────────────────────────────────────────

describe('GET /api/magistere/documents', () => {
  it('retourne 200 avec { data: [] } (même si pas encore scrapé)', async () => {
    const { data, ms } = await get<any>('/api/magistere/documents');
    expect(data.data).toBeArray();
    expect(ms).toBeLessThan(200);
  });

  it('si des documents existent, chacun a les champs obligatoires', async () => {
    const { data } = await get<any>('/api/magistere/documents');
    for (const doc of data.data) {
      expect(doc).toMatchObject({
        abbr:          expect.any(String),
        name:          expect.any(String),
        url:           expect.any(String),
        year:          expect.any(Number),
        person_slug:   expect.any(String),
        comment_count: expect.any(Number),
      });
    }
  });

  it('filtre par auteur avec ?author=slug', async () => {
    const { data: all } = await get<any>('/api/magistere/documents');
    if (all.data.length === 0) return;
    const slug = all.data[0].person_slug;
    const { data: filtered } = await get<any>(`/api/magistere/documents?author=${slug}`);
    expect(filtered.data.length).toBeGreaterThan(0);
    expect(filtered.data.every((d: any) => d.person_slug === slug)).toBe(true);
    expect(filtered.data.length).toBeLessThanOrEqual(all.data.length);
  });

  it('documents triés par année croissante', async () => {
    const { data } = await get<any>('/api/magistere/documents');
    const years: number[] = data.data.map((d: any) => d.year);
    for (let i = 1; i < years.length; i++) {
      expect(years[i]).toBeGreaterThanOrEqual(years[i - 1]);
    }
  });
});

// ── Magistère / documents par auteur ─────────────────────────────────────────

describe('GET /api/magistere/persons/:slug/documents', () => {
  it('retourne 200 même si l\'auteur n\'a pas de documents', async () => {
    const res = await fetch(`${BASE}/api/magistere/persons/inconnu-zzz/documents`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeArray();
    expect(body.data.length).toBe(0);
  });

  it('tous les documents retournés appartiennent au bon auteur', async () => {
    const { data: docs } = await get<any>('/api/magistere/documents');
    if (docs.data.length === 0) return;
    const slug = docs.data[0].person_slug;
    const { data } = await get<any>(`/api/magistere/persons/${slug}/documents`);
    for (const d of data.data) {
      expect(d.person_slug).toBe(slug);
    }
  });
});

// ── Magistère / comments by verse ────────────────────────────────────────────

describe('GET /api/magistere/verses/:uuid/comments', () => {
  it('retourne 200 vide pour un UUID quelconque si pas encore scrapé', async () => {
    const res = await fetch(`${BASE}/api/magistere/verses/00000000-0000-0000-0000-000000000000/comments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeArray();
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it('si des commentaires existent pour un verset, chacun a l\'auteur embedé', async () => {
    // Chercher un verset uuid réel via un commentaire existant
    const { data: docs } = await get<any>('/api/magistere/documents');
    if (docs.data.length === 0) return;
    const abbr = docs.data[0].abbr;
    const { data: docComments } = await get<any>(`/api/magistere/documents/${abbr}/comments?limit=1`);
    if (docComments.data.length === 0) return;
    const verseUuid = docComments.data[0].verse_uuids?.[0];
    if (!verseUuid) return;
    const { data } = await get<any>(`/api/magistere/verses/${verseUuid}/comments?limit=20`);
    expect(data.data.length).toBeGreaterThan(0);
    for (const c of data.data) {
      expect(c.person).toMatchObject({ slug: expect.any(String), name: expect.any(String) });
      expect(Array.isArray(c.verse_uuids)).toBe(true);
      expect(c.verse_uuids).toContain(verseUuid);
    }
  });

  it('respecte la pagination', async () => {
    const { data: docs } = await get<any>('/api/magistere/documents');
    if (docs.data.length === 0) return;
    const abbr = docs.data[0].abbr;
    const { data: all } = await get<any>(`/api/magistere/documents/${abbr}/comments?limit=5&offset=0`);
    if (all.total < 2) return;
    const { data: p2 } = await get<any>(`/api/magistere/documents/${abbr}/comments?limit=5&offset=5`);
    if (p2.data.length === 0) return;
    expect(p2.data[0].paragraph).not.toBe(all.data[0].paragraph);
  });
});

// ── Magistère / comments by document ─────────────────────────────────────────

describe('GET /api/magistere/documents/:abbr/comments', () => {
  it('retourne 200 vide pour une abréviation inconnue', async () => {
    const res = await fetch(`${BASE}/api/magistere/documents/ZZZNOPE/comments`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toBeArray();
    expect(body.total).toBe(0);
  });

  it('si EG existe, retourne ses commentaires avec l\'auteur embedé', async () => {
    const { data } = await get<any>('/api/magistere/documents/EG/comments?limit=10');
    if (data.total === 0) return; // pas encore scrapé
    expect(data.data.length).toBeGreaterThan(0);
    for (const c of data.data) {
      expect(c.document_abbr).toBe('EG');
      expect(c.person).toMatchObject({ slug: 'francois' });
      expect(typeof c.text).toBe('string');
      expect(c.text.length).toBeGreaterThan(0);
      expect(Array.isArray(c.verse_uuids)).toBe(true);
    }
  });

  it('insensible à la casse de l\'abréviation', async () => {
    const { data: upper } = await get<any>('/api/magistere/documents/EG/comments?limit=5');
    const { data: lower } = await get<any>('/api/magistere/documents/eg/comments?limit=5');
    expect(upper.total).toBe(lower.total);
  });

  it('chaque commentaire a year, document_name, document_url', async () => {
    const { data: docs } = await get<any>('/api/magistere/documents');
    if (docs.data.length === 0) return;
    const abbr = docs.data[0].abbr;
    const { data } = await get<any>(`/api/magistere/documents/${abbr}/comments?limit=5`);
    for (const c of data.data) {
      expect(typeof c.year).toBe('number');
      expect(typeof c.document_name).toBe('string');
      expect(typeof c.document_url).toBe('string');
    }
  });
});
