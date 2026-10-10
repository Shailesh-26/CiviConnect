type P = { lat: number; lng: number };

// Straight-line distance in km (haversine).
export function km(a: P, b: P) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Order of today's stops: start at the most urgent issue, then always go to the nearest
 * unvisited one (nearest-neighbour). Simple, fast and good enough for a day's rounds.
 */
export function planRoute<T extends { location: P }>(stops: T[]): { order: T[]; totalKm: number } {
  if (stops.length === 0) return { order: [], totalKm: 0 };
  const left = [...stops.slice(1)];
  const order = [stops[0]];
  let totalKm = 0;
  while (left.length) {
    const here = order[order.length - 1].location;
    let best = 0;
    for (let i = 1; i < left.length; i++) if (km(here, left[i].location) < km(here, left[best].location)) best = i;
    totalKm += km(here, left[best].location);
    order.push(left.splice(best, 1)[0]);
  }
  return { order, totalKm };
}
