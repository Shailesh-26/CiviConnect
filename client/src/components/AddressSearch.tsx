import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { api, ApiError } from "../lib/api";
import type { Place } from "../types";

const MIN_CHARS = 2;

// The parts of `text` that match the typed words, in bold.
function highlight(text: string, query: string): ReactNode {
  const words = query.trim().split(/\s+/).filter((w) => w.length >= 2).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return text;
  return text.split(new RegExp(`(${words.join("|")})`, "gi")).map((part, i) => (i % 2 ? <mark key={i} className="bg-transparent font-semibold text-accent">{part}</mark> : part));
}

// Type a street, landmark or area: suggestions appear as you type; pick one to move the map there.
export function AddressSearch({ near, onPick }: { near: { lat: number; lng: number } | null; onPick: (place: Place) => void }) {
  const listId = useId();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ query: string; results: Place[] }>({ query: "", results: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const nearRef = useRef(near);
  useEffect(() => {
    nearRef.current = near;
  });

  // A short pause after each key, so we ask once per word rather than once per letter.
  useEffect(() => {
    const text = q.trim();
    if (text.length < MIN_CHARS) return;
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
        setFound({ query: text, results: data.results });
        setCursor(-1);
        setOpen(true);
      } catch (err) {
        if (active) setError(err instanceof ApiError ? err.message : "Address search failed");
      } finally {
        if (active) setLoading(false);
      }
    }, 220);
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

  // Earlier suggestions stay on screen while the next ones load, so the list doesn't flicker.
  const typed = q.trim().length >= MIN_CHARS;
  const shown = typed ? found.results : [];

  function pick(place: Place) {
    onPick(place);
    setQ(place.label);
    setOpen(false);
  }

  return (
    <div ref={box} className="relative">
      <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => shown.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || shown.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => (c + 1) % shown.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => (c <= 0 ? shown.length - 1 : c - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(shown[Math.max(cursor, 0)]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Search a street, landmark or area"
        aria-label="Search address"
        role="combobox"
        aria-expanded={open && shown.length > 0}
        aria-controls={listId}
        aria-activedescendant={cursor >= 0 ? `${listId}-${cursor}` : undefined}
        autoComplete="off"
        className="input !pl-10 !pr-10"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/45">
        {loading ? (
          <Loader2 size={17} className="animate-spin" aria-hidden />
        ) : q ? (
          <button type="button" aria-label="Clear" onClick={() => { setQ(""); setFound({ query: "", results: [] }); }} className="grid place-items-center"><X size={16} aria-hidden /></button>
        ) : null}
      </span>
      {error && <p className="mt-1.5 text-xs text-alert">{error}</p>}
      {open && shown.length > 0 && (
        <ul id={listId} className={`absolute inset-x-0 top-full z-[1700] mt-1.5 max-h-80 overflow-auto rounded-2xl border border-ink/10 bg-surface/95 p-1.5 shadow-lift backdrop-blur-xl animate-pop transition-opacity ${loading ? "opacity-70" : ""}`} role="listbox">
          {shown.map((place, i) => (
            <li key={`${place.lat},${place.lng},${i}`} id={`${listId}-${i}`} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onClick={() => pick(place)}
                onMouseEnter={() => setCursor(i)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${i === cursor ? "bg-ink/6" : "hover:bg-ink/6"}`}
              >
                <MapPin size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{highlight(place.label, q)}</span>
                  <span className="block truncate text-xs text-ink/50">{place.full}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && typed && shown.length === 0 && !loading && found.query === q.trim() && !error && (
        <p className="absolute inset-x-0 top-full z-[1700] mt-1.5 rounded-2xl border border-ink/10 bg-surface p-3 text-sm text-ink/55 shadow-lift">No places found. Try a nearby landmark, or tap the map.</p>
      )}
    </div>
  );
}
