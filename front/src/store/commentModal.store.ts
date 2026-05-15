import { create } from 'zustand';
import type { LeanVerse } from '@/types/bibleDrawer.ts';

export interface CommentModalTarget {
  verseIdx:   number;
  verses:     LeanVerse[];
  bookName:   string;
  chapterNum: number;
}

interface CommentModalStore {
  target: CommentModalTarget | null;
  open:   (t: CommentModalTarget) => void;
  close:  () => void;
}

export const useCommentModalStore = create<CommentModalStore>(set => ({
  target: null,
  open:   t  => set({ target: t }),
  close:  () => set({ target: null }),
}));
