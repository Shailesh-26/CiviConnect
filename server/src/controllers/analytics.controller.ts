import type { RequestHandler } from "express";
import { CATEGORIES, Issue, OPEN_STATUSES, STATUSES, type Category, type Status } from "../models/Issue";
import { User } from "../models/User";
import { slaInfo } from "../services/sla";
import { computePriority } from "../utils/priority";

const DAY = 86_400_000;
const TZ = "Asia/Kolkata";
const RANGES = [7, 30, 90, 365];

type Lite = {
  _id: { toString(): string };
  ticket: string;
  category: Category;
  customLabel?: string | null;
  status: Status;
  address?: string | null;
  location: { coordinates: number[] };
  reports: unknown[];
  supporters: unknown[];
  commentCount?: number;
  assignedTo?: { toString(): string } | null;
  timeline: { status: Status; at: Date }[];
  slaDueAt?: Date | null;
  escalatedAt?: Date | null;
  resolvedAt?: Date | null;
  createdAt: Date;
};

const FIELDS = "ticket category customLabel status address location reports supporters commentCount assignedTo timeline.status timeline.at slaDueAt escalatedAt resolvedAt createdAt";

// "Near Ameerpet metro station, Ameerpet" -> "Ameerpet". Landmarks typed by people vary, so this is a best effort.
const areaOf = (address?: string | null) => {
  const tail = address?.split(",").map((s) => s.trim()).filter(Boolean).pop();
  return tail && tail.length <= 40 ? tail : "Unnamed area";
};

// True when the issue was resolved and later moved back to in progress.
const wasReopened = (t: Lite["timeline"]) => t.some((step, i) => step.status === "in_progress" && t.slice(0, i).some((s) => s.status === "resolved"));

