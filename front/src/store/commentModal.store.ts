import { create } from 'zustand';
import type { CommentModalTarget, CommentModalStore } from '@/models/stores';

export type { CommentModalTarget };

export const useCommentModalStore = create<CommentModalStore>(set => ({
  target: null,
  open:   t  => set({ target: t }),
  close:  () => set({ target: null }),
}));
