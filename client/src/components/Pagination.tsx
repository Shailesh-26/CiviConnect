import { ChevronLeft, ChevronRight } from "lucide-react";

// Page numbers with the current page, its neighbours, the first and the last.
function pagesToShow(page: number, pages: number): (number | "…")[] {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pagination({ page, pages, total, limit, onPage }: { page: number; pages: number; total: number; limit: number; onPage: (p: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 pt-2" aria-label="Pages">
      <p className="text-xs text-ink/55">
        Showing <span className="font-semibold text-ink">{from}–{to}</span> of <span className="font-semibold text-ink">{total}</span>
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page" className="grid size-9 place-items-center rounded-xl border border-ink/12 bg-surface transition hover:border-accent disabled:opacity-40">
            <ChevronLeft size={16} aria-hidden />
          </button>
          {pagesToShow(page, pages).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-sm text-ink/40">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                aria-current={p === page ? "page" : undefined}
                className={`grid h-9 min-w-9 place-items-center rounded-xl px-2 text-sm font-semibold tabular-nums transition ${p === page ? "bg-accent text-paper shadow-card" : "border border-ink/12 bg-surface hover:border-accent"}`}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page" className="grid size-9 place-items-center rounded-xl border border-ink/12 bg-surface transition hover:border-accent disabled:opacity-40">
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      )}
    </nav>
  );
}
