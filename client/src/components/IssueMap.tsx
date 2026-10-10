import { useEffect } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { categoryMeta, PRIORITY_META, STATUS_META } from "../lib/constants";
import { makePin } from "../lib/pins";
import type { Issue } from "../types";

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

function FitToIssues({ issues }: { issues: Issue[] }) {
  const map = useMap();
  useEffect(() => {
    if (issues.length === 0) return;
    const bounds = L.latLngBounds(issues.map((i) => [i.location.lat, i.location.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [issues, map]);
  return null;
}

const pinColor = (issue: Issue) => (issue.status === "resolved" ? "#2e7d5b" : PRIORITY_META[issue.priorityLabel].hex);

type Props = { issues: Issue[]; className?: string; zoom?: number };

export function IssueMap({ issues, className = "h-[28rem]", zoom = 5 }: Props) {
  return (
    <MapContainer center={INDIA_CENTER} zoom={zoom} className={`z-0 w-full rounded-2xl border border-ink/15 shadow-card ${className}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToIssues issues={issues} />
      {issues.map((issue) => (
        <Marker key={issue.id} position={[issue.location.lat, issue.location.lng]} icon={makePin(issue.category, pinColor(issue))}>
          <Popup>
            <div className="text-sm">
              <p className="font-display text-base font-semibold">{categoryMeta(issue.category).label}</p>
              <p className="mt-0.5 text-xs text-ink/60">
                {issue.ticket} · {STATUS_META[issue.status].label} · {issue.reportCount} {issue.reportCount === 1 ? "report" : "reports"}
              </p>
              <Link to={`/issues/${issue.id}`} className="mt-2 inline-block font-semibold text-accent underline">
                Open issue
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
