import type { RelRow } from '@/store/relations.store.ts';

export interface LeanVerse  { uuid: string; number: number; content: string; }
export interface ChildResult { verse: LeanVerse; bookName: string; chapterNumber: number; summary?: string; }

export interface SoloItem  { type: 'solo';  verse: LeanVerse }
export interface GroupItem { type: 'group'; sharedRels: RelRow[]; items: VerseListItem[]; firstVerse: LeanVerse }
export type VerseListItem  = SoloItem | GroupItem
