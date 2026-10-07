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
};

export function LocationPicker({ value, onChange, flyTarget }: Props) {
  return (
    <MapContainer center={INDIA_CENTER} zoom={5} className="h-80 w-full rounded-lg border border-ink/20">
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
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#1f4e79", fillOpacity: 1 }}
        />
      )}
    </MapContainer>
  );
}
