/**
 * Nominatim (OpenStreetMap) geocoder with a localStorage cache.
 *
 * Nominatim's usage policy:
 *   - max 1 request/sec/IP
 *   - send a unique User-Agent header (browsers won't let us override this,
 *     but they do send `Origin` which is good enough for low-volume use)
 *   - cache results aggressively (we do — forever, in localStorage)
 */

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const CACHE_KEY = "por-audit:geocode-cache:v1";

export interface LatLng {
  lat: number;
  lng: number;
}

type CacheShape = Record<string, LatLng | null>;

function readCache(): CacheShape {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CacheShape;
  } catch {
    return {};
  }
}

function writeCache(cache: CacheShape): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota / private-mode — ignore.
  }
}

let inFlight = Promise.resolve();

/**
 * Rate-limited geocode. Serializes requests at ≤1/sec, caches everything.
 * Returns `null` if Nominatim has no match (so the UI can skip the marker).
 */
export async function geocode(location: string): Promise<LatLng | null> {
  const key = location.trim().toLowerCase();
  if (!key) return null;

  const cache = readCache();
  if (key in cache) return cache[key] ?? null;

  // Chain onto the inFlight queue so we throttle.
  const next = inFlight.then(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const url = `${NOMINATIM_BASE}?format=json&limit=1&q=${encodeURIComponent(location)}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      const hit = data[0];
      if (!hit) {
        cache[key] = null;
        writeCache(cache);
        return null;
      }
      const out: LatLng = { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
      cache[key] = out;
      writeCache(cache);
      return out;
    } catch {
      // Network errors — don't poison the cache.
      return null;
    }
  });

  inFlight = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Sync read of a cached entry — useful for fast non-blocking renders. */
export function getCachedLatLng(location: string): LatLng | null {
  const key = location.trim().toLowerCase();
  const cache = readCache();
  return cache[key] ?? null;
}
