import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Place } from "../types";

// Type a street, landmark or area; pick a result to move the map there.
export function AddressSearch({ near, onPick }: { near: { lat: number; lng: number } | null; onPick: (place: Place) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const nearRef = useRef(near);
  useEffect(() => {
    nearRef.current = near;
  });

  // Wait until typing pauses, so the free OpenStreetMap service is not flooded.
  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ q: text });
      if (nearRef.current) {
        params.set("lat", String(nearRef.current.lat));
        params.set("lng", String(nearRef.current.lng));
      }
      try {
        const data = await api<{ results: Place[] }>(`/geo/search?${params}`);
        if (!active) return;
        setResults(data.results);
        setOpen(true);
      } catch (err) {
        if (active) setError(err instanceof ApiError ? err.message : "Address search failed");
      } finally {
        if (active) setLoading(false);
      }
    }, 650);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const shown = q.trim().length >= 3 ? results : [];

  return (
    <div ref={box} className="relative">
      <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => shown.length && setOpen(true)}
        placeholder="Search a street, landmark or area"
        aria-label="Search address"
        className="input !pl-10 !pr-10"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/45">
        {loading ? (
          <Loader2 size={17} className="animate-spin" aria-hidden />
        ) : q ? (
          <button type="button" aria-label="Clear" onClick={() => { setQ(""); setResults([]); }} className="grid place-items-center"><X size={16} aria-hidden /></button>
        ) : null}
      </span>
      {error && <p className="mt-1.5 text-xs text-alert">{error}</p>}
      {open && shown.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-[1700] mt-1.5 max-h-72 overflow-auto rounded-2xl border border-ink/10 bg-surface/95 p-1.5 shadow-lift backdrop-blur-xl animate-pop" role="listbox">
          {shown.map((place) => (
            <li key={`${place.lat},${place.lng}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(place);
                  setQ(place.label);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-ink/6"
              >
                <MapPin size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{place.label}</span>
                  <span className="block truncate text-xs text-ink/50">{place.full}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && shown.length === 0 && !loading && q.trim().length >= 3 && !error && (
        <p className="absolute inset-x-0 top-full z-[1700] mt-1.5 rounded-2xl border border-ink/10 bg-surface p-3 text-sm text-ink/55 shadow-lift">No places found. Try a nearby landmark, or tap the map.</p>
      )}
    </div>
  );
}