const median = (values: number[]) => {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

function rangeOf(q: unknown) {
  const days = Number(q);
  return RANGES.includes(days) ? days : 30;
}

/**
 * City analytics, computed on the server with MongoDB aggregation pipelines (trend, heatmap,
 * shares) plus a single pass over the issues in range for SLA, reopen and officer figures.
 */
export const getAnalytics: RequestHandler = async (req, res) => {
  const days = rangeOf(req.query.days);
  const now = Date.now();
  const since = new Date(now - days * DAY);
  const prevSince = new Date(now - 2 * days * DAY);
  const weekly = days > 90;
  const fmt = weekly ? "%G-W%V" : "%Y-%m-%d";

  const [reportedTrend, resolvedTrend, statusShare, heat, inRange, resolvedInRange, prev, openNow, officers] = await Promise.all([
    Issue.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: fmt, date: "$createdAt", timezone: TZ } }, n: { $sum: 1 } } },
    ]),
    Issue.aggregate([
      { $match: { status: "resolved", resolvedAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: fmt, date: "$resolvedAt", timezone: TZ } }, n: { $sum: 1 } } },
    ]),
    Issue.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Issue.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { d: { $dayOfWeek: { date: "$createdAt", timezone: TZ } }, h: { $hour: { date: "$createdAt", timezone: TZ } } },
          n: { $sum: 1 },
        },
      },
    ]),
    Issue.find({ createdAt: { $gte: since } }).select(FIELDS).lean() as unknown as Promise<Lite[]>,
    Issue.find({ status: "resolved", resolvedAt: { $gte: since } }).select(FIELDS).lean() as unknown as Promise<Lite[]>,
    Issue.aggregate([
      { $facet: {
        reported: [{ $match: { createdAt: { $gte: prevSince, $lt: since } } }, { $count: "n" }],
        resolved: [{ $match: { status: "resolved", resolvedAt: { $gte: prevSince, $lt: since } } }, { $count: "n" }],
      } },
    ]),
    Issue.find({ status: { $in: OPEN_STATUSES } }).select(FIELDS).lean() as unknown as Promise<Lite[]>,
    User.find({ role: "officer" }).select("name department isActive").lean(),
  ]);

  // Trend with empty days filled in, so the line does not jump.
  const buckets: string[] = [];
  const keyOf = (d: Date) => {
    const local = new Date(d.getTime() + 5.5 * 3_600_000);
    if (!weekly) return local.toISOString().slice(0, 10);
    const t = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
    const dayNum = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((t.getTime() - yearStart.getTime()) / DAY + 1) / 7);
    return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  };
  for (let t = since.getTime(); t <= now; t += weekly ? 7 * DAY : DAY) {
    const k = keyOf(new Date(t));
    if (!buckets.includes(k)) buckets.push(k);
  }
  const lastKey = keyOf(new Date(now));
  if (!buckets.includes(lastKey)) buckets.push(lastKey);
  const rep = new Map(reportedTrend.map((r) => [r._id as string, r.n as number]));
  const fix = new Map(resolvedTrend.map((r) => [r._id as string, r.n as number]));
  const trend = buckets.map((k) => ({ key: k, reported: rep.get(k) ?? 0, resolved: fix.get(k) ?? 0 }));

  // SLA, reopen and response figures.
  const hoursToFix = resolvedInRange.map((i) => (new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()) / 3_600_000);
  const onTime = resolvedInRange.filter((i) => slaInfo(i).state === "met").length;
  const reopened = resolvedInRange.filter((i) => wasReopened(i.timeline)).length;
  const firstResponse = inRange
    .map((i) => {
      const ack = i.timeline.find((t) => t.status !== "reported");
      return ack ? (new Date(ack.at).getTime() - new Date(i.createdAt).getTime()) / 3_600_000 : null;
    })
    .filter((h): h is number => h !== null && h >= 0);
  const breachedNow = openNow.filter((i) => slaInfo(i).state === "breached").length;

  const byCategory = CATEGORIES.map((c) => {
    const all = inRange.filter((i) => i.category === c);
    const done = resolvedInRange.filter((i) => i.category === c);
    const fixHours = done.map((i) => (new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()) / 3_600_000);
    return {
      category: c,
      reported: all.length,
      open: openNow.filter((i) => i.category === c).length,
      resolved: done.length,
      avgFixHours: round1(fixHours.length ? fixHours.reduce((a, b) => a + b, 0) / fixHours.length : null),
      slaCompliance: done.length ? Math.round((done.filter((i) => slaInfo(i).state === "met").length / done.length) * 100) : null,
    };
  });

  // Area x category matrix for the busiest areas.
  const areaCounts = new Map<string, Record<string, number>>();
  for (const i of inRange) {
    const a = areaOf(i.address);
    const row = areaCounts.get(a) ?? {};
    row[i.category] = (row[i.category] ?? 0) + 1;
    areaCounts.set(a, row);
  }
  const areas = [...areaCounts.entries()]
    .map(([area, row]) => ({ area, total: Object.values(row).reduce((a, b) => a + b, 0), counts: row }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Officer leaderboard.
  const leaderboard = officers
    .map((o) => {
      const id = o._id.toString();
      const done = resolvedInRange.filter((i) => i.assignedTo?.toString() === id);
      const fixHours = done.map((i) => (new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()) / 3_600_000);
      const open = openNow.filter((i) => i.assignedTo?.toString() === id);
      return {
        id,
        name: o.name,
        department: o.department ?? null,
        active: o.isActive,
        resolved: done.length,
        open: open.length,
        breached: open.filter((i) => slaInfo(i).state === "breached").length,
        avgFixHours: round1(fixHours.length ? fixHours.reduce((a, b) => a + b, 0) / fixHours.length : null),
        onTimeRate: done.length ? Math.round((done.filter((i) => slaInfo(i).state === "met").length / done.length) * 100) : null,
        reopened: done.filter((i) => wasReopened(i.timeline)).length,
      };
    })
    .sort((a, b) => b.resolved - a.resolved || (a.avgFixHours ?? 1e9) - (b.avgFixHours ?? 1e9));

  const prevRow = prev[0] as { reported: { n: number }[]; resolved: { n: number }[] };

  res.json({
    days,
    weekly,
    kpis: {
      reported: inRange.length,
      reportedPrev: prevRow.reported[0]?.n ?? 0,
      resolved: resolvedInRange.length,
      resolvedPrev: prevRow.resolved[0]?.n ?? 0,
      openNow: openNow.length,
      breachedNow,
      avgFixHours: round1(hoursToFix.length ? hoursToFix.reduce((a, b) => a + b, 0) / hoursToFix.length : null),
      medianFixHours: round1(median(hoursToFix)),
      slaCompliance: resolvedInRange.length ? Math.round((onTime / resolvedInRange.length) * 100) : null,
      reopenRate: resolvedInRange.length ? Math.round((reopened / resolvedInRange.length) * 100) : null,
      medianFirstResponseHours: round1(median(firstResponse)),
      citizensEngaged: new Set(inRange.flatMap((i) => (i.reports as { user?: { toString(): string } }[]).map((r) => r.user?.toString()))).size,
    },
    trend,
    statusShare: STATUSES.map((s) => ({ status: s, count: statusShare.find((r) => r._id === s)?.n ?? 0 })),
    byCategory,
    heat: heat.map((h) => ({ day: (h._id.d as number) - 1, hour: h._id.h as number, count: h.n as number })),
    areas,
    leaderboard,
    hotspots: openNow.map((i) => ({
      id: i._id.toString(),
      lat: i.location.coordinates[1],
      lng: i.location.coordinates[0],
      category: i.category,
      priority: computePriority({ category: i.category, reportCount: i.reports.length, supporterCount: i.supporters.length, createdAt: i.createdAt, escalated: Boolean(i.escalatedAt) }),
    })),
  });
};

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Every issue reported in the range as a spreadsheet-friendly CSV file.
export const exportCsv: RequestHandler = async (req, res) => {
  const days = rangeOf(req.query.days);
  const since = new Date(Date.now() - days * DAY);
  const rows = (await Issue.find({ createdAt: { $gte: since } })
    .select(FIELDS)
    .populate("assignedTo", "name")
    .sort({ createdAt: -1 })
    .lean()) as unknown as (Lite & { assignedTo?: { name?: string } | null })[];

  const header = ["ticket", "category", "name", "status", "reported_at", "resolved_at", "hours_to_fix", "sla_hours", "sla_state", "escalated", "reports", "supporters", "comments", "officer", "address", "lat", "lng"];
  const lines = rows.map((i) => {
    const sla = slaInfo(i);
    const hours = i.resolvedAt ? round1((new Date(i.resolvedAt).getTime() - new Date(i.createdAt).getTime()) / 3_600_000) : null;
    return [
      i.ticket, i.category, i.category === "other" ? (i.customLabel ?? "") : "", i.status,
      new Date(i.createdAt).toISOString(), i.resolvedAt ? new Date(i.resolvedAt).toISOString() : "", hours,
      sla.hours, sla.state, i.escalatedAt ? "yes" : "no", i.reports.length, i.supporters.length, i.commentCount ?? 0,
      i.assignedTo?.name ?? "", i.address ?? "", i.location.coordinates[1], i.location.coordinates[0],
    ].map(csvCell).join(",");
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="civiconnect-issues-${days}d.csv"`);
  res.send([header.join(","), ...lines].join("\n"));
};
