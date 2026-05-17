import type { BibleStructureBook } from '@/models/bible';
import type { BibleTarget } from '@/models/contexts';
import type { Pos3, LayoutResult } from '@/models/graph';
import { CUBE_S, V_STEP, CH_STEP, BK_PAD } from './graphConstants.ts';

export type { Pos3, LayoutResult };

/**
 * Derive world-space positions for every verse cube from the Bible structure API response.
 *
 * Books are laid out left-to-right along the X axis; verses stack vertically (Y) within each
 * chapter column.  All Z values are 0 in the current implementation (reserved for future
 * depth layers).
 *
 * @param data - Ordered array of books from the `/structure` API.
 * @returns Full {@link LayoutResult} consumed by the graph scene.
 */
export function computeLayout(data: BibleStructureBook[]): LayoutResult {
  let x = 0;
  let maxVerseCount = 0;
  const maxChZ      = 0;
  const bookLabels:    { name: string; number: number; cx: number; startX: number; endX: number }[] = [];
  const uuidPosMap    = new Map<string, Pos3>();
  const uuidRefMap    = new Map<string, BibleTarget>();
  const instanceUuids: string[] = [];
  const chapZMap      = new Map<string, number>();

  for (const book of data) {
    if (!book?.chapters?.length) { x += BK_PAD; continue; }
    const startX = x;
    for (const ch of book.chapters) {
      if (!ch) { x += CH_STEP; continue; }
      chapZMap.set(`${book.number}:${ch.number}`, 0);

      const uuids = ch.uuids ?? [];
      const count = uuids.length || (ch.verseCount ?? 0);
      if (count > maxVerseCount) maxVerseCount = count;

      const verseNumbers = ch.verseNumbers ?? [];
      for (let i = 0; i < uuids.length; i++) {
        uuidPosMap.set(uuids[i], { x, y: CUBE_S / 2 + i * V_STEP, z: 0 });
        uuidRefMap.set(uuids[i], { book: book.name, chapter: ch.number, verse: verseNumbers[i] ?? i + 1 });
        instanceUuids.push(uuids[i]);
      }
      x += CH_STEP;
    }
    bookLabels.push({ name: book.name, number: book.number, cx: (startX + x - CH_STEP) / 2, startX, endX: x - CH_STEP });
    x += BK_PAD;
  }

  const totalInstances = data.reduce(
    (s, b) => s + (b?.chapters ?? []).reduce((cs, ch) => cs + (ch?.uuids?.length ?? ch?.verseCount ?? 0), 0), 0,
  );
  const maxTowerY = CUBE_S / 2 + (maxVerseCount - 1) * V_STEP + CUBE_S / 2;

  return { totalInstances, totalX: x, maxTowerY, maxChZ, bookLabels, uuidPosMap, uuidRefMap, instanceUuids, chapZMap };
}
