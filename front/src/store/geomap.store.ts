import { fetchOnce } from './apiCache.ts';
import type { GeoMap } from '@/models/api';

export const geomapStore = {
  list: () =>
    fetchOnce<GeoMap[]>('/api/geomap'),

  byId: (id: string) =>
    fetchOnce<unknown>(`/api/geomap/${id}`),
};
