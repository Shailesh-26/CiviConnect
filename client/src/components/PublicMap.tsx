import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { issueLabel } from "../lib/constants";
import { StatusBadge } from "./StatusBadge";
import { makePin } from "../lib/pins";
import type { PublicOverview } from "../types";

type Pin = PublicOverview["pins"][number];

function Fit({ pins }: { pins: Pin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    map.fitBounds(L.latLngBounds(pins.map((p) => [p.location.lat, p.location.lng] as [number, number])), { padding: [30, 30], maxZoom: 13 });
  }, [pins, map]);
  return null;
}

// Anonymous map for the landing page: only category, status and report count are shown.
export function PublicMap({ pins, className = "h-[26rem]" }: { pins: Pin[]; className?: string }) {
  return (
    <MapContainer center={[20.5937, 78.9629]} zoom={5} scrollWheelZoom={false} className={`z-0 w-full rounded-2xl ${className}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Fit pins={pins} />
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.location.lat, pin.location.lng]}
          icon={makePin(pin.category, pin.status === "resolved" ? "#2e7d5b" : pin.status === "rejected" ? "#6b7280" : "#c2561f", 30, pin.customIcon)}
        >
          <Popup>
            <p className="font-display text-base font-semibold">{issueLabel(pin)}</p>
            <p className="mt-0.5 text-xs text-ink/55">{pin.ticket}</p>
            <p className="mt-2 flex items-center gap-2 text-xs">
              <StatusBadge status={pin.status} />
              <span className="text-ink/65">{pin.reportCount} {pin.reportCount === 1 ? "report" : "reports"}</span>
            </p>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
