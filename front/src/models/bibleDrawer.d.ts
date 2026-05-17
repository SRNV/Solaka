import type { LeanVerse } from './bible';
import type { RelRow } from './stores';

export type { LeanVerse };

export interface ChildResult {
  verse: LeanVerse;
  bookName: string;
  chapterNumber: number;
  summary?: string;
}

export interface SoloItem  { type: 'solo';  verse: LeanVerse }
export interface GroupItem { type: 'group'; sharedRels: RelRow[]; items: VerseListItem[]; firstVerse: LeanVerse }
export type VerseListItem  = SoloItem | GroupItem
