import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../auth/useAuth";
import { HotspotMap } from "../components/HotspotMap";
import { api, ApiError } from "../lib/api";
import { CATEGORIES, categoryMeta, OPEN, STATUS_META } from "../lib/constants";
import { averageResolutionHours, formatDuration } from "../lib/format";
import type { Issue, Status } from "../types";

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-ink/15 bg-white p-4">
      <p className="text-sm text-ink/60">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-ink/50">{note}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-ink/15 bg-white p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const axis = { fontSize: 12, fill: "#1b2430" };

export default function Analytics() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOfficer = user?.role === "officer";

  useEffect(() => {
    let active = true;
    api<{ issues: Issue[] }>(isOfficer ? "/issues/assigned" : "/issues")
      .then((data) => active && setIssues(data.issues))
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Could not load analytics"));
    return () => {
      active = false;
    };
  }, [isOfficer]);

  const stats = useMemo(() => {
    const list = issues ?? [];
    const resolved = list.filter((i) => i.status === "resolved");
    const byCategory = CATEGORIES.map((c) => ({
      name: c.label,
      count: list.filter((i) => i.category === c.value).length,
    })).filter((row) => row.count > 0);
    const byStatus = (Object.keys(STATUS_META) as Status[]).map((s) => ({
      name: STATUS_META[s].label,
      count: list.filter((i) => i.status === s).length,
      color: STATUS_META[s].hex,
    }));

    const officers = new Map<string, { name: string; department: string | null; items: Issue[] }>();
    for (const issue of list) {
      if (!issue.assignedTo) continue;
      const entry = officers.get(issue.assignedTo.id) ?? {
        name: issue.assignedTo.name,
        department: issue.assignedTo.department,
        items: [],
      };
      entry.items.push(issue);
      officers.set(issue.assignedTo.id, entry);
    }

    const topCategory = [...byCategory].sort((a, b) => b.count - a.count)[0];
    return {
      total: list.length,
      open: list.filter((i) => OPEN.includes(i.status)).length,
      resolved: resolved.length,
      rate: list.length ? Math.round((resolved.length / list.length) * 100) : 0,
      avgHours: averageResolutionHours(list),
      topCategory: topCategory ? topCategory.name : "None yet",
      byCategory,
      byStatus,
      officers: [...officers.values()].map((o) => ({
        ...o,
        assigned: o.items.length,
        open: o.items.filter((i) => OPEN.includes(i.status)).length,
        resolved: o.items.filter((i) => i.status === "resolved").length,
        avgHours: averageResolutionHours(o.items),
      })),
    };
  }, [issues]);

  if (error) return <p className="text-sm text-alert">{error}</p>;
  if (!issues) return <p className="text-sm text-ink/60">Loading…</p>;

  const worst = [...issues]
    .filter((i) => OPEN.includes(i.status))
    .sort((a, b) => b.reportCount - a.reportCount)[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-ink/60">
          {isOfficer ? "Based on the issues assigned to you." : "Based on every issue reported on the platform."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Total issues" value={String(stats.total)} />
        <Tile label="Open" value={String(stats.open)} />
        <Tile label="Resolution rate" value={`${stats.rate}%`} note={`${stats.resolved} resolved`} />
        <Tile label="Average resolution time" value={formatDuration(stats.avgHours)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Issues by category">
          {stats.byCategory.length === 0 ? (
            <p className="text-sm text-ink/60">No data yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byCategory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1b243022" />
                  <XAxis dataKey="name" tick={axis} />
                  <YAxis allowDecimals={false} tick={axis} />
                  <Tooltip cursor={{ fill: "#1b243010" }} />
                  <Bar dataKey="count" name="Issues" fill="#1f4e79" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Issues by status">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byStatus}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1b243022" />
                <XAxis dataKey="name" tick={axis} />
                <YAxis allowDecimals={false} tick={axis} />
                <Tooltip cursor={{ fill: "#1b243010" }} />
                <Bar dataKey="count" name="Issues" radius={[4, 4, 0, 0]}>
                  {stats.byStatus.map((row) => (
                    <Cell key={row.name} fill={row.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Hotspots">
        <p className="mb-3 text-sm text-ink/60">
          Darker areas have more open issues close together. Red is high priority, amber is medium and blue is low.
          {worst &&
            ` The most reported open problem is ${categoryMeta(worst.category).label.toLowerCase()} ${worst.ticket} with ${worst.reportCount} reports.`}
        </p>
        <HotspotMap issues={issues} />
        <p className="mt-3 text-sm text-ink/60">
          Most common problem: <span className="font-medium text-ink">{stats.topCategory}</span>
        </p>
      </Panel>

      {!isOfficer && (
        <Panel title="Officer performance">
          {stats.officers.length === 0 ? (
            <p className="text-sm text-ink/60">No issues have been assigned yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ink/20 text-ink/60">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Officer</th>
                    <th className="py-2 pr-4 font-medium">Department</th>
                    <th className="py-2 pr-4 font-medium">Assigned</th>
                    <th className="py-2 pr-4 font-medium">Open</th>
                    <th className="py-2 pr-4 font-medium">Resolved</th>
                    <th className="py-2 font-medium">Average time</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.officers.map((o) => (
                    <tr key={o.name} className="border-b border-ink/10">
                      <td className="py-2 pr-4">{o.name}</td>
                      <td className="py-2 pr-4">{o.department ?? "—"}</td>
                      <td className="py-2 pr-4 tabular-nums">{o.assigned}</td>
                      <td className="py-2 pr-4 tabular-nums">{o.open}</td>
                      <td className="py-2 pr-4 tabular-nums">{o.resolved}</td>
                      <td className="py-2">{formatDuration(o.avgHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
