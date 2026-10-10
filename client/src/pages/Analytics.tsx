import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Download, Gauge, Medal, RotateCcw, Timer, TrendingUp, Users, Zap } from "lucide-react";
import { CategoryChip } from "../components/CategoryChip";
import { HeatSpots } from "../components/HeatSpots";
import { Ring } from "../components/Ring";
import { ErrorNote, PageHeader, Skeleton } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_COLOR_DARK, categoryMeta, STATUS_META } from "../lib/constants";
import { formatDuration } from "../lib/format";
import { useTheme } from "../theme/theme-context";
import type { AnalyticsData, Category } from "../types";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
];
// Two-series colours from the validated chart palette (slots 1 and 3), stepped per theme.
const SERIES = {
  light: { reported: "#2a78d6", resolved: "#1baf7a" },
  dark: { reported: "#3987e5", resolved: "#199e70" },
};
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Tile({ label, value, sub, icon: Icon, delta, invert = false, children }: { label: string; value: ReactNode; sub?: string; icon: typeof Timer; delta?: number | null; invert?: boolean; children?: ReactNode }) {
  const good = delta === null || delta === undefined ? null : invert ? delta < 0 : delta > 0;
  return (
    <div className="card card-hover flex flex-col p-5">
      <p className="flex items-center gap-2 text-sm text-ink/60"><Icon size={16} aria-hidden /> {label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="font-display text-3xl font-bold tabular-nums">{value}</p>
        {children}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-ink/55">
        {delta !== null && delta !== undefined && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${good ? "bg-resolved/12 text-resolved" : delta === 0 ? "bg-ink/8" : "bg-alert/10 text-alert"}`}>
            {delta >= 0 ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
            {Math.abs(delta)}%
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}

function Panel({ title, note, className = "", children, action }: { title: string; note?: string; className?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-ink/55">{note}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const pct = (now: number, before: number) => (before === 0 ? (now === 0 ? 0 : null) : Math.round(((now - before) / before) * 100));

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink/10 bg-surface px-3 py-2 text-xs shadow-lift">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} /> <span className="text-ink/65">{p.name}</span> <span className="ml-auto font-semibold tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { theme } = useTheme();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<{ day: number; hour: number; count: number } | null>(null);

  useEffect(() => {
    let active = true;
    api<AnalyticsData>(`/analytics?days=${days}`)
      .then((d) => {
        if (!active) return;
        setData(d);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Could not load analytics"));
    return () => {
      active = false;
    };
  }, [days]);

  const series = SERIES[theme];
  const catColor = (c: Category) => (theme === "dark" ? CATEGORY_COLOR_DARK : CATEGORY_COLOR)[c];

  const trend = useMemo(
    () =>
      (data?.trend ?? []).map((t) => ({
        ...t,
        label: data?.weekly ? t.key.replace(/^\d{4}-/, "") : new Date(t.key).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      })),
    [data],
  );

  // Hour x weekday grid, Monday first.
  const heat = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    for (const h of data?.heat ?? []) grid[(h.day + 6) % 7][h.hour] = h.count;
    const max = Math.max(1, ...grid.flat());
    return { grid, max };
  }, [data]);

  const peaks = useMemo(() => {
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}`, count: heat.grid.reduce((sum, row) => sum + row[h], 0) }));
    const byDay = heat.grid.map((row) => row.reduce((a, b) => a + b, 0));
    const total = byDay.reduce((a, b) => a + b, 0);
    return {
      byHour,
      hour: total ? byHour.reduce((best, x, i) => (x.count > byHour[best].count ? i : best), 0) : null,
      day: total ? byDay.reduce((best, x, i) => (x > byDay[best] ? i : best), 0) : null,
    };
  }, [heat]);

  const areaMax = useMemo(() => Math.max(1, ...(data?.areas ?? []).flatMap((a) => Object.values(a.counts) as number[])), [data]);
  const leaderMax = useMemo(() => Math.max(1, ...(data?.leaderboard ?? []).map((l) => l.resolved)), [data]);

  if (error) return <ErrorNote>{error}</ErrorNote>;

  const k = data?.kpis;
  const statusData = (data?.statusShare ?? []).filter((s) => s.count > 0).map((s) => ({ name: STATUS_META[s.status].label, value: s.count, color: STATUS_META[s.status].hex }));
  const statusTotal = statusData.reduce((a, b) => a + b.value, 0);
  const categoryData = CATEGORIES.map((c) => data?.byCategory.find((b) => b.category === c.value)).filter((x): x is NonNullable<typeof x> => Boolean(x && x.reported));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="How fast the city fixes things, where problems cluster, and who is carrying the load. Computed on the server for the chosen period."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-ink/12 bg-surface p-0.5" role="radiogroup" aria-label="Period">
              {RANGES.map((r) => (
                <button key={r.days} type="button" role="radio" aria-checked={days === r.days} onClick={() => setDays(r.days)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${days === r.days ? "bg-accent text-paper" : "text-ink/60 hover:text-ink"}`}>
                  {r.label}
                </button>
              ))}
            </div>
            <a href={`/api/analytics/export.csv?days=${days}`} download className="btn btn-outline !rounded-full !py-2 text-xs"><Download size={15} aria-hidden /> CSV</a>
          </div>
        }
      />

      {!data || !k ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32 !rounded-2xl" />)}
          <Skeleton className="h-80 !rounded-2xl md:col-span-3 lg:col-span-4" />
          <Skeleton className="h-80 !rounded-2xl lg:col-span-2" />
        </div>
      ) : (
        <>
          {/* KPI bento */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Tile label="Reported" value={k.reported} icon={TrendingUp} delta={pct(k.reported, k.reportedPrev)} invert sub="vs previous period" />
            <Tile label="Fixed" value={k.resolved} icon={Zap} delta={pct(k.resolved, k.resolvedPrev)} sub="vs previous period" />
            <Tile label="Average fix time" value={formatDuration(k.avgFixHours)} icon={Timer} sub={`median ${formatDuration(k.medianFixHours)}`} />
            <Tile label="Fixed on time" value="" icon={Gauge} sub="within the fix-by clock">
              <Ring value={k.slaCompliance} size={76} stroke={8} tone={k.slaCompliance !== null && k.slaCompliance < 60 ? "var(--c-alert)" : "var(--c-resolved)"} />
            </Tile>
            <Tile label="Reopened by citizens" value={k.reopenRate === null ? "–" : `${k.reopenRate}%`} icon={RotateCcw} sub="of fixes were not really fixed" />
            <Tile label="First response" value={formatDuration(k.medianFirstResponseHours)} icon={Users} sub={`median · ${k.citizensEngaged} citizens took part`} />
          </div>

          {/* Trend + status */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              title="Reported vs fixed"
              note={`${data.weekly ? "Per week" : "Per day"}. When the green area sits above the blue, the backlog is shrinking.`}
              className="lg:col-span-2"
              action={
                <div className="flex gap-3 text-xs text-ink/65">
                  <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: series.reported }} /> Reported</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: series.resolved }} /> Fixed</span>
                </div>
              }
            >
              <div className="h-72 text-ink/50">
                <ResponsiveContainer>
                  <AreaChart data={trend} margin={{ left: -18, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="g-rep" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={series.reported} stopOpacity={0.18} /><stop offset="100%" stopColor={series.reported} stopOpacity={0} /></linearGradient>
                      <linearGradient id="g-fix" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={series.resolved} stopOpacity={0.18} /><stop offset="100%" stopColor={series.resolved} stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor" }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "currentColor" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{ stroke: "currentColor", strokeOpacity: 0.25 }} />
                    <Area type="monotone" name="Reported" dataKey="reported" stroke={series.reported} strokeWidth={2} fill="url(#g-rep)" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--c-surface)" }} />
                    <Area type="monotone" name="Fixed" dataKey="resolved" stroke={series.resolved} strokeWidth={2} fill="url(#g-fix)" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--c-surface)" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Where reports stand" note="Status of issues reported in this period.">
              <div className="relative h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="var(--c-surface)" strokeWidth={2}>
                      {statusData.map((s) => <Cell key={s.name} fill={s.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="font-display text-3xl font-bold">{statusTotal}</p>
                    <p className="text-xs text-ink/55">issues</p>
                  </div>
                </div>
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {statusData.map((s) => (
                  <li key={s.name} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-ink/70">{s.name}</span>
                    <span className="ml-auto font-semibold tabular-nums">{Math.round((s.value / Math.max(1, statusTotal)) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {/* Categories + heatmap */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="By kind of problem" note="Reports in this period, with average fix time and on-time share.">
              <div style={{ height: Math.max(180, categoryData.length * 44) }} className="text-ink/60">
                <ResponsiveContainer>
                  <BarChart data={categoryData.map((c) => ({ ...c, name: categoryMeta(c.category).label }))} layout="vertical" margin={{ left: 0, right: 40 }} barCategoryGap={10}>
                    <CartesianGrid horizontal={false} stroke="currentColor" strokeOpacity={0.12} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "currentColor" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 12, fill: "currentColor" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "currentColor", fillOpacity: 0.05 }} />
                    <Bar dataKey="reported" name="Reported" radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: "right", fontSize: 11, fill: "currentColor" }}>
                      {categoryData.map((c) => <Cell key={c.category} fill={catColor(c.category)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 divide-y divide-ink/8 text-xs">
                {categoryData.map((c) => (
                  <li key={c.category} className="flex items-center gap-3 py-2">
                    <CategoryChip category={c.category} size="sm" />
                    <span className="flex-1 font-medium">{categoryMeta(c.category).label}</span>
                    <span className="w-24 text-ink/60">{c.open} open now</span>
                    <span className="w-24 text-ink/60">{formatDuration(c.avgFixHours)}</span>
                    <span className={`w-14 text-right font-semibold ${c.slaCompliance !== null && c.slaCompliance < 60 ? "text-alert" : "text-resolved"}`}>{c.slaCompliance === null ? "–" : `${c.slaCompliance}%`}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="When problems are reported" note="Reports by hour and weekday (India time). Darker means more.">
              <div className="overflow-x-auto">
                <div className="min-w-[30rem]">
                  <div className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-[3px]">
                    <span />
                    {Array.from({ length: 24 }, (_, h) => (
                      <span key={h} className="text-center text-[9px] text-ink/45">{h % 3 === 0 ? h : ""}</span>
                    ))}
                    {heat.grid.map((row, d) => (
                      <div key={d} className="contents">
                        <span className="pr-1 text-right text-[11px] leading-5 text-ink/55">{DAYS[d]}</span>
                        {row.map((count, h) => (
                          <span
                            key={h}
                            onMouseEnter={() => setHoverCell({ day: d, hour: h, count })}
                            onMouseLeave={() => setHoverCell(null)}
                            title={`${DAYS[d]} ${h}:00 – ${count} reports`}
                            className="h-5 rounded-[4px] transition-transform hover:scale-125"
                            style={{ background: count ? `color-mix(in srgb, var(--c-accent) ${Math.round(12 + (count / heat.max) * 88)}%, transparent)` : "color-mix(in srgb, var(--c-ink) 5%, transparent)" }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-3 h-4 text-xs text-ink/60">
                {hoverCell ? `${DAYS[hoverCell.day]}, ${hoverCell.hour}:00–${hoverCell.hour + 1}:00 · ${hoverCell.count} ${hoverCell.count === 1 ? "report" : "reports"}` : "Hover a cell to see the count. Use this to plan crew shifts."}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-ink/5 p-3.5">
                  <p className="text-xs text-ink/55">Busiest hour</p>
                  <p className="font-display text-xl font-bold">{peaks.hour === null ? "–" : `${peaks.hour}:00–${peaks.hour + 1}:00`}</p>
                </div>
                <div className="rounded-2xl bg-ink/5 p-3.5">
                  <p className="text-xs text-ink/55">Busiest day</p>
                  <p className="font-display text-xl font-bold">{peaks.day === null ? "–" : DAYS[peaks.day]}</p>
                </div>
              </div>
              <p className="mt-5 text-xs font-semibold text-ink/60">Reports by hour of day</p>
              <div className="mt-2 h-40 text-ink/50">
                <ResponsiveContainer>
                  <BarChart data={peaks.byHour} margin={{ left: -26, right: 4 }} barCategoryGap={2}>
                    <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: "currentColor", fillOpacity: 0.05 }} />
                    <Bar dataKey="count" name="Reports" fill={series.reported} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* Areas x categories */}
          <Panel title="Busiest areas" note="Reports in this period by area and kind of problem. Helps decide where a ward needs more crews.">
            {data.areas.length === 0 ? (
              <p className="text-sm text-ink/55">No reports in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-separate border-spacing-[3px] text-xs">
                  <thead>
                    <tr>
                      <th className="text-left font-medium text-ink/55">Area</th>
                      {CATEGORIES.map((c) => (
                        <th key={c.value} className="font-medium text-ink/55">
                          <span className="inline-flex items-center gap-1"><c.icon size={12} style={{ color: catColor(c.value) }} aria-hidden /> {c.label}</span>
                        </th>
                      ))}
                      <th className="text-right font-medium text-ink/55">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.areas.map((a) => (
                      <tr key={a.area}>
                        <td className="whitespace-nowrap pr-2 font-semibold">{a.area}</td>
                        {CATEGORIES.map((c) => {
                          const n = a.counts[c.value] ?? 0;
                          return (
                            <td
                              key={c.value}
                              className="h-9 rounded-lg text-center font-semibold tabular-nums"
                              style={{ background: n ? `color-mix(in srgb, var(--c-accent) ${Math.round(10 + (n / areaMax) * 75)}%, transparent)` : "color-mix(in srgb, var(--c-ink) 4%, transparent)", color: n / areaMax > 0.55 ? "var(--c-paper)" : undefined }}
                            >
                              {n || ""}
                            </td>
                          );
                        })}
                        <td className="text-right font-display text-sm font-bold tabular-nums">{a.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Leaderboard + hotspots */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Panel title="Officer leaderboard" note="Fixes in this period, speed, on-time share and current load.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink/55">
                      <th className="pb-2 font-medium">Officer</th>
                      <th className="pb-2 font-medium">Fixed</th>
                      <th className="pb-2 font-medium">Avg time</th>
                      <th className="pb-2 font-medium">On time</th>
                      <th className="pb-2 font-medium">Open</th>
                      <th className="pb-2 font-medium">Reopened</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/8">
                    {data.leaderboard.map((o, i) => (
                      <tr key={o.id} className={o.active ? "" : "opacity-50"}>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className={`grid size-6 place-items-center rounded-full text-[11px] font-bold ${i === 0 && o.resolved ? "bg-marker text-[#241a00]" : "bg-ink/8"}`}>{i === 0 && o.resolved ? <Medal size={13} aria-hidden /> : i + 1}</span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{o.name}</p>
                              <p className="truncate text-[11px] text-ink/50">{o.department}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-16 overflow-hidden rounded-full bg-ink/8"><span className="block h-full rounded-full bg-accent" style={{ width: `${(o.resolved / leaderMax) * 100}%` }} /></span>
                            <span className="font-semibold tabular-nums">{o.resolved}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums">{formatDuration(o.avgFixHours)}</td>
                        <td className={`py-2.5 pr-3 font-semibold tabular-nums ${o.onTimeRate !== null && o.onTimeRate < 60 ? "text-alert" : "text-resolved"}`}>{o.onTimeRate === null ? "–" : `${o.onTimeRate}%`}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{o.open}{o.breached ? <span className="ml-1 text-xs font-semibold text-alert">({o.breached} late)</span> : null}</td>
                        <td className="py-2.5 tabular-nums">{o.reopened}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="Open hotspots" note="Each open issue as a glow; bigger and redder means higher priority.">
              <HeatSpots spots={data.hotspots} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
