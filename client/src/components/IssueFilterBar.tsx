import { useEffect, useRef } from "react";
import { ArrowUpDown, Search, X } from "lucide-react";
import { CATEGORIES } from "../lib/constants";
import { SORTS, STATUS_GROUPS, type IssueFilters, type StatusGroup } from "../lib/issueFilters";
import type { Category } from "../types";

type Props = {
  value: IssueFilters;
  onChange: (next: IssueFilters) => void;
  counts: Record<StatusGroup, number>;
  shown: number;
  total: number;
  placeholder?: string;
};

// Search box, status tabs with live counts, category and sort. Press "/" anywhere to jump to search.
export function IssueFilterBar({ value, onChange, counts, shown, total, placeholder = "Search ticket, place or description" }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<IssueFilters>) => onChange({ ...value, ...patch });
  const filtered = Boolean(value.q || value.category || value.group !== "all");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="space-y-3 animate-rise">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden />
          <input
            ref={searchRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={value.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder={placeholder}
            aria-label="Search issues"
            className="input !pl-10 !pr-10"
          />
          {value.q ? (
            <button type="button" onClick={() => set({ q: "" })} aria-label="Clear search" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-ink/50 hover:bg-ink/5">
              <X size={15} aria-hidden />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-ink/15 px-1.5 text-[11px] text-ink/45 sm:block">/</kbd>
          )}
        </div>
        <div className="flex gap-2.5">
          <select value={value.category} onChange={(e) => set({ category: e.target.value as Category | "" })} className="input !h-full !w-auto flex-1 !py-2 text-sm sm:flex-none" aria-label="Category">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <label className="relative flex flex-1 sm:flex-none">
            <span className="sr-only">Sort</span>
            <ArrowUpDown size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/45" aria-hidden />
            <select value={value.sort} onChange={(e) => set({ sort: e.target.value as IssueFilters["sort"] })} className="input !h-full !w-full !py-2 !pl-9 text-sm sm:!w-auto">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Status">
          {STATUS_GROUPS.map((g) => {
            const active = value.group === g.value;
            return (
              <button
                key={g.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => set({ group: g.value })}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  active ? "border-accent bg-accent text-paper" : "border-ink/15 bg-surface text-ink/70 hover:border-ink/35 hover:text-ink"
                }`}
              >
                {g.label}
                <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-paper/20" : "bg-ink/8 text-ink/55"}`}>{counts[g.value]}</span>
              </button>
            );
          })}
        </div>
        <p className="ml-auto text-xs text-ink/55" aria-live="polite">
          {filtered ? `${shown} of ${total} shown` : `${total} in total`}
          {filtered && (
            <button type="button" onClick={() => onChange({ ...value, q: "", category: "", group: "all" })} className="ml-2 font-semibold text-accent hover:underline">
              Clear
            </button>
          )}
        </p>
      </div>
    </div>
  );
}
