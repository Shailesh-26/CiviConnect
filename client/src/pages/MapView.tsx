import { useEffect, useState } from "react";
import { IssueMap } from "../components/IssueMap";
import { api, ApiError } from "../lib/api";
import { PRIORITY_META } from "../lib/constants";
import type { Issue } from "../types";

const legend = [
  { label: "High priority", color: PRIORITY_META.high.hex },
  { label: "Medium priority", color: PRIORITY_META.medium.hex },
  { label: "Low priority", color: PRIORITY_META.low.hex },
  { label: "Resolved", color: "#2e7d5b" },
];

export default function MapView() {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<{ issues: Issue[] }>("/issues")
      .then((data) => active && setIssues(data.issues))
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Could not load the map"));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Issue map</h1>
      <p className="mt-1 text-sm text-ink/60">Larger pins have more merged reports.</p>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {legend.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: item.color }} aria-hidden />
            {item.label}
          </li>
        ))}
      </ul>
      <div className="mt-4">
        {error ? <p className="text-sm text-alert">{error}</p> : <IssueMap issues={issues ?? []} className="h-[32rem]" />}
      </div>
    </div>
  );
}
