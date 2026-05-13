/**
 * Module-level request cache.
 * - in-flight dedup : si deux composants demandent la même URL au même moment,
 *   une seule requête HTTP part ; les deux reçoivent la même Promise.
 * - result cache    : après résolution, les appels suivants sont synchrones.
 */

const results  = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

export function fetchOnce<T>(url: string): Promise<T> {
  if (results.has(url))  return Promise.resolve(results.get(url) as T);
  if (inflight.has(url)) return inflight.get(url) as Promise<T>;

  const p = fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<T>;
    })
    .then(data => {
      results.set(url, data);
      inflight.delete(url);
      return data;
    })
    .catch(err => {
      inflight.delete(url);
      throw err;
    });

  inflight.set(url, p);
  return p;
}

/** Invalide une entrée (utile après mutation). */
export function invalidate(url: string) {
  results.delete(url);
  inflight.delete(url);
}

/** Vide tout le cache (ex: logout). */
export function clearCache() {
  results.clear();
  inflight.clear();
}
