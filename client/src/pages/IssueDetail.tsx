import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, ImagePlus, Layers, ThumbsDown, ThumbsUp, UserCheck, X } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { CategoryIcon } from "../components/CategoryIcon";
import { IssueMap } from "../components/IssueMap";
import { PriorityMeter } from "../components/PriorityMeter";
import { StatusBadge } from "../components/StatusBadge";
import { api, ApiError } from "../lib/api";
import { categoryMeta, formatDate, NEXT_STATUS, OPEN, STATUS_META } from "../lib/constants";
import type { IssueDetail as Detail, Status, User } from "../types";

const selectClass = "w-full rounded border border-ink/25 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-signboard";

export default function IssueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const merged = (location.state as { merged?: boolean } | null)?.merged;

  const [issue, setIssue] = useState<Detail | null>(null);
  const [officers, setOfficers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [officerId, setOfficerId] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<File[]>([]);

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
      .then((data) => active && setOfficers(data.users.filter((u) => u.role === "officer")))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [role]);

  async function act(request: () => Promise<{ issue: Detail }>) {
    setBusy(true);
    setActionError(null);
    try {
      const data = await request();
      setIssue(data.issue);
      setNote("");
      setOfficerId("");
      setProof([]);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function changeStatus(next: Status) {
    const form = new FormData();
    form.append("status", next);
    if (note.trim()) form.append("note", note);
    proof.forEach((file) => form.append("photos", file));
    return act(() => api<{ issue: Detail }>(`/issues/${id}/status`, { method: "PATCH", body: form }));
  }

  if (error) return <p className="text-sm text-alert">{error}</p>;
  if (!issue || !user) return <p className="text-sm text-ink/60">Loading…</p>;

  const isOpen = OPEN.includes(issue.status);
  const canUpdate = role === "admin" || (role === "officer" && issue.assignedTo?.id === user.id);
  const nextStatuses = NEXT_STATUS[issue.status];

  const before = issue.images[0];
  const resolution = [...issue.timeline].reverse().find((t) => t.status === "resolved" && t.images.length > 0);
  const after = issue.status === "resolved" ? resolution?.images[0] : undefined;

  return (
    <div>
      <Link
        to={role === "citizen" ? "/my-reports" : "/issues"}
        className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden /> Back
      </Link>

      {merged !== undefined && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-signboard/30 bg-signboard/10 px-4 py-3 text-sm text-signboard">
          <Layers size={18} className="mt-0.5 shrink-0" aria-hidden />
          {merged
            ? `Someone nearby had already reported this. Your report was added to it, and it now has ${issue.reportCount} reports.`
            : "Your report was submitted. You will see every update from the officer here."}
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          <header className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-signboard/10 text-signboard">
              <CategoryIcon category={issue.category} size={24} />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{categoryMeta(issue.category).label}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink/60">
                <span className="tabular-nums">{issue.ticket}</span>
                <StatusBadge status={issue.status} />
                <span>
                  {issue.reportCount} {issue.reportCount === 1 ? "report" : "reports"}
                </span>
              </p>
            </div>
          </header>

          {issue.address && <p className="text-sm text-ink/70">Landmark: {issue.address}</p>}

          {before && after ? (
            <section>
              <h2 className="text-sm font-medium text-ink/60">Before and after</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {[
                  { label: "Before", url: before.url },
                  { label: "After", url: after.url },
                ].map((item) => (
                  <a key={item.label} href={item.url} target="_blank" rel="noreferrer" className="block">
                    <img
                      src={item.url}
                      alt={`${item.label} the fix`}
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-md border border-ink/15 object-cover"
                    />
                    <span className="mt-1 block text-xs font-medium text-ink/60">{item.label}</span>
                  </a>
                ))}
              </div>
            </section>
          ) : (
            issue.images.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {issue.images.map((img) => (
                  <a key={img.url} href={img.url} target="_blank" rel="noreferrer">
                    <img
                      src={img.url}
                      alt="Reported problem"
                      loading="lazy"
                      className="h-36 rounded-md border border-ink/15 object-cover"
                    />
                  </a>
                ))}
              </div>
            )
          )}

          <section>
            <h2 className="text-sm font-medium text-ink/60">What citizens reported</h2>
            <ul className="mt-3 space-y-3">
              {issue.reports.map((report, index) => (
                <li key={index} className="rounded-lg border border-ink/15 bg-white p-4 text-sm">
                  <p>{report.description}</p>
                  <p className="mt-2 text-xs text-ink/50">{formatDate(report.createdAt)}</p>
                </li>
              ))}
            </ul>
          </section>

          <IssueMap issues={[issue]} className="h-64" zoom={16} />
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-ink/15 bg-white p-4">
            <PriorityMeter score={issue.priority} label={issue.priorityLabel} />
            <p className="mt-3 text-xs text-ink/60">
              Based on how hazardous the problem is, how many people reported it, citizen support and how long it has
              been open.
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm">
              <UserCheck size={16} className="text-ink/50" aria-hidden />
              {issue.assignedTo
                ? `${issue.assignedTo.name}${issue.assignedTo.department ? `, ${issue.assignedTo.department}` : ""}`
                : "Not assigned yet"}
            </p>
            {isOpen && (
              <button
                disabled={busy}
                onClick={() => act(() => api(`/issues/${issue.id}/support`, { method: "POST" }))}
                aria-pressed={issue.supportedByMe}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60 ${
                  issue.supportedByMe
                    ? "border-signboard bg-signboard text-white"
                    : "border-ink/25 bg-white hover:border-signboard"
                }`}
              >
                <ThumbsUp size={16} aria-hidden />
                {issue.supportedByMe ? "Supported" : "This affects me too"} · {issue.supporterCount}
              </button>
            )}
          </div>

          {issue.status === "resolved" && (
            <div className="rounded-lg border border-resolved/40 bg-resolved/10 p-4">
              <h2 className="flex items-center gap-2 text-sm font-medium text-resolved">
                <BadgeCheck size={17} aria-hidden /> Marked as resolved
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
                        onClick={() =>
                          act(() => api(`/issues/${issue.id}/verify`, { method: "POST", body: { fixed } }))
                        }
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-sm disabled:opacity-60 ${
                          issue.verification.myVote === fixed
                            ? "border-signboard bg-signboard text-white"
                            : "border-ink/25 bg-white hover:border-signboard"
                        }`}
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
            <div className="rounded-lg border border-ink/15 bg-white p-4">
              <h2 className="text-sm font-medium">Assign to officer</h2>
              <select value={officerId} onChange={(e) => setOfficerId(e.target.value)} className={`${selectClass} mt-3`}>
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
                onClick={() => act(() => api(`/issues/${issue.id}/assign`, { method: "PATCH", body: { officerId } }))}
                className="mt-3 w-full rounded-md bg-signboard px-3 py-2 text-sm font-medium text-white hover:bg-signboard/90 disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          )}

          {canUpdate && nextStatuses.length > 0 && (
            <div className="rounded-lg border border-ink/15 bg-white p-4">
              <h2 className="text-sm font-medium">Update status</h2>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Note (required to resolve or reject)"
                className={`${selectClass} mt-3`}
              />
              <div className="mt-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-signboard">
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
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setProof((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </p>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {nextStatuses.map((next) => (
                  <button
                    key={next}
                    disabled={busy}
                    onClick={() => changeStatus(next)}
                    className="rounded-md border border-ink/25 bg-white px-3 py-1.5 text-sm hover:border-signboard disabled:opacity-50"
                  >
                    {next === "in_progress" && issue.status === "resolved"
                      ? "Reopen"
                      : `Mark ${STATUS_META[next].label.toLowerCase()}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {actionError && <p className="text-sm text-alert">{actionError}</p>}

          <section>
            <h2 className="text-sm font-medium text-ink/60">Timeline</h2>
            <ol className="mt-3 space-y-4 border-l border-ink/20 pl-4">
              {[...issue.timeline].reverse().map((step, index) => (
                <li key={index} className="relative text-sm">
                  <span
                    className="absolute -left-[1.4rem] top-1 size-2.5 rounded-full ring-4 ring-paper"
                    style={{ background: STATUS_META[step.status].hex }}
                    aria-hidden
                  />
                  <p className="font-medium">{STATUS_META[step.status].label}</p>
                  {step.note && <p className="text-ink/70">{step.note}</p>}
                  {step.images.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {step.images.map((img) => (
                        <a key={img.url} href={img.url} target="_blank" rel="noreferrer">
                          <img src={img.url} alt="Proof" loading="lazy" className="size-16 rounded border border-ink/15 object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-ink/50">
                    {formatDate(step.at)}
                    {step.byName ? ` · ${step.byName}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
