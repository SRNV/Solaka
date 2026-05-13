import type { BibleStructureBook } from '@/types/bible.ts';
import type { BibleTarget } from '@/contexts/BibleDrawerContext.tsx';
import { CUBE_S, V_STEP, CH_STEP, BK_PAD } from './graphConstants.ts';

/** 3-D world-space position of a verse cube. */
export interface Pos3 { x: number; y: number; z: number; }

/** Full output of {@link computeLayout}: positions, labels, and lookup maps for the scene. */
export interface LayoutResult {
  /** Total number of verse cube instances (sum of all uuids across all chapters). */
  totalInstances: number;
  /** World X extent of the entire Bible (used to centre the camera and the hover plane). */
  totalX:         number;
  /** World Y of the tallest verse tower top (used to derive arc peak floors). */
  maxTowerY:      number;
  /** Maximum chapter Z offset (reserved for future depth sorting). */
  maxChZ:         number;
  /** One entry per book: name, canonical number, centre X, and X span. */
  bookLabels:     { name: string; number: number; cx: number; startX: number; endX: number }[];
  /** Maps verse UUID → world-space position. */
  uuidPosMap:     Map<string, Pos3>;
  /** Maps verse UUID → human-readable Bible reference (book / chapter / verse). */
  uuidRefMap:     Map<string, BibleTarget>;
  /** Ordered list of UUIDs matching `InstancedMesh` instance indices. */
  instanceUuids:  string[];
  /** Maps `"bookNumber:chapterNumber"` → world Z offset of that chapter column. */
  chapZMap:        Map<string, number>;
}

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
