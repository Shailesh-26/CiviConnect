import { useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { IssueFilters } from "./issueFilters";
import type { Issue, Paged } from "../types";

// Loads one page of issues from the server whenever filters or the page change.
// Typing in the search box waits a moment before asking the server.
export function usePagedIssues(path: string, filters: IssueFilters, page: number, limit = 15) {
  const [data, setData] = useState<Paged<Issue> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [q, setQ] = useState(filters.q);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(filters.q), 300);
    return () => window.clearTimeout(t);
  }, [filters.q]);

  const key = JSON.stringify([path, q, filters.group, filters.category, filters.sort, page, limit]);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), limit: String(limit), group: filters.group, sort: filters.sort });
    if (q.trim()) params.set("q", q.trim());
    if (filters.category) params.set("category", filters.category);
    api<Paged<Issue>>(`${path}?${params}`)
      .then((d) => {
        if (!active) return;
        setData(d);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Could not load issues"))
      .finally(() => active && setLoadedKey(key));
    return () => {
      active = false;
    };
  }, [key, path, q, filters.group, filters.category, filters.sort, page, limit]);

  return { data, error, loading: loadedKey !== key };
}
