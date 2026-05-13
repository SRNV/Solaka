// Module-level cache — persists for the lifetime of the session.
// Keyed by geomap id; stores the full accumulated feature list.
const cache = new Map<string, GeoJSON.Feature[]>();

export const mapFeaturesCache = {
  has: (id: string) => cache.has(id),
  get: (id: string) => cache.get(id) ?? [],
  append: (id: string, batch: GeoJSON.Feature[]) => {
    const prev = cache.get(id) ?? [];
    cache.set(id, [...prev, ...batch]);
    return cache.get(id)!;
  },
  set: (id: string, features: GeoJSON.Feature[]) => cache.set(id, features),
};
