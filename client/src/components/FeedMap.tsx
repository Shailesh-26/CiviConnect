import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { CATEGORY_COLOR, issueLabel } from "../lib/constants";
import { makePin } from "../lib/pins";
import type { FeedItem } from "../types";

function Fit({ center, radiusKm }: { center: { lat: number; lng: number }; radiusKm: number }) {
  const map = useMap();
  useEffect(() => {
    // A hidden map (e.g. the desktop panel on a phone) has no size; flying would produce NaN.
    if (map.getSize().x === 0) return;
    map.flyToBounds(L.latLng(center.lat, center.lng).toBounds(radiusKm * 2000), { padding: [16, 16], duration: 0.7 });
  }, [center, radiusKm, map]);
  return null;
}

// The neighbourhood circle with every thread as a pin. The card under the mouse grows its pin.
export function FeedMap({ items, center, radiusKm, activeId, className = "h-80" }: { items: FeedItem[]; center: { lat: number; lng: number }; radiusKm: number; activeId: string | null; className?: string }) {
  const navigate = useNavigate();
  const centerKey = useMemo(() => ({ lat: center.lat, lng: center.lng }), [center.lat, center.lng]);

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} scrollWheelZoom={false} className={`z-0 w-full rounded-2xl ${className}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Fit center={centerKey} radiusKm={radiusKm} />
      <Circle center={[center.lat, center.lng]} radius={radiusKm * 1000} pathOptions={{ color: "#1f4e79", weight: 2, fillColor: "#2a7f9e", fillOpacity: 0.07, dashArray: "6 6" }} />
      <CircleMarker center={[center.lat, center.lng]} radius={8} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#e0a100", fillOpacity: 1 }}>
        <Tooltip direction="top">You are here</Tooltip>
      </CircleMarker>
      {items.map((item) => {
        const active = item.id === activeId;
        const color = item.status === "resolved" ? "#2e7d5b" : CATEGORY_COLOR[item.category];
        return (
          <Marker
            key={item.id}
            position={[item.location.lat, item.location.lng]}
            icon={makePin(item.category, color, active ? 44 : 30, item.customIcon)}
            zIndexOffset={active ? 1000 : 0}
            eventHandlers={{ click: () => navigate(`/issues/${item.id}`) }}
          >
            <Tooltip direction="top" offset={[0, -28]}>{issueLabel(item)}</Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
