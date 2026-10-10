import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Repeat, ArrowLeft, BadgeCheck, Bell, BellRing, ClipboardPen, Flag, Headset, ImagePlus, Layers, Link2, Share2, ThumbsDown, ThumbsUp, UserCheck, X } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { ActionMenu } from "../components/ActionMenu";
import { CategoryChip } from "../components/CategoryChip";
import { Discussion } from "../components/Discussion";
import { FlagDialog } from "../components/FlagDialog";
import { IssueMap } from "../components/IssueMap";
import { PriorityMeter } from "../components/PriorityMeter";
import { StatusBadge } from "../components/StatusBadge";
import { BeforeAfter } from "../components/BeforeAfter";
import { SlaCard } from "../components/SlaCard";
import { confetti } from "../lib/confetti";
import { StatusTracker } from "../components/StatusTracker";
import { ErrorNote, Skeleton } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { CHANNEL_META, formatDate, issueLabel, NEXT_STATUS, OPEN, SOURCE_META, STATUS_META } from "../lib/constants";
import { useToast } from "../lib/toast-context";
import { useIssueActions } from "../lib/useIssueActions";
import type { IssueDetail as Detail, Status, User } from "../types";

export default function IssueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const toast = useToast();
  const merged = (location.state as { merged?: boolean } | null)?.merged;

  const [issue, setIssue] = useState<Detail | null>(null);
  const [officers, setOfficers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [officerId, setOfficerId] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File[]>([]);
  const [flagOpen, setFlagOpen] = useState(false);
  const actions = useIssueActions();

  const role = user?.role;

  useEffect(() => {
    let active = true;
    api<{ issue: Detail }>(`/issues/${id}`)
      .then((data) => active && setIssue(data.issue))
      .catch((err) => active && setError(err instanceof ApiError ? err.message : "Could not load this issue"));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (role !== "admin") return;
    let active = true;
    api<{ users: User[] }>("/admin/users")
      .then((data) => active && setOfficers(data.users.filter((u) => u.role === "officer" && (u as { isActive?: boolean }).isActive !== false)))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [role]);

  async function act(request: () => Promise<{ issue: Detail }>, success: string) {
    setBusy(true);
    setActionError(null);
    try {
      const data = await request();
      // Action responses do not repeat the chronic-spot check, so keep the one we have.
      setIssue((prev) => ({ ...data.issue, chronic: prev?.chronic ?? null }));
      setNote("");
      setOfficerId("");
      setProof([]);
      toast.success(success);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong. Try again.";
      setActionError(message);
      toast.error(message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function changeStatus(next: Status) {
    const form = new FormData();
    form.append("status", next);
    if (note.trim()) form.append("note", note);
    proof.forEach((file) => form.append("photos", file));
    if (next === "resolved") {
      return act(() => api<{ issue: Detail }>(`/issues/${id}/status`, { method: "PATCH", body: form }), "Marked as fixed. Followers were asked to confirm.").then((ok) => ok && confetti());
    }
    return act(() => api<{ issue: Detail }>(`/issues/${id}/status`, { method: "PATCH", body: form }), `Status changed to ${STATUS_META[next].label.toLowerCase()}.`);
  }

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!issue || !user)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-16 w-2/3 !rounded-2xl" />
        <Skeleton className="h-72 w-full !rounded-2xl" />
      </div>
    );

  const isOpen = OPEN.includes(issue.status);
  const canUpdate = role === "admin" || (role === "officer" && issue.assignedTo?.id === user.id);
  const nextStatuses = NEXT_STATUS[issue.status];

  const before = issue.images[0];
  const resolution = [...issue.timeline].reverse().find((t) => t.status === "resolved" && t.images.length > 0);
  const after = issue.status === "resolved" ? resolution?.images[0] : undefined;

  return (
    <div className="space-y-6">
      <Link to={role === "citizen" ? "/my-reports" : "/issues"} className="inline-flex items-center gap-1 text-sm font-medium text-ink/60 hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> Back
      </Link>

      {merged !== undefined && (
        <p className="flex animate-pop items-start gap-2.5 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          <Layers size={18} className="mt-0.5 shrink-0" aria-hidden />
          {merged
            ? `Someone nearby had already reported this. Your report was added to it, and it now has ${issue.reportCount} reports.`
            : "Your report was submitted. You will see every update from the officer here."}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_21rem]">
        <div className="min-w-0 space-y-6">
          <header className="card flex items-start gap-4 p-5 animate-rise">
            <CategoryChip category={issue.category} icon={issue.customIcon} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-semibold">{issueLabel(issue)}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink/60">
                <span className="tabular-nums">{issue.ticket}</span>
                <StatusBadge status={issue.status} />
                <span>{issue.reportCount} {issue.reportCount === 1 ? "report" : "reports"}</span>
                {issue.category === "other" && <span className="rounded-full bg-ink/6 px-2 py-0.5 text-xs">Other</span>}
              </p>
              {issue.address && <p className="mt-2 text-sm text-ink/70">{issue.address}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const following = await actions.follow(issue);
                      setIssue({ ...issue, followedByMe: following });
                    } catch (err) {
                      actions.fail(err);
                    }
                  }}
                  aria-pressed={issue.followedByMe}
                  className={`btn !py-2 text-sm ${issue.followedByMe ? "btn-primary" : "btn-outline"}`}
                >
                  {issue.followedByMe ? <BellRing size={16} aria-hidden /> : <Bell size={16} aria-hidden />} {issue.followedByMe ? "Following" : "Follow"}
                </button>
                <button type="button" onClick={() => actions.share(issue)} className="btn btn-outline !py-2 text-sm">
                  <Share2 size={16} aria-hidden /> Share
                </button>
                <a href="#discussion" className="btn btn-ghost !py-2 text-sm">{issue.commentCount} {issue.commentCount === 1 ? "comment" : "comments"}</a>
              </div>
            </div>
            <ActionMenu
              items={[
                { label: "Copy public link", icon: Link2, onSelect: () => actions.copyLink(issue) },
                { label: "Report to admins", icon: Flag, onSelect: () => setFlagOpen(true), danger: true },
              ]}
            />
          </header>

          {issue.chronic && (
            <div className="flex items-start gap-3 rounded-2xl border border-alert/30 bg-alert/8 p-4 animate-rise">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-alert/15 text-alert"><Repeat size={19} aria-hidden /></span>
              <div className="min-w-0">
                <p className="font-semibold text-alert">Chronic spot: report {issue.chronic.count} of this kind here since {new Date(issue.chronic.since).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                <p className="mt-0.5 text-sm text-ink/70">
                  {issue.chronic.recurrences > 0 ? `It came back ${issue.chronic.recurrences} ${issue.chronic.recurrences === 1 ? "time" : "times"} after being marked fixed. ` : ""}
                  <span className="font-medium">Permanent fix suggested:</span> {issue.chronic.suggestion}
                </p>
              </div>
            </div>
          )}

          <div className="card p-5"><StatusTracker status={issue.status} /></div>

          {before && after ? (
            <section className="card p-5">
              <h2 className="text-lg font-semibold">Before and after</h2>
              <p className="text-xs text-ink/55">Drag the handle to compare.</p>
              <div className="mt-3"><BeforeAfter before={before.url} after={after.url} /></div>
            </section>
          ) : (
            issue.images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {issue.images.map((img) => (
                  <a key={img.url} href={img.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-ink/15">
                    <img src={img.url} alt="Reported problem" loading="lazy" className="h-40 object-cover transition-transform duration-500 hover:scale-105" />
                  </a>
                ))}
              </div>
            )
          )}

          <section>
            <h2 className="text-lg font-semibold">What was reported</h2>
            <ul className="mt-3 space-y-3">
              {issue.reports.map((report, index) => (
                <li key={index} className="card p-4 text-sm">
                  <p>{report.description}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink/50">
                    {formatDate(report.createdAt)}
                    {SOURCE_META[report.source] && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent">
                        {report.source === "field_inspection" ? <ClipboardPen size={11} aria-hidden /> : <Headset size={11} aria-hidden />}
                        {SOURCE_META[report.source]!.short}
                        {report.channel && ` · ${CHANNEL_META[report.channel]}`}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <IssueMap issues={[issue]} className="h-64" zoom={16} />

          <Discussion issueId={issue.id} onCountChange={(d) => setIssue((cur) => (cur ? { ...cur, commentCount: Math.max(0, cur.commentCount + d) } : cur))} />
        </div>

        <aside className="space-y-5">
          {issue.sla && <SlaCard sla={issue.sla} createdAt={issue.createdAt} />}
          <div className="card p-5">
            <PriorityMeter score={issue.priority} label={issue.priorityLabel} />
            <p className="mt-3 text-xs text-ink/60">
              Based on how hazardous the problem is, how many people reported it, citizen support and how long it has been open.
              {issue.escalated ? " Includes +15 for missing its fix-by time." : ""}
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm">
              <UserCheck size={16} className="text-ink/50" aria-hidden />
              {issue.assignedTo ? `${issue.assignedTo.name}${issue.assignedTo.department ? `, ${issue.assignedTo.department}` : ""}` : "Not assigned yet"}
            </p>
            {isOpen && (
              <button
                disabled={busy}
                onClick={() => act(() => api(`/issues/${issue.id}/support`, { method: "POST" }), issue.supportedByMe ? "Support removed." : "Thanks for supporting this issue.")}
                aria-pressed={issue.supportedByMe}
                className={`btn mt-4 w-full ${issue.supportedByMe ? "btn-primary" : "btn-outline"}`}
              >
                <ThumbsUp size={16} aria-hidden />
                {issue.supportedByMe ? "Supported" : "This affects me too"} · {issue.supporterCount}
              </button>
            )}
          </div>

          {issue.status === "resolved" && (
            <div className="rounded-2xl border border-resolved/40 bg-resolved/10 p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-resolved">
                <BadgeCheck size={18} aria-hidden /> Marked as resolved
              </h2>
              <p className="mt-2 text-sm text-ink/70">
                {issue.verification.fixed} confirmed fixed · {issue.verification.notFixed} say it is still there
              </p>
              {role === "citizen" && (
                <div className="mt-3">
                  <p className="text-sm font-medium">Is it really fixed?</p>
                  <div className="mt-2 flex gap-2">
                    {[
                      { fixed: true, label: "Yes, fixed", icon: ThumbsUp },
                      { fixed: false, label: "Still there", icon: ThumbsDown },
                    ].map(({ fixed, label, icon: Icon }) => (
                      <button
                        key={label}
                        disabled={busy}
                        aria-pressed={issue.verification.myVote === fixed}
                        onClick={() => act(() => api(`/issues/${issue.id}/verify`, { method: "POST", body: { fixed } }), "Thanks, your answer was recorded.")}
                        className={`btn flex-1 !px-2 !py-2 text-sm ${issue.verification.myVote === fixed ? "btn-primary" : "btn-outline"}`}
                      >
                        <Icon size={15} aria-hidden /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {role === "admin" && isOpen && (
            <div className="card p-5">
              <h2 className="text-base font-semibold">Assign to officer</h2>
              <select value={officerId} onChange={(e) => setOfficerId(e.target.value)} className="input mt-3 !py-2 text-sm">
                <option value="">Choose an officer</option>
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.department ? ` · ${o.department}` : ""}
                  </option>
                ))}
              </select>
              <button
                disabled={busy || !officerId}
                onClick={() => act(() => api(`/issues/${issue.id}/assign`, { method: "PATCH", body: { officerId } }), "Officer assigned.")}
                className="btn btn-primary mt-3 w-full"
              >
                Assign
              </button>
            </div>
          )}

          {canUpdate && nextStatuses.length > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-semibold">Update status</h2>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Note (required to resolve or reject)" className="input mt-3 text-sm" />
              <div className="mt-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-accent">
                  <ImagePlus size={16} aria-hidden />
                  {proof.length > 0 ? "Add another proof photo" : "Add proof photo (needed to resolve)"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? []);
                      setProof((prev) => [...prev, ...picked].slice(0, 2));
                      e.target.value = "";
                    }}
                  />
                </label>
                {proof.map((file, index) => (
                  <p key={index} className="mt-1 flex items-center justify-between gap-2 text-xs text-ink/70">
                    <span className="truncate">{file.name}</span>
                    <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setProof((prev) => prev.filter((_, i) => i !== index))}>
                      <X size={14} aria-hidden />
                    </button>
                  </p>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {nextStatuses.map((next) => (
                  <button key={next} disabled={busy} onClick={() => changeStatus(next)} className="btn btn-outline !px-3 !py-1.5 text-sm">
                    {next === "in_progress" && issue.status === "resolved" ? "Reopen" : `Mark ${STATUS_META[next].label.toLowerCase()}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {actionError && <ErrorNote>{actionError}</ErrorNote>}

          <section className="card p-5">
            <h2 className="text-base font-semibold">Timeline</h2>
            <ol className="mt-4 space-y-5 border-l-2 border-ink/12 pl-5">
              {[...issue.timeline].reverse().map((step, index) => (
                <li key={index} className="relative text-sm">
                  <span className="absolute -left-[1.78rem] top-1 size-3 rounded-full ring-4 ring-surface" style={{ background: STATUS_META[step.status].hex }} aria-hidden />
                  <p className="font-semibold">{STATUS_META[step.status].label}</p>
                  {step.note && <p className="mt-0.5 text-ink/70">{step.note}</p>}
                  {step.images.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {step.images.map((img) => (
                        <a key={img.url} href={img.url} target="_blank" rel="noreferrer">
                          <img src={img.url} alt="Proof" loading="lazy" className="size-16 rounded-lg border border-ink/15 object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-ink/50">
                    {formatDate(step.at)}
                    {step.byName ? ` · ${step.byName}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
      <FlagDialog open={flagOpen} endpoint={`/issues/${issue.id}/flag`} what="issue" onClose={() => setFlagOpen(false)} onDone={() => setFlagOpen(false)} />
    </div>
  );
}
