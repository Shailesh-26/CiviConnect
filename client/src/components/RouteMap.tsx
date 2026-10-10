import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { issueLabel } from "../lib/constants";
import type { Issue } from "../types";

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length || map.getSize().x === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
  }, [points, map]);
  return null;
}

const numberPin = (n: number, color: string) =>
  L.divIcon({
    className: "cc-pin",
    html: `<div class="pin" style="background:${color};width:32px;height:32px"><span style="font:700 13px var(--font-sans);color:#fff">${n}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

// Today's stops in visiting order, joined by a dashed line.
export function RouteMap({ stops, className = "h-80" }: { stops: Issue[]; className?: string }) {
  const navigate = useNavigate();
  const points = stops.map((s) => [s.location.lat, s.location.lng] as [number, number]);
  return (
    <MapContainer center={points[0] ?? [17.43, 78.45]} zoom={12} scrollWheelZoom={false} className={`z-0 w-full rounded-2xl ${className}`}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit points={points} />
      {points.length > 1 && <Polyline positions={points} pathOptions={{ color: "#1f4e79", weight: 3, dashArray: "8 8", opacity: 0.8 }} />}
      {stops.map((s, i) => (
        <Marker
          key={s.id}
          position={[s.location.lat, s.location.lng]}
          icon={numberPin(i + 1, s.sla.state === "breached" ? "#b83a2e" : s.sla.state === "warning" ? "#c98500" : "#1f4e79")}
          eventHandlers={{ click: () => navigate(`/issues/${s.id}`) }}
        >
          <Tooltip direction="top" offset={[0, -30]}>{i + 1}. {issueLabel(s)}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
