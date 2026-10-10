import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowBigUp, Layers, Link2, MessageSquare, Share2 } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { CategoryChip } from "../components/CategoryChip";
import { Logo } from "../components/Logo";
import { PublicMap } from "../components/PublicMap";
import { StatusBadge } from "../components/StatusBadge";
import { StatusTracker } from "../components/StatusTracker";
import { ThemeToggle } from "../components/ThemeToggle";
import { Skeleton } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { copyText, publicLink, shareIssue } from "../lib/community";
import { formatDate, issueLabel, STATUS_META } from "../lib/constants";
import { formatDuration } from "../lib/format";
import { useToast } from "../lib/toast-context";
import type { PublicIssue as Data } from "../types";

// Read-only page anyone can open from a shared link. No names, no login.
export default function PublicIssue() {
  const { ticket = "" } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [issue, setIssue] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<{ issue: Data }>(`/public/issues/${encodeURIComponent(ticket)}`)
      .then((data) => {
        if (!active) return;
        setIssue(data.issue);
        document.title = `${issueLabel(data.issue)} · ${data.issue.ticket} · CiviConnect`;
      })
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Could not load this issue"));
    return () => {
      active = false;
      document.title = "CiviConnect";
    };
  }, [ticket]);

  async function share() {
    if (!issue) return;
    const result = await shareIssue(issue.ticket, issueLabel(issue));
    if (result === "copied") toast.success("Paste it anywhere to share this issue.", { title: "Link copied" });
  }

  const hours = issue?.resolvedAt ? (new Date(issue.resolvedAt).getTime() - new Date(issue.createdAt).getTime()) / 3_600_000 : null;

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-[2000] border-b border-ink/10 bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link to={user ? "/neighbourhood" : "/login"} className="btn btn-primary !py-2 text-sm">{user ? "Open the app" : "Log in"}</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
        {error ? (
          <div className="card px-6 py-16 text-center">
            <p className="font-display text-6xl font-bold text-accent/30">404</p>
            <h1 className="mt-2 text-2xl font-semibold">{error}</h1>
            <p className="mt-2 text-sm text-ink/60">The link may be mistyped, or the issue was removed.</p>
            <Link to="/" className="btn btn-primary mt-6">Go to CiviConnect</Link>
          </div>
        ) : !issue ? (
          <>
            <Skeleton className="h-36 w-full !rounded-2xl" />
            <Skeleton className="h-72 w-full !rounded-2xl" />
          </>
        ) : (
          <>
            <section className="card overflow-hidden animate-rise">
              <div className="flex flex-wrap items-start gap-4 p-5 sm:p-6">
                <CategoryChip category={issue.category} icon={issue.customIcon} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent">Public civic issue · {issue.ticket}</p>
                  <h1 className="mt-1 text-3xl font-semibold">{issueLabel(issue)}</h1>
                  {issue.address && <p className="mt-1.5 text-sm text-ink/70">{issue.address}</p>}
                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink/60">
                    <StatusBadge status={issue.status} />
                    <span className="inline-flex items-center gap-1"><Layers size={15} aria-hidden /> {issue.reportCount} {issue.reportCount === 1 ? "report" : "reports"}</span>
                    <span className="inline-flex items-center gap-1"><ArrowBigUp size={16} aria-hidden /> {issue.supporterCount} affected</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare size={15} aria-hidden /> {issue.commentCount} comments</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={share} className="btn btn-outline !py-2 text-sm"><Share2 size={16} aria-hidden /> Share</button>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await copyText(publicLink(issue.ticket));
                      if (r === "copied") toast.success("Link copied.");
                    }}
                    aria-label="Copy link"
                    className="btn btn-ghost size-10 !p-0"
                  >
                    <Link2 size={17} aria-hidden />
                  </button>
                </div>
              </div>
              <div className="border-t border-ink/8 p-5 sm:p-6"><StatusTracker status={issue.status} /></div>
              {hours !== null && (
                <p className="border-t border-ink/8 bg-resolved/8 px-6 py-3 text-sm font-medium text-resolved">Fixed in {formatDuration(hours)} from the first report.</p>
              )}
            </section>

            {(issue.before || issue.after) && (
              <section className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Reported", img: issue.before, tone: "bg-alert/10 text-alert" },
                  { label: "After the fix", img: issue.after, tone: "bg-resolved/15 text-resolved" },
                ]
                  .filter((x) => x.img)
                  .map((x) => (
                    <figure key={x.label} className="card overflow-hidden">
                      <img src={x.img!.url} alt={x.label} className="aspect-[4/3] w-full object-cover" />
                      <figcaption className="p-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${x.tone}`}>{x.label}</span></figcaption>
                    </figure>
                  ))}
              </section>
            )}

            <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
              <div className="card overflow-hidden p-2">
                <PublicMap
                  pins={[{ id: issue.ticket, ticket: issue.ticket, category: issue.category, customIcon: issue.customIcon, customLabel: issue.customLabel, status: issue.status, reportCount: issue.reportCount, location: issue.location }]}
                  className="h-72"
                />
              </div>
              <section className="card p-5">
                <h2 className="text-base font-semibold">What happened</h2>
                <ol className="mt-4 space-y-4 border-l-2 border-ink/12 pl-5">
                  {[...issue.timeline].reverse().map((step, i) => (
                    <li key={i} className="relative text-sm">
                      <span className="absolute -left-[1.78rem] top-1 size-3 rounded-full ring-4 ring-surface" style={{ background: STATUS_META[step.status].hex }} aria-hidden />
                      <p className="font-semibold">{STATUS_META[step.status].label}</p>
                      {step.note && <p className="mt-0.5 text-ink/70">{step.note}</p>}
                      <p className="mt-1 text-xs text-ink/50">{formatDate(step.at)}</p>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <section className="relative overflow-hidden rounded-3xl bg-signboard px-6 py-10 text-center text-white">
              <div className="grid-paper pointer-events-none absolute inset-0 opacity-25" aria-hidden />
              <h2 className="relative text-2xl font-semibold">Does this affect you too?</h2>
              <p className="relative mx-auto mt-2 max-w-md text-sm text-white/75">Log in to upvote it, add a photo of how it looks now, and get told the moment it is fixed.</p>
              <Link to={user ? "/neighbourhood" : "/register"} className="btn btn-marker relative mt-6 !px-6 !py-3">{user ? "See your neighbourhood" : "Join CiviConnect free"}</Link>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
