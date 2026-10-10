import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { categoryMeta, issueLabel } from "../lib/constants";
import { customIconFor } from "../lib/customIcons";
import type { CommandOverview } from "../types";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type Pin = CommandOverview["pins"][number];

const COLOR = { breached: "#b83a2e", warning: "#c98500", ok: "#1f4e79" } as const;

function icon(pin: Pin) {
  const glyph = (pin.category === "other" && customIconFor(pin.customIcon)) || categoryMeta(pin.category).icon;
  const svg = renderToStaticMarkup(createElement(glyph, { size: 15, strokeWidth: 2.4 }));
  const state = pin.slaState === "breached" ? "breached" : pin.slaState === "warning" ? "warning" : "ok";
  const color = COLOR[state];
  const style = pin.assigned ? `background:${color}` : `background:var(--c-surface);border-color:${color};color:${color}`;
  return L.divIcon({
    className: "cc-pin",
    html: `${state === "breached" ? '<div class="cc-alert-ring"></div>' : ""}<div class="pin" style="${style};width:32px;height:32px"><span ${pin.assigned ? "" : `style="color:${color}"`}>${svg}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

function Fit({ pins }: { pins: Pin[] }) {
  const map = useMap();
  const count = pins.length;
  useEffect(() => {
    if (!count || map.getSize().x === 0) return;
    map.fitBounds(L.latLngBounds(pins.map((p) => [p.location.lat, p.location.lng] as [number, number])), { padding: [30, 30], maxZoom: 14 });
    // Fit once per number of pins, not on every live refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, map]);
  return null;
}

// Every open issue in the city. Filled pins are assigned, hollow ones are waiting for an officer;
// red pins are overdue and pulse.
export function CommandMap({ pins, className = "h-[26rem]" }: { pins: Pin[]; className?: string }) {
  const navigate = useNavigate();
  return (
    <div className="relative">
      <MapContainer center={[17.43, 78.45]} zoom={11} scrollWheelZoom={false} className={`z-0 w-full rounded-2xl ${className}`}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Fit pins={pins} />
        {pins.map((p) => (
          <Marker key={p.id} position={[p.location.lat, p.location.lng]} icon={icon(p)} zIndexOffset={p.slaState === "breached" ? 500 : 0} eventHandlers={{ click: () => navigate(`/issues/${p.id}`) }}>
            <Tooltip direction="top" offset={[0, -30]}>{issueLabel(p)} · {p.ticket}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-wrap gap-x-3 gap-y-1 rounded-2xl border border-white/40 bg-surface/70 px-3 py-2 text-[11px] font-medium shadow-card backdrop-blur-xl">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: COLOR.ok }} /> On track</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: COLOR.warning }} /> Due soon</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: COLOR.breached }} /> Overdue</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2" style={{ borderColor: COLOR.ok }} /> Unassigned</span>
      </div>
    </div>
  );
}
