/**
 * Address search through OpenStreetMap Nominatim, called from the server so we can follow its
 * usage policy: an identifying User-Agent, at most one request per second, and caching.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "CiviConnect/1.0 (academic civic-issue project; https://github.com/Shailesh-26/CiviConnect)";
const DAY = 86_400_000;

const cache = new Map<string, { at: number; value: unknown }>();
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

function remember(key: string, value: unknown) {
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
}

// Requests wait in line so we never send more than one per second.
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function fetchJson(url: string) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < DAY) return hit.value;
  const value = await throttled(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-IN,en" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Nominatim answered ${res.status}`);
    return res.json();
  });
  remember(url, value);
  return value;
}

// "Shop 4, Ameerpet Main Road, Ameerpet, Hyderabad, Telangana, 500016, India" -> first 3 parts.
const shortName = (display: string) => display.split(",").slice(0, 3).map((s) => s.trim()).join(", ");

export async function searchPlaces(q: string, near?: { lat: number; lng: number }) {
  const params = new URLSearchParams({ q, format: "jsonv2", countrycodes: "in", limit: "6" });
  if (near) {
    // Prefer results around the user without excluding the rest of India.
    const d = 0.35;
    params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const rows = (await fetchJson(`${BASE}/search?${params}`)) as { display_name: string; lat: string; lon: string }[];
  return rows.map((r) => ({ label: shortName(r.display_name), full: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}

export async function reversePlace(lat: number, lng: number) {
  const params = new URLSearchParams({ lat: lat.toFixed(6), lon: lng.toFixed(6), format: "jsonv2", zoom: "18" });
  const row = (await fetchJson(`${BASE}/reverse?${params}`)) as { display_name?: string } | null;
  return row?.display_name ? { label: shortName(row.display_name), full: row.display_name } : null;
}
