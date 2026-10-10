import { useEffect } from "react";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "./LocationPicker";

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

function Picker({ onPick }: { onPick: (point: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

// Zooms so the whole neighbourhood circle is in view whenever the home or radius changes.
function FitCircle({ home, radiusKm }: { home: LatLng | null; radiusKm: number }) {
  const map = useMap();
  useEffect(() => {
    if (!home) return;
    const bounds = L.latLng(home.lat, home.lng).toBounds(radiusKm * 2000);
    map.flyToBounds(bounds, { padding: [24, 24], duration: 0.6 });
  }, [home, radiusKm, map]);
  return null;
}

// Home pin plus the radius the Neighbourhood feed will cover. Tap the map to move home.
export function HomeAreaMap({ home, radiusKm, onPick }: { home: LatLng | null; radiusKm: number; onPick: (p: LatLng) => void }) {
  return (
    <MapContainer center={home ? [home.lat, home.lng] : INDIA_CENTER} zoom={home ? 13 : 5} className="z-0 h-64 w-full rounded-2xl border border-ink/15">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Picker onPick={onPick} />
      <FitCircle home={home} radiusKm={radiusKm} />
      {home && (
        <>
          <Circle center={[home.lat, home.lng]} radius={radiusKm * 1000} pathOptions={{ color: "#1f4e79", weight: 2, fillColor: "#2a7f9e", fillOpacity: 0.12, dashArray: "6 6" }} />
          <CircleMarker center={[home.lat, home.lng]} radius={9} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#e0a100", fillOpacity: 1 }} />
        </>
      )}
    </MapContainer>
  );
}
