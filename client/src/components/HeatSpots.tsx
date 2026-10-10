import { useEffect } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { categoryMeta } from "../lib/constants";
import type { AnalyticsData } from "../types";

type Spot = AnalyticsData["hotspots"][number];

function Fit({ spots }: { spots: Spot[] }) {
  const map = useMap();
  const n = spots.length;
  useEffect(() => {
    if (!n || map.getSize().x === 0) return;
    map.fitBounds(L.latLngBounds(spots.map((s) => [s.lat, s.lng] as [number, number])), { padding: [30, 30], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, map]);
  return null;
}

// Soft glows for open issues: overlapping glows build up where problems cluster.
export function HeatSpots({ spots, className = "h-80" }: { spots: Spot[]; className?: string }) {
  return (
    <MapContainer center={[17.43, 78.45]} zoom={11} scrollWheelZoom={false} className={`z-0 w-full rounded-2xl ${className}`}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit spots={spots} />
      {spots.map((s) => {
        const color = s.priority >= 70 ? "#b83a2e" : s.priority >= 40 ? "#e0a100" : "#2a78d6";
        return (
          <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={8 + (s.priority / 100) * 18} pathOptions={{ stroke: false, fillColor: color, fillOpacity: 0.28 }}>
            <Tooltip>{categoryMeta(s.category).label} · priority {s.priority}</Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
