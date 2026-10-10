import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type LatLng = { lat: number; lng: number };

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

function ClickHandler({ onPick }: { onPick: (point: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 17);
  }, [target, map]);
  return null;
}

type Props = {
  value: LatLng | null;
  onChange: (point: LatLng) => void;
  flyTarget: LatLng | null;
  // Where the map opens, e.g. the user's home spot. Defaults to the whole of India.
  start?: LatLng | null;
  className?: string;
};

export function LocationPicker({ value, onChange, flyTarget, start, className = "h-80" }: Props) {
  const first = value ?? start;
  return (
    <MapContainer
      center={first ? [first.lat, first.lng] : INDIA_CENTER}
      zoom={first ? 16 : 5}
      className={`z-0 w-full rounded-2xl border border-ink/15 shadow-card ${className}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onChange} />
      <FlyTo target={flyTarget} />
      {value && (
        <CircleMarker
          center={[value.lat, value.lng]}
          radius={10}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#e0a100", fillOpacity: 1 }}
        />
      )}
    </MapContainer>
  );
}
