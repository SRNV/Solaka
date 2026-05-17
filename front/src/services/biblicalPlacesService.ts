import type { BiblicalPlace } from '@/models/api';

export type { BiblicalPlace };

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const biblicalPlacesService = {
  getAll: async (): Promise<BiblicalPlace[]> => {
    const response = await fetch(`${API_URL}/biblical-places`);
    if (!response.ok) throw new Error('Failed to fetch biblical places');
    return response.json();
  },

  getByVerse: async (osis: string): Promise<BiblicalPlace[]> => {
    const response = await fetch(`${API_URL}/biblical-places/by-verse/${osis}`);
    if (!response.ok) throw new Error('Failed to fetch biblical places by verse');
    return response.json();
  }
};
