import type { RelRow } from '@/store/relations.store.ts';
import type { ChildResult, LeanVerse, VerseListItem } from '@/models/bibleDrawer';

export const TRAD_LIMIT = 5;
export const EMPTY_SET  = new Set<string>();

const REL_PRIORITY: Record<string, number> = {
  authority: 0, citation: 1, fulfillment: 2, typology: 3,
  allusion: 4, parallel: 5, thematic: 6,
};

function relPrio(r: RelRow) { return REL_PRIORITY[r.relType] ?? 7; }

export function sortRels(rels: RelRow[]): RelRow[] {
  return [...rels].sort((a, b) => {
    const p = relPrio(a) - relPrio(b);
    if (p !== 0) return p;
    return (a.trad === 'c' ? 0 : 1) - (b.trad === 'c' ? 0 : 1);
  });
}

export function badgeLabel(r: RelRow): string {
  if (!r.toFromRef) return r.toFrom.slice(0, 8);
  const { bookName, chapterNumber, verseNumber } = r.toFromRef;
  if (r.isRange && r.toToRef && r.toToRef.verseNumber !== verseNumber)
    return `${bookName} ${chapterNumber}:${verseNumber}–${r.toToRef.verseNumber}`;
  return `${bookName} ${chapterNumber}:${verseNumber}`;
}

export function relKey(r: RelRow) { return `${r.toFrom}|${r.toTo}|${r.relType}|${r.trad}`; }

export function collectVerses(items: VerseListItem[]): LeanVerse[] {
  const out: LeanVerse[] = [];
  for (const it of items) {
    if (it.type === 'solo') out.push(it.verse);
    else out.push(...collectVerses(it.items));
  }
  return out;
}

export function buildGroupItems(
  verses:     LeanVerse[],
  relsByVerse: Map<string, RelRow[]>,
  suppressed: ReadonlySet<string> = EMPTY_SET,
): VerseListItem[] {
  const items: VerseListItem[] = [];
  let i = 0;
  while (i < verses.length) {
    const verse = verses[i];
    const rels  = (relsByVerse.get(verse.uuid) ?? []).filter(r => !suppressed.has(r.toFrom));
    if (rels.length === 0) { items.push({ type: 'solo', verse }); i++; continue; }

    let inter = new Map<string, RelRow>(rels.map(r => [relKey(r), r]));
    let j = i + 1;
    while (j < verses.length) {
      const nxt     = (relsByVerse.get(verses[j].uuid) ?? []).filter(r => !suppressed.has(r.toFrom));
      const nxtKeys = new Set(nxt.map(relKey));
      const narrowed = new Map([...inter].filter(([k]) => nxtKeys.has(k)));
      if (narrowed.size === 0) break;
      inter = narrowed;
      j++;
    }

    if (j - i <= 1) { items.push({ type: 'solo', verse }); i++; continue; }

    const sharedRels    = sortRels([...inter.values()]);
    const newSuppressed = new Set([...suppressed, ...sharedRels.map(r => r.toFrom)]);
    const subItems      = buildGroupItems(verses.slice(i, j), relsByVerse, newSuppressed);
    items.push({ type: 'group', sharedRels, items: subItems, firstVerse: verse });
    i = j;
  }
  return items;
}

export async function fetchVerseByUuid(uuid: string): Promise<ChildResult | null> {
  const res = await fetch(`/api/bible/verses/${encodeURIComponent(uuid)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    verse: { uuid: data.uuid, number: data.number, content: data.content },
    bookName: data.bookName,
    chapterNumber: data.chapterNumber,
  };
}

export async function fetchVersesByRel(rel: RelRow): Promise<ChildResult[]> {
  if (!rel.toFromRef) return [];
  if (rel.isRange && rel.toToRef) {
    const { bookName, chapterNumber } = rel.toFromRef;
    const r = await fetch(`/api/bible/books/${encodeURIComponent(bookName)}/chapters/${chapterNumber}`);
    if (!r.ok) return [];
    const data = await r.json();
    const ch       = data.chapter ?? {};
    const fromNum  = rel.toFromRef.verseNumber;
    const toNum    = rel.toToRef.verseNumber;
    const verses: LeanVerse[] = (ch.verses ?? []).filter((v: LeanVerse) => v.number >= fromNum && v.number <= toNum);
    return verses.map(v => ({ verse: v, bookName, chapterNumber, summary: ch.summary }));
  }
  const result = await fetchVerseByUuid(rel.toFrom);
  return result ? [result] : [];
}
