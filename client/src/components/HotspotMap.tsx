import { useEffect } from "react";
import L from "leaflet";
import { Circle, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Issue } from "../types";

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

function FitToIssues({ issues }: { issues: Issue[] }) {
  const map = useMap();
  useEffect(() => {
    if (issues.length === 0) return;
    const bounds = L.latLngBounds(issues.map((i) => [i.location.lat, i.location.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  }, [issues, map]);
  return null;
}

// Overlapping translucent discs: where many open issues sit close together, the colour builds up.
export function HotspotMap({ issues }: { issues: Issue[] }) {
  const open = issues.filter((i) => i.status !== "resolved" && i.status !== "rejected");

  return (
    <MapContainer center={INDIA_CENTER} zoom={5} className="z-0 h-[26rem] w-full rounded-2xl border border-ink/15 shadow-card">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToIssues issues={open} />
      {open.map((issue) => (
        <Circle
          key={issue.id}
          center={[issue.location.lat, issue.location.lng]}
          radius={90 + issue.reportCount * 25}
          pathOptions={{
            stroke: false,
            fillColor: issue.priorityLabel === "high" ? "#b83a2e" : issue.priorityLabel === "medium" ? "#e0a100" : "#2f73b3",
            fillOpacity: 0.22,
          }}
        />
      ))}
    </MapContainer>
  );
}
