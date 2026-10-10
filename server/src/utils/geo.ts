// Straight-line distance in metres between two points (haversine).
export function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// "Near Ameerpet metro station, Ameerpet" -> "Ameerpet". Typed landmarks vary, so this is best effort.
export const areaOf = (address?: string | null) => {
  const tail = address?.split(",").map((s) => s.trim()).filter(Boolean).pop();
  return tail && tail.length <= 40 ? tail : "Unnamed area";
};
