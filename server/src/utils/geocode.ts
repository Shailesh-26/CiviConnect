/**
 * Address search and reverse lookup, called from the server so we can cache and stay polite.
 *  - Search-as-you-type uses Photon (photon.komoot.io), built on OpenStreetMap data and meant for
 *    suggestions while typing. Nominatim's policy does not allow that, so it is only the fallback.
 *  - Reverse lookup (pin -> address) uses Nominatim: identifying User-Agent, at most one request
 *    per second, cached. https://operations.osmfoundation.org/policies/nominatim/
 */
const PHOTON = "https://photon.komoot.io/api/";
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

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
};

// One Photon result -> our Place. Short label = the most specific 3 parts ("Ameerpet Metro Station, Ameerpet, Hyderabad").
export function photonToPlace(f: PhotonFeature) {
  const p = f.properties ?? {};
  const [lng, lat] = f.geometry?.coordinates ?? [];
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const parts = [p.name, street, p.locality, p.district, p.city ?? p.county, p.state, p.postcode, p.country]
    .map((x) => x?.trim())
    .filter((x, i, all): x is string => Boolean(x) && all.indexOf(x) === i);
  if (parts.length === 0) return null;
  return { label: parts.slice(0, 3).join(", "), full: parts.join(", "), lat, lng };
}

const photonCache = new Map<string, { at: number; value: ReturnType<typeof photonToPlace>[] }>();
let lastPhoton = 0;

async function searchPhoton(q: string, near?: { lat: number; lng: number }) {
  const params = new URLSearchParams({ q, limit: "15", lang: "en" });
  // Bias towards the user (or Hyderabad) without excluding the rest of India.
  params.set("lat", String(near?.lat ?? 17.385));
  params.set("lon", String(near?.lng ?? 78.4867));
  const url = `${PHOTON}?${params}`;
  const hit = photonCache.get(url);
  if (hit && Date.now() - hit.at < DAY) return hit.value;
  // Gentle spacing between requests; typing pauses are short, but the service is free.
  const wait = lastPhoton + 250 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastPhoton = Date.now();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Photon answered ${res.status}`);
  const body = (await res.json()) as { features?: PhotonFeature[] };
  const places = (body.features ?? []).filter((f) => (f.properties?.countrycode ?? "IN").toUpperCase() === "IN").map(photonToPlace);
  if (photonCache.size > 500) photonCache.delete(photonCache.keys().next().value!);
  photonCache.set(url, { at: Date.now(), value: places });
  return places;
}

async function searchNominatim(q: string, near?: { lat: number; lng: number }) {
  const params = new URLSearchParams({ q, format: "jsonv2", countrycodes: "in", limit: "8" });
  if (near) {
    const d = 0.35;
    params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const rows = (await fetchJson(`${BASE}/search?${params}`)) as { display_name: string; lat: string; lon: string }[];
  return rows.map((r) => ({ label: shortName(r.display_name), full: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}

export async function searchPlaces(q: string, near?: { lat: number; lng: number }) {
  let places: { label: string; full: string; lat: number; lng: number }[] = [];
  try {
    places = (await searchPhoton(q, near)).filter((p): p is NonNullable<typeof p> => p !== null);
  } catch {
    places = [];
  }
  if (places.length === 0) places = await searchNominatim(q, near);
  // Same spot listed twice (e.g. a station and its entrance) -> keep the first.
  const seen = new Set<string>();
  return places.filter((p) => {
    const key = `${p.label}|${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}

export async function reversePlace(lat: number, lng: number) {
  const params = new URLSearchParams({ lat: lat.toFixed(6), lon: lng.toFixed(6), format: "jsonv2", zoom: "18" });
  const row = (await fetchJson(`${BASE}/reverse?${params}`)) as { display_name?: string } | null;
  return row?.display_name ? { label: shortName(row.display_name), full: row.display_name } : null;
}
