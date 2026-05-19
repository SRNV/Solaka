import { create } from 'zustand';

interface Toast {
  id:      number;
  message: string;
}

interface ToastStore {
  toasts:     Toast[];
  addToast:   (message: string) => void;
  removeToast:(id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>(set => ({
  toasts: [],
  addToast: (message) => {
    const id = nextId++;
    set(s => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 6000);
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
