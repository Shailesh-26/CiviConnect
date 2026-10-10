import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { issueLabel } from "../lib/constants";
import { pinColor } from "../lib/mapColors";
import { makePin } from "../lib/pins";
import type { Issue } from "../types";

export type Bounds = { north: number; south: number; east: number; west: number };


type Group = { key: string; lat: number; lng: number; items: Issue[] };

// Groups pins that would overlap on screen (within ~56 px) at the current zoom.
function cluster(map: L.Map, issues: Issue[], zoom: number): Group[] {
  const size = 56;
  const cells = new Map<string, Issue[]>();
  for (const i of issues) {
    const p = map.project([i.location.lat, i.location.lng], zoom);
    const key = `${Math.floor(p.x / size)}:${Math.floor(p.y / size)}`;
    cells.set(key, [...(cells.get(key) ?? []), i]);
  }
  return [...cells.entries()].map(([key, items]) => ({
    key,
    items,
    lat: items.reduce((a, b) => a + b.location.lat, 0) / items.length,
    lng: items.reduce((a, b) => a + b.location.lng, 0) / items.length,
  }));
}

function clusterIcon(g: Group) {
  const n = g.items.length;
  const overdue = g.items.some((i) => i.sla?.state === "breached");
  const high = g.items.filter((i) => i.priorityLabel === "high" && i.status !== "resolved").length;
  const size = n < 10 ? 40 : n < 30 ? 48 : 58;
  return L.divIcon({
    className: "cc-cluster",
    html: `<div style="width:${size}px;height:${size}px" class="cc-cluster-dot ${overdue ? "is-late" : ""}"><b>${n}</b>${high ? `<i>${high}</i>` : ""}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function Layer({ issues, clustered, heat, selectedId, hoveredId, onSelect, onBounds, fly, padLeft = 0 }: Props) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    moveend: () => {
      const b = map.getBounds();
      onBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    },
  });

  // First fit, then report the visible area.
  const count = issues.length;
  useEffect(() => {
    if (!count || map.getSize().x === 0) return;
    map.fitBounds(L.latLngBounds(issues.map((i) => [i.location.lat, i.location.lng] as [number, number])), { paddingTopLeft: [60 + padLeft, 60], paddingBottomRight: [60, 60], maxZoom: 15 });
    // Fit once when the data first arrives, not on every filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count > 0, map]);

  useEffect(() => {
    if (fly) map.flyTo([fly.lat, fly.lng], Math.max(map.getZoom(), fly.zoom ?? 16), { duration: 0.8 });
  }, [fly, map]);

  const groups = useMemo(() => (clustered && zoom < 17 ? cluster(map, issues, zoom) : issues.map((i) => ({ key: i.id, lat: i.location.lat, lng: i.location.lng, items: [i] }))), [clustered, zoom, issues, map]);

  return (
    <>
      {heat &&
        issues
          .filter((i) => i.status !== "resolved" && i.status !== "rejected")
          .map((i) => (
            <CircleMarker key={`h-${i.id}`} center={[i.location.lat, i.location.lng]} radius={10 + (i.priority / 100) * 26} pathOptions={{ stroke: false, fillColor: pinColor(i), fillOpacity: 0.22 }} interactive={false} />
          ))}
      {groups.map((g) => {
        if (g.items.length > 1) {
          return (
            <Marker
              key={`c-${g.key}`}
              position={[g.lat, g.lng]}
              icon={clusterIcon(g)}
              eventHandlers={{
                click: () => map.flyToBounds(L.latLngBounds(g.items.map((i) => [i.location.lat, i.location.lng] as [number, number])), { padding: [80, 80], maxZoom: 18, duration: 0.7 }),
              }}
            >
              <Tooltip direction="top" offset={[0, -18]}>{g.items.length} issues here. Click to zoom in.</Tooltip>
            </Marker>
          );
        }
        const i = g.items[0];
        const big = i.id === selectedId || i.id === hoveredId;
        return (
          <Marker
            key={i.id}
            position={[i.location.lat, i.location.lng]}
            icon={makePin(i.category, pinColor(i), big ? 46 : 32, i.customIcon)}
            zIndexOffset={big ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(i.id) }}
          >
            <Tooltip direction="top" offset={[0, big ? -44 : -30]}>{issueLabel(i)} · {i.ticket}</Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

type Props = {
  issues: Issue[];
  clustered: boolean;
  heat: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onBounds: (b: Bounds) => void;
  fly: { lat: number; lng: number; zoom?: number } | null;
  // Space covered by a floating panel on the left, so pins are not hidden under it.
  padLeft?: number;
};

// The explore map: clustering, an optional heat layer, selection and "search this area".
export function ExploreMap({ mapRef, className, ...props }: Props & { className?: string; mapRef?: React.Ref<L.Map> }) {
  return (
    <MapContainer ref={mapRef} center={[20.5937, 78.9629]} zoom={5} zoomControl={false} className={`z-0 size-full ${className ?? ""}`}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Layer {...props} />
    </MapContainer>
  );
}
