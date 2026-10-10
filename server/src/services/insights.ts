import { Types } from "mongoose";
import { Comment } from "../models/Comment";
import { Issue, OPEN_STATUSES, type Category, type Status } from "../models/Issue";
import { areaOf, metres } from "../utils/geo";
import { slaInfo } from "./sla";

const DAY = 86_400_000;
const SPOT_RADIUS_M = 60;

type Lite = {
  _id: Types.ObjectId;
  ticket: string;
  category: Category;
  customLabel?: string | null;
  status: Status;
  address?: string | null;
  location: { coordinates: number[] };
  createdAt: Date;
  resolvedAt?: Date | null;
  slaDueAt?: Date | null;
  escalatedAt?: Date | null;
  reports: { user: Types.ObjectId }[];
  supporters: Types.ObjectId[];
  commentCount?: number;
  timeline: { status: Status; at: Date }[];
};

const FIELDS = "ticket category customLabel status address location createdAt resolvedAt slaDueAt escalatedAt reports.user supporters commentCount timeline.status timeline.at";
const pt = (i: Lite) => ({ lat: i.location.coordinates[1], lng: i.location.coordinates[0] });

// What a city should do instead of patching the same spot again.
const PERMANENT_FIX: Record<Category, string> = {
  pothole: "Resurface the whole stretch and check the drainage under it instead of patching the same pothole again.",
  garbage: "Install a covered community bin and add this corner to the daily pickup route; consider a CCTV or signage for dumping.",
  drainage: "De-silt the full drain line and replace the broken grate or culvert; schedule a pre-monsoon cleaning here.",
  streetlight: "Replace the fixture with an LED unit and check the cable and timer, not just the bulb.",
  fallen_tree: "Ask the horticulture team for a tree health survey and prune weak branches before the next storm.",
  other: "Inspect the spot as a whole and fix the root cause rather than the latest symptom.",
};

// ---------------------------------------------------------------- Chronic spots

export type ChronicSpot = {
  id: string;
  category: Category;
  label: string | null;
  area: string;
  address: string | null;
  lat: number;
  lng: number;
  count: number;
  recurrences: number;
  open: number;
  firstAt: Date;
  lastAt: Date;
  avgGapDays: number | null;
  suggestion: string;
  issues: { id: string; ticket: string; status: Status; createdAt: Date }[];
};

/**
 * Places where the same kind of problem keeps coming back: issues of one category within
 * 60 m of each other. A spot is chronic with 3+ issues where at least one came back after an
 * earlier one was marked fixed, or with 4+ issues in the window.
 */
export async function chronicSpots(days = 120): Promise<ChronicSpot[]> {
  const rows = (await Issue.find({ createdAt: { $gte: new Date(Date.now() - days * DAY) }, status: { $ne: "rejected" } })
    .select(FIELDS)
    .sort({ createdAt: 1 })
    .lean()) as unknown as Lite[];

  const clusters: { category: Category; lat: number; lng: number; items: Lite[] }[] = [];
  for (const issue of rows) {
    const p = pt(issue);
    const home = clusters.find((c) => c.category === issue.category && metres(c, p) <= SPOT_RADIUS_M);
    if (home) {
      home.items.push(issue);
      home.lat = home.items.reduce((a, i) => a + pt(i).lat, 0) / home.items.length;
      home.lng = home.items.reduce((a, i) => a + pt(i).lng, 0) / home.items.length;
    } else clusters.push({ category: issue.category, ...p, items: [issue] });
  }

  return clusters
    .map((c) => {
      const items = c.items;
      // A recurrence: reported after an earlier issue at the same spot had been marked fixed.
      const recurrences = items.filter((i, k) => items.slice(0, k).some((e) => e.resolvedAt && new Date(e.resolvedAt) < new Date(i.createdAt))).length;
      const gaps = items.slice(1).map((i, k) => (new Date(i.createdAt).getTime() - new Date(items[k].createdAt).getTime()) / DAY);
      const latest = items[items.length - 1];
      return {
        id: items[0]._id.toString(),
        category: c.category,
        label: c.category === "other" ? (latest.customLabel ?? null) : null,
        area: areaOf(latest.address),
        address: latest.address ?? null,
        lat: c.lat,
        lng: c.lng,
        count: items.length,
        recurrences,
        open: items.filter((i) => OPEN_STATUSES.includes(i.status)).length,
        firstAt: items[0].createdAt,
        lastAt: latest.createdAt,
        avgGapDays: gaps.length ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10 : null,
        suggestion: PERMANENT_FIX[c.category],
        issues: items.map((i) => ({ id: i._id.toString(), ticket: i.ticket, status: i.status, createdAt: i.createdAt })).reverse(),
      };
    })
    .filter((s) => (s.count >= 3 && s.recurrences >= 1) || s.count >= 4)
    .sort((a, b) => b.recurrences - a.recurrences || b.count - a.count);
}

