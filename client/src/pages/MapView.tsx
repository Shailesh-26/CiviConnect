import { useEffect, useState } from "react";
import { IssueMap } from "../components/IssueMap";
import { ErrorNote, PageHeader, Skeleton } from "../components/ui";
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
    <div className="space-y-5">
      <PageHeader title="Issue map" subtitle="Pins show the problem type and are coloured by priority. Tap a pin to open the issue." />
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {legend.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: item.color }} aria-hidden /> {item.label}
          </li>
        ))}
      </ul>
      {error ? <ErrorNote>{error}</ErrorNote> : issues === null ? <Skeleton className="h-[32rem] w-full !rounded-2xl" /> : <IssueMap issues={issues} className="h-[34rem]" />}
    </div>
  );
}