// For one issue page: how many issues of the same kind were reported at this spot recently.
export async function chronicFor(issue: { _id: { toString(): string }; category: Category; location: { coordinates: number[] } }) {
  const near = (await Issue.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: issue.location.coordinates as [number, number] },
        distanceField: "d",
        maxDistance: SPOT_RADIUS_M,
        spherical: true,
        query: { category: issue.category, status: { $ne: "rejected" }, createdAt: { $gte: new Date(Date.now() - 120 * DAY) } },
      },
    },
    { $project: { createdAt: 1, resolvedAt: 1 } },
    { $sort: { createdAt: 1 } },
  ])) as { createdAt: Date; resolvedAt?: Date | null }[];
  if (near.length < 3) return null;
  const recurrences = near.filter((i, k) => near.slice(0, k).some((e) => e.resolvedAt && new Date(e.resolvedAt) < new Date(i.createdAt))).length;
  if (recurrences < 1 && near.length < 4) return null;
  return { count: near.length, recurrences, since: near[0].createdAt, suggestion: PERMANENT_FIX[issue.category] };
}

// ---------------------------------------------------------------- Area report cards

const grade = (score: number) => (score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F");

function scoreAreas(rows: Lite[], openNow: Lite[]) {
  const map = new Map<string, Lite[]>();
  for (const i of rows) map.set(areaOf(i.address), [...(map.get(areaOf(i.address)) ?? []), i]);
  const result = new Map<string, ReturnType<typeof oneArea>>();
  for (const [area, items] of map) result.set(area, oneArea(area, items, openNow.filter((o) => areaOf(o.address) === area)));
  return result;
}

function oneArea(area: string, items: Lite[], openNow: Lite[]) {
  const resolved = items.filter((i) => i.status === "resolved" && i.resolvedAt);
  const fixHours = resolved.map((i) => (new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()) / 3_600_000);
  const avgFix = fixHours.length ? fixHours.reduce((a, b) => a + b, 0) / fixHours.length : null;
  const onTime = resolved.length ? resolved.filter((i) => slaInfo(i).state === "met").length / resolved.length : 0;
  const fixRate = items.length ? resolved.length / items.length : 0;
  const reopened = resolved.filter((i) => i.timeline.some((t, k) => t.status === "in_progress" && i.timeline.slice(0, k).some((s) => s.status === "resolved"))).length;
  const reopenRate = resolved.length ? reopened / resolved.length : 0;
  const speed = avgFix === null ? 0 : Math.max(0, Math.min(1, 1 - avgFix / 144));
  // Weights: on-time fixes 35%, share fixed 30%, speed 20%, fixes that stayed fixed 15%.
  const score = Math.round(100 * (0.35 * onTime + 0.3 * fixRate + 0.2 * speed + 0.15 * (1 - reopenRate)));
  return {
    area,
    reported: items.length,
    resolved: resolved.length,
    openNow: openNow.length,
    overdueNow: openNow.filter((o) => slaInfo(o).state === "breached").length,
    onTimeRate: Math.round(onTime * 100),
    fixRate: Math.round(fixRate * 100),
    reopenRate: Math.round(reopenRate * 100),
    avgFixHours: avgFix === null ? null : Math.round(avgFix * 10) / 10,
    engagement: items.reduce((a, i) => a + i.reports.length + i.supporters.length + (i.commentCount ?? 0), 0),
    topCategory: Object.entries(items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.category]: (acc[i.category] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    score,
    grade: grade(score),
  };
}

export async function areaReportCards(days = 90) {
  const now = Date.now();
  const [current, previous, openNow, spots] = await Promise.all([
    Issue.find({ createdAt: { $gte: new Date(now - days * DAY) } }).select(FIELDS).lean() as unknown as Promise<Lite[]>,
    Issue.find({ createdAt: { $gte: new Date(now - 2 * days * DAY), $lt: new Date(now - days * DAY) } }).select(FIELDS).lean() as unknown as Promise<Lite[]>,
    Issue.find({ status: { $in: OPEN_STATUSES } }).select(FIELDS).lean() as unknown as Promise<Lite[]>,
    chronicSpots(Math.max(days, 120)),
  ]);
  const now_ = scoreAreas(current, openNow);
  const before = scoreAreas(previous, []);
  return [...now_.values()]
    .filter((a) => a.reported >= 3)
    .map((a) => {
      const prev = before.get(a.area);
      return { ...a, previousGrade: prev && prev.reported >= 3 ? prev.grade : null, chronicSpots: spots.filter((s) => s.area === a.area).length };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------- Civic score

const LEVELS = [
  { min: 0, name: "Newcomer" },
  { min: 50, name: "Active citizen" },
  { min: 150, name: "Civic champion" },
  { min: 300, name: "Ward hero" },
  { min: 600, name: "City guardian" },
];

/**
 * Points reward useful civic actions, never volume alone:
 *   report 10 · each neighbour who confirmed your report 3 (max 15 per issue) · your report fixed 15
 *   verification vote 5 · upvote 1 · comment 2 (max 40)
 */
export async function civicScore(userId: string) {
  const me = new Types.ObjectId(userId);
  const [mine, verified, supported, comments, spots] = await Promise.all([
    Issue.find({ "reports.user": me }).select("status reports.user reports.createdAt createdAt category location").lean(),
    Issue.countDocuments({ "verifications.user": me }),
    Issue.countDocuments({ supporters: me }),
    Comment.countDocuments({ user: me, deleted: false }),
    chronicSpots(120),
  ]);

  const reports = mine.length;
  const confirmations = mine.reduce((a, i) => a + Math.min(5, Math.max(0, i.reports.length - 1)), 0);
  const fixed = mine.filter((i) => i.status === "resolved").length;
  const firstOnBusy = mine.filter((i) => i.reports[0]?.user.equals(me) && i.reports.length >= 3).length;
  const spotIssueIds = new Set(spots.flatMap((s) => s.issues.map((x) => x.id)));
  const onChronic = mine.filter((i) => spotIssueIds.has(i._id.toString())).length;

  const breakdown = [
    { label: "Reports", points: reports * 10, detail: `${reports} × 10` },
    { label: "Confirmed by neighbours", points: confirmations * 3, detail: `${confirmations} × 3` },
    { label: "Your reports fixed", points: fixed * 15, detail: `${fixed} × 15` },
    { label: "Verifications", points: verified * 5, detail: `${verified} × 5` },
    { label: "Upvotes given", points: supported, detail: `${supported} × 1` },
    { label: "Comments", points: Math.min(40, comments * 2), detail: `${comments} × 2 (max 40)` },
  ];
  const score = breakdown.reduce((a, b) => a + b.points, 0);
  const levelIndex = LEVELS.reduce((idx, l, i) => (score >= l.min ? i : idx), 0);
  const next = LEVELS[levelIndex + 1] ?? null;

  const badge = (id: string, name: string, description: string, progress: number, goal: number) => ({ id, name, description, progress: Math.min(progress, goal), goal, earned: progress >= goal });
  const badges = [
    badge("first_report", "First report", "Reported your first problem.", reports, 1),
    badge("watch", "Neighbourhood watch", "Reported 5 problems.", reports, 5),
    badge("fixer", "Got it fixed", "3 of your reports were fixed.", fixed, 3),
    badge("verifier", "Truth teller", "Confirmed 5 fixes as real or not.", verified, 5),
    badge("voice", "Strong voice", "Upvoted 10 problems that affect you.", supported, 10),
    badge("early_bird", "Early bird", "First to report a problem 3+ people later confirmed.", firstOnBusy, 1),
    badge("chronic_hunter", "Pattern spotter", "Reported at a chronic spot.", onChronic, 1),
    badge("conversation", "Helpful neighbour", "Added 5 comments to discussions.", comments, 5),
  ];

  return {
    score,
    level: LEVELS[levelIndex].name,
    levelIndex,
    nextLevel: next ? { name: next.name, at: next.min, remaining: next.min - score } : null,
    levelFloor: LEVELS[levelIndex].min,
    breakdown,
    badges,
  };
}

// ---------------------------------------------------------------- Time-lapse

export async function timeline(days = 90) {
  const rows = (await Issue.find({ createdAt: { $gte: new Date(Date.now() - days * DAY) } })
    .select("category customIcon status location createdAt resolvedAt timeline.status timeline.at")
    .sort({ createdAt: 1 })
    .lean()) as unknown as (Lite & { customIcon?: string })[];
  return rows.map((i) => ({
    id: i._id.toString(),
    category: i.category,
    lat: i.location.coordinates[1],
    lng: i.location.coordinates[0],
    createdAt: i.createdAt,
    resolvedAt: i.status === "resolved" ? (i.resolvedAt ?? null) : null,
    rejectedAt: i.status === "rejected" ? (i.timeline.find((t) => t.status === "rejected")?.at ?? null) : null,
  }));
}
