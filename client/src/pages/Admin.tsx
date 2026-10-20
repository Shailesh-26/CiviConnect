import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { Download, FileText,
  BrainCircuit,
  Plane,
  Bot,
  CheckCircle2,
  Flag,
  History,
  Mail,
  MessageSquare,
  Search,
  ShieldCheck,
  ShieldUser,
  Timer,
  Trash2,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { Avatar } from "../components/Avatar";
import { CategoryChip } from "../components/CategoryChip";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DepartmentPicker } from "../components/DepartmentPicker";
import { LeaveDialog } from "../components/LeaveDialog";
import { Pagination } from "../components/Pagination";
import { Field } from "../components/Field";
import { ModelCard } from "../components/ModelCard";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState, ErrorNote, ListSkeleton, PageHeader, Switch } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { FLAG_REASONS } from "../lib/community";
import { categoryMeta, issueLabel } from "../lib/constants";
import { timeAgo } from "../lib/format";
import { useToast } from "../lib/toast-context";
import type { AdminUser, AuditEntry, CategorySla, FlagGroup, Role } from "../types";

type Tab = "people" | "moderation" | "sla" | "audit" | "ai";
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "people", label: "People", icon: Users },
  { id: "moderation", label: "Moderation", icon: Flag },
  { id: "sla", label: "Categories & SLA", icon: Timer },
  { id: "audit", label: "Audit log", icon: History },
  { id: "ai", label: "Photo Assistant", icon: BrainCircuit },
];

function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[2500] flex justify-end">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label={title} className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-ink/10 bg-surface p-6 shadow-lift animate-rise">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-xl text-ink/55 hover:bg-ink/6"><X size={18} aria-hidden /></button>
        </div>
        <div className="mt-5">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- People

const ROLE_BADGE: Record<Role, string> = {
  citizen: "bg-ink/8 text-ink/70",
  officer: "bg-accent/12 text-accent",
  admin: "bg-marker/20 text-marker-dark",
};

function People() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "all">("all");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmOff, setConfirmOff] = useState<AdminUser | null>(null);
  const [endLeaveFor, setEndLeaveFor] = useState<AdminUser | null>(null);
  const [leaveFor, setLeaveFor] = useState<AdminUser | null>(null);
  const [leaveBusy, setLeaveBusy] = useState(false);

  const load = useCallback(() => {
    api<{ users: AdminUser[] }>("/admin/users")
      .then((d) => setUsers(d.users))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load people"));
  }, []);
  useEffect(load, [load]);

  async function patch(target: AdminUser, body: Partial<{ isActive: boolean; role: Role; department: string; onLeave: boolean; leaveUntil: string | null; leaveReason: string }>) {
    try {
      const d = await api<{ user: AdminUser; moved?: { ticket: string; to: string | null }[]; back?: { returned: unknown[]; kept: unknown[] } | null }>(`/admin/users/${target.id}`, { method: "PATCH", body });
      setUsers((all) => (all ?? []).map((u) => (u.id === target.id ? { ...u, ...d.user } : u)));
      if (body.onLeave !== undefined) {
        const moved = d.moved ?? [];
        const handed = moved.filter((m) => m.to).length;
        toast.success(
          body.onLeave
            ? moved.length ? `${handed} of ${moved.length} open ${moved.length === 1 ? "issue" : "issues"} handed to colleagues${moved.length - handed ? `, ${moved.length - handed} back to Unassigned` : ""}.` : "No open issues needed to move."
            : `${target.name} can get new assignments again.${d.back?.returned.length ? ` ${d.back.returned.length} not-yet-started ${d.back.returned.length === 1 ? "issue went" : "issues went"} back to them.` : ""}`,
          { title: body.onLeave ? `${target.name} is on leave` : "Back from leave" },
        );
        return true;
      }
      toast.success(body.isActive === false ? `${target.name} can no longer log in.` : body.isActive ? `${target.name} can log in again.` : "Changes saved.", { title: "Updated" });
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save. Try again.");
      return false;
    }
  }

  const departments = useMemo(() => [...new Set((users ?? []).filter((u) => u.role !== "citizen" && u.department).map((u) => u.department as string))], [users]);
  const counts = useMemo(() => {
    const all = users ?? [];
    return { all: all.length, citizen: all.filter((u) => u.role === "citizen").length, officer: all.filter((u) => u.role === "officer").length, admin: all.filter((u) => u.role === "admin").length };
  }, [users]);

  const visible = (users ?? []).filter((u) => (role === "all" || u.role === role) && `${u.name} ${u.email} ${u.department ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));

  if (error) return <ErrorNote>{error}</ErrorNote>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or department" aria-label="Search people" className="input !pl-10" />
        </div>
        <button type="button" onClick={() => setAdding(true)} className="btn btn-primary"><UserPlus size={17} aria-hidden /> Add officer</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["all", "citizen", "officer", "admin"] as const).map((r) => (
          <button key={r} type="button" onClick={() => setRole(r)} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition ${role === r ? "border-accent bg-accent text-paper" : "border-ink/15 bg-surface text-ink/70 hover:border-ink/35"}`}>
            {r === "all" ? "Everyone" : `${r}s`} {users && <span className="ml-1 tabular-nums opacity-70">{counts[r]}</span>}
          </button>
        ))}
      </div>

      {users === null ? (
        <ListSkeleton rows={5} />
      ) : visible.length === 0 ? (
        <EmptyState icon={Users} title="Nobody matches" text="Try another name or role." />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-ink/8">
            {visible.map((u) => (
              <li key={u.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-ink/[0.03] sm:flex-nowrap ${u.isActive ? "" : "opacity-60"}`}>
                <Avatar name={u.name} avatar={u.avatar} />
                <button type="button" onClick={() => setEditing(u)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold">{u.name} {u.id === me?.id && <span className="text-xs font-normal text-ink/45">(you)</span>}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-ink/55"><Mail size={12} aria-hidden /> {u.email}</p>
                </button>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                {u.role === "officer" && u.isActive && (
                  u.onLeave ? (
                    <button type="button" onClick={() => setEndLeaveFor(u)} title="End leave" className="inline-flex items-center gap-1 rounded-full bg-marker/20 px-2.5 py-0.5 text-xs font-semibold text-marker-dark transition hover:bg-marker/30">
                      <Plane size={12} aria-hidden /> On leave{u.onLeave.until ? ` · till ${new Date(u.onLeave.until).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}{u.onLeave.reason ? ` · ${u.onLeave.reason}` : ""} · end
                    </button>
                  ) : (
                    <button type="button" onClick={() => setLeaveFor(u)} className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-2.5 py-0.5 text-xs font-medium text-ink/60 transition hover:border-ink/35 hover:text-ink">
                      <Plane size={12} aria-hidden /> Leave
                    </button>
                  )
                )}
                <span className="hidden w-40 truncate text-xs text-ink/60 md:block">{u.department ?? (u.role === "citizen" ? `${u.reportCount} reports` : "")}</span>
                <span className="hidden w-24 text-xs text-ink/50 lg:block">Joined {timeAgo(u.createdAt)}</span>
                <div className="w-36">
                  <Switch
                    label={u.isActive ? "Active" : "Deactivated"}
                    checked={u.isActive}
                    onChange={(v) => {
                      if (v) void patch(u, { isActive: true });
                      else if (u.id === me?.id) toast.info("You can't deactivate your own account. Another admin can do it for you.", { title: "That's you" });
                      else setConfirmOff(u);
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <EditUser user={editing} onClose={() => setEditing(null)} onSave={async (body) => editing && (await patch(editing, body)) && setEditing(null)} isMe={editing?.id === me?.id} departments={departments} />
      <AddOfficer open={adding} departments={departments} onClose={() => setAdding(false)} onCreated={(u) => { setUsers((all) => [u, ...(all ?? [])]); setAdding(false); }} />
      <LeaveDialog
        key={leaveFor?.id ?? "none"}
        open={Boolean(leaveFor)}
        who={leaveFor?.name ?? ""}
        self={false}
        busy={leaveBusy}
        onCancel={() => setLeaveFor(null)}
        onConfirm={async (until, reason) => {
          if (!leaveFor) return;
          setLeaveBusy(true);
          await patch(leaveFor, { onLeave: true, leaveUntil: until, leaveReason: reason });
          setLeaveBusy(false);
          setLeaveFor(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(confirmOff)}
        icon={ShieldUser}
        tone="danger"
        title={`Deactivate ${confirmOff?.name ?? ""}?`}
        message="They will be logged out and cannot sign in until you reactivate them. Their reports and history stay."
        confirmLabel="Deactivate"
        onConfirm={async () => {
          if (confirmOff) await patch(confirmOff, { isActive: false });
          setConfirmOff(null);
        }}
        onCancel={() => setConfirmOff(null)}
      />
      <ConfirmDialog
        open={Boolean(endLeaveFor)}
        icon={Plane}
        title={`End ${endLeaveFor?.name ?? ""}'s leave?`}
        message={`${endLeaveFor?.name ?? "They"} can get new assignments again. Issues handed over that nobody has started yet go back to them; work a colleague has started stays with that colleague.`}
        confirmLabel="End leave"
        cancelLabel="Keep on leave"
        onConfirm={async () => {
          if (endLeaveFor) await patch(endLeaveFor, { onLeave: false });
          setEndLeaveFor(null);
        }}
        onCancel={() => setEndLeaveFor(null)}
      />
    </div>
  );
}

function EditUser({ user, onClose, onSave, isMe, departments }: { user: AdminUser | null; onClose: () => void; onSave: (b: Partial<{ role: Role; department: string }>) => void; isMe: boolean; departments: string[] }) {
  const [role, setRole] = useState<Role>("citizen");
  const [department, setDepartment] = useState("");
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (user && shownFor !== user.id) {
    setShownFor(user.id);
    setRole(user.role);
    setDepartment(user.department ?? "");
  }
  return (
    <Drawer open={Boolean(user)} title="Edit person" onClose={onClose}>
      {user && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} avatar={user.avatar} size="lg" />
            <div>
              <p className="font-display text-lg font-semibold">{user.name}</p>
              <p className="text-sm text-ink/55">{user.email}</p>
              <p className="text-xs text-ink/45">{user.reportCount} reports · joined {timeAgo(user.createdAt)}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Role</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["citizen", "officer", "admin"] as const).map((r) => (
                <button key={r} type="button" disabled={isMe && r !== "admin"} onClick={() => setRole(r)} className={`rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition disabled:opacity-40 ${role === r ? "border-accent bg-accent/10 text-accent" : "border-ink/15 hover:border-ink/35"}`}>
                  {r}
                </button>
              ))}
            </div>
            {isMe && <p className="mt-1.5 text-xs text-ink/50">You cannot remove your own admin role.</p>}
          </div>
          {role !== "citizen" && (
            <DepartmentPicker key={user.id} value={department} onChange={setDepartment} existing={departments} />
          )}
          <button type="button" onClick={() => onSave({ ...(role !== user.role ? { role } : {}), ...(department !== (user.department ?? "") ? { department } : {}) })} className="btn btn-primary w-full">
            Save changes
          </button>
        </div>
      )}
    </Drawer>
  );
}

function AddOfficer({ open, onClose, onCreated, departments }: { open: boolean; onClose: () => void; onCreated: (u: AdminUser) => void; departments: string[] }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", department: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const d = await api<{ user: AdminUser }>("/admin/officers", { method: "POST", body: form });
      toast.success(`${d.user.name} can now log in and receive assignments.`, { title: "Officer added" });
      setForm({ name: "", email: "", password: "", department: "" });
      onCreated(d.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        if (!Object.keys(err.fieldErrors).length) toast.error(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={open} title="Add an officer" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" value={form.name} onChange={set("name")} error={errors.name} />
        <Field label="Work email" type="email" value={form.email} onChange={set("email")} error={errors.email} />
        <DepartmentPicker key={String(open)} value={form.department} onChange={set("department")} existing={departments} error={errors.department} />
        <Field label="Temporary password" type="password" value={form.password} onChange={set("password")} error={errors.password} hint="At least 8 characters with a letter and a number. Ask them to change it from their profile." />
        <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy ? "Creating…" : "Create officer"}</button>
      </form>
    </Drawer>
  );
}

// ---------------------------------------------------------------- Moderation

function Moderation() {
  const toast = useToast();
  const [view, setView] = useState<"open" | "closed">("open");
  const [groups, setGroups] = useState<FlagGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<FlagGroup | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ groups: FlagGroup[] }>(`/admin/flags?status=${view}`)
      .then((d) => setGroups(d.groups))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load the queue"));
  }, [view]);
  useEffect(load, [load]);

  async function act(g: FlagGroup, action: "dismiss" | "remove") {
    setBusy(g.targetId);
    try {
      await api("/admin/flags/resolve", { method: "POST", body: { targetType: g.targetType, targetId: g.targetId, action } });
      setGroups((all) => (all ?? []).filter((x) => x.targetId !== g.targetId));
      toast.success(action === "remove" ? `The ${g.targetType} was removed and the decision logged.` : `The ${g.targetType} stays up. Reports closed.`, { title: action === "remove" ? "Removed" : "Kept" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the decision.");
    } finally {
      setBusy(null);
    }
  }

  const reasonLabel = (r: string) => FLAG_REASONS.find((x) => x.value === r)?.label ?? r;

  if (error) return <ErrorNote>{error}</ErrorNote>;
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {(["open", "closed"] as const).map((v) => (
          <button key={v} type="button" onClick={() => { setGroups(null); setView(v); }} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${view === v ? "bg-ink text-paper" : "text-ink/65 hover:bg-ink/6"}`}>
            {v === "open" ? "Waiting for review" : "Decided"}
          </button>
        ))}
      </div>
      {groups === null ? (
        <ListSkeleton rows={3} />
      ) : groups.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={view === "open" ? "Nothing to review" : "No decisions yet"} text="Citizens can report fake, duplicate or abusive content. It shows up here." />
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={`${g.targetType}-${g.targetId}`} className="card p-5 animate-rise">
              <div className="flex flex-wrap items-start gap-3">
                <span className={`grid size-10 place-items-center rounded-xl ${g.targetType === "comment" ? "bg-accent/12 text-accent" : "bg-marker/20 text-marker-dark"}`}>
                  {g.targetType === "comment" ? <MessageSquare size={18} aria-hidden /> : <Flag size={18} aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {g.count} {g.count === 1 ? "report" : "reports"} on {g.targetType === "comment" ? "a comment" : "an issue"}
                    <span className="ml-2 text-xs font-normal text-ink/50">last {timeAgo(g.lastAt)}</span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Object.entries(g.reasons).map(([r, n]) => (
                      <span key={r} className="rounded-full bg-alert/10 px-2.5 py-0.5 text-xs font-medium text-alert">{reasonLabel(r)}{n && n > 1 ? ` ×${n}` : ""}</span>
                    ))}
                  </div>
                </div>
                {view === "open" && (
                  <div className="flex gap-2">
                    <button type="button" disabled={busy === g.targetId} onClick={() => act(g, "dismiss")} className="btn btn-outline !py-2 text-sm"><CheckCircle2 size={15} aria-hidden /> Keep</button>
                    <button type="button" disabled={busy === g.targetId} onClick={() => setRemoving(g)} className="btn bg-alert !py-2 text-sm text-white hover:brightness-110"><Trash2 size={15} aria-hidden /> Remove</button>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-ink/10 bg-paper/60 p-4">
                {g.comment ? (
                  <>
                    <p className="text-xs text-ink/50">{g.comment.author} wrote{g.comment.hidden ? " · hidden from others" : ""}{g.comment.deleted ? " · deleted" : ""}</p>
                    <p className="mt-1 whitespace-pre-line text-sm">“{g.comment.body ?? "(deleted)"}”</p>
                  </>
                ) : null}
                {g.issue && (
                  <Link to={`/issues/${g.issue.id}`} className={`flex items-start gap-3 ${g.comment ? "mt-3 border-t border-ink/8 pt-3" : ""}`}>
                    <CategoryChip category={g.issue.category} icon={g.issue.customIcon} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold hover:text-accent">{issueLabel(g.issue)} · {g.issue.ticket}</span>
                      {!g.comment && <span className="mt-0.5 line-clamp-2 block text-xs text-ink/60">{g.issue.description}</span>}
                    </span>
                    <StatusBadge status={g.issue.status} />
                  </Link>
                )}
              </div>
              {g.notes.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-ink/60">
                  {g.notes.slice(0, 3).map((n, i) => <li key={i}>Note: “{n}”</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        icon={Trash2}
        tone="danger"
        title={removing?.targetType === "comment" ? "Remove this comment?" : "Remove this issue?"}
        message={removing?.targetType === "comment" ? "It is replaced with “This comment was deleted” for everyone." : "The issue is closed as rejected with a moderation note on its timeline. Followers can still see why."}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (removing) await act(removing, "remove");
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Categories & SLA

function SlaSettings() {
  const toast = useToast();
  const [rows, setRows] = useState<CategorySla[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api<{ categories: CategorySla[] }>("/admin/categories").then((d) => setRows(d.categories)).catch(() => setRows([]));
  }, []);

  async function save(row: CategorySla) {
    const hours = Number(draft[row.category]);
    if (!Number.isInteger(hours) || hours < 1 || hours > 1440) {
      toast.error("Use whole hours between 1 and 1440.");
      return;
    }
    setSaving(row.category);
    try {
      const d = await api<{ updated: number; deEscalated: number }>(`/admin/categories/${row.category}`, { method: "PUT", body: { slaHours: hours } });
      setRows((all) => (all ?? []).map((r) => (r.category === row.category ? { ...r, slaHours: hours } : r)));
      setDraft((x) => ({ ...x, [row.category]: "" }));
      toast.success(`${d.updated} open issues got the new fix-by time${d.deEscalated ? `, ${d.deEscalated} are no longer overdue` : ""}.`, { title: `${categoryMeta(row.category).label}: ${hours} h` });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setSaving(null);
    }
  }

  if (!rows) return <ListSkeleton rows={4} />;
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-2xl border border-accent/25 bg-accent/8 px-4 py-3 text-sm text-ink/75">
        <Bot size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        Every minute the server checks these clocks. Officers get a warning when a quarter of the time is left; overdue issues escalate automatically, get +15 priority and alert admins.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => {
          const value = draft[row.category] ?? "";
          const dirty = value !== "" && Number(value) !== row.slaHours;
          return (
            <div key={row.category} className="card p-5">
              <div className="flex items-center gap-3">
                <CategoryChip category={row.category} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold">{categoryMeta(row.category).label}</p>
                  <p className="text-xs text-ink/55">{row.open} open · default {row.defaultHours} h</p>
                </div>
                <p className="text-right font-display text-2xl font-bold tabular-nums">{row.slaHours}<span className="text-sm font-medium text-ink/50"> h</span></p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {[12, 24, 48, 72, 120].map((h) => (
                  <button key={h} type="button" onClick={() => setDraft((x) => ({ ...x, [row.category]: String(h) }))} className={`rounded-full border px-3 py-1 text-xs font-semibold tabular-nums ${Number(value || row.slaHours) === h ? "border-accent bg-accent/10 text-accent" : "border-ink/15 hover:border-ink/35"}`}>
                    {h < 48 ? `${h} h` : `${h / 24} d`}
                  </button>
                ))}
                <input value={value} onChange={(e) => setDraft((x) => ({ ...x, [row.category]: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" placeholder="Custom h" aria-label={`Hours for ${row.category}`} className="input !w-24 !py-1.5 text-sm" />
                <button type="button" disabled={!dirty || saving === row.category} onClick={() => save(row)} className="btn btn-primary ml-auto !py-1.5 text-sm">{saving === row.category ? "Saving…" : "Save"}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Audit

const AUDIT_FILTERS = [
  { id: "", label: "Everything" },
  { id: "issue", label: "Issues" },
  { id: "issue.escalated", label: "Escalations" },
  { id: "user", label: "People" },
  { id: "moderation", label: "Moderation" },
  { id: "category", label: "SLA changes" },
];

const AUDIT_PAGE = 25;

function AuditLog() {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ key: string; entries: AuditEntry[]; total: number; pages: number } | null>(null);
  const key = `${filter}|${page}`;

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), limit: String(AUDIT_PAGE) });
    if (filter) params.set("action", filter);
    api<{ entries: AuditEntry[]; total: number; pages: number }>(`/admin/audit?${params}`).then((d) => {
      if (active) setData({ key: `${filter}|${page}`, entries: d.entries, total: d.total, pages: d.pages });
    });
    return () => {
      active = false;
    };
  }, [filter, page]);

  // Earlier results stay (faded) while the next page loads.
  const entries = data?.entries ?? null;
  const loading = data?.key !== key;

  const days = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const e of entries ?? []) {
      const key = new Date(e.at).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [entries]);

  // PDF: load the whole (filtered) log into a print-only table, name the file, open the print dialog.
  const [printing, setPrinting] = useState<{ entries: AuditEntry[]; total: number } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const filterLabel = AUDIT_FILTERS.find((f) => f.id === filter)?.label ?? "Everything";
  async function exportPdf() {
    setPreparing(true);
    try {
      const params = new URLSearchParams({ format: "json" });
      if (filter) params.set("action", filter);
      const d = await api<{ entries: AuditEntry[]; total: number }>(`/admin/audit/export?${params}`);
      setPrinting(d);
      const before = document.title;
      document.title = `CiviConnect audit log - ${filterLabel} - ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
      window.addEventListener("afterprint", () => { document.title = before; setPrinting(null); }, { once: true });
      // Let React draw the table before the print dialog takes its snapshot.
      window.setTimeout(() => window.print(), 150);
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className="space-y-4">
      {printing && (
        <section className="print-only">
          <header className="print-only mb-4 border-b-2 border-black pb-3">
            <p className="text-[10pt] font-semibold uppercase tracking-widest">CiviConnect · Audit log</p>
            <h1 className="mt-1 text-[18pt] font-bold">Every recorded action: {filterLabel.toLowerCase()}</h1>
            <p className="mt-1 text-[10pt]">Printed {new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })} · {printing.entries.length < printing.total ? `latest ${printing.entries.length} of ${printing.total} entries (download the CSV for all)` : `${printing.total} entries`}</p>
          </header>
          <table className="audit-print w-full border-collapse text-[9pt]">
            <thead>
              <tr><th>When</th><th>Who</th><th>What happened</th></tr>
            </thead>
            <tbody>
              {printing.entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  <td>{e.actorName} <span className="capitalize">({e.actorRole})</span></td>
                  <td>{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <div className="no-print flex flex-wrap items-center gap-1.5">
        {AUDIT_FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => { setFilter(f.id); setPage(1); }} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${filter === f.id ? "bg-ink text-paper" : "text-ink/65 hover:bg-ink/6"}`}>
            {f.label}
          </button>
        ))}
        <span className="ml-auto flex gap-1.5">
          <a href={`/api/admin/audit/export${filter ? `?action=${filter}` : ""}`} download className="btn btn-outline !rounded-full !py-1.5 text-xs"><Download size={14} aria-hidden /> CSV</a>
          <button type="button" onClick={exportPdf} disabled={preparing} className="btn btn-outline !rounded-full !py-1.5 text-xs"><FileText size={14} aria-hidden /> {preparing ? "Preparing…" : "PDF"}</button>
        </span>
      </div>
      {entries === null ? (
        <ListSkeleton rows={5} />
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title="Nothing logged yet" text="Every assignment, status change, escalation and admin decision is recorded here." />
      ) : (
        <div className={`no-print space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {days.map(([day, list]) => (
            <section key={day}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">{day}</h3>
              <ol className="card divide-y divide-ink/8">
                {list.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold uppercase ${e.actorRole === "system" ? "bg-alert/12 text-alert" : e.actorRole === "admin" ? "bg-marker/20 text-marker-dark" : "bg-accent/12 text-accent"}`}>
                      {e.actorRole === "system" ? <Bot size={14} aria-hidden /> : e.actorName.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p><span className="font-semibold">{e.actorName}</span> <span className="text-ink/70">{e.summary}</span></p>
                      <p className="mt-0.5 text-[11px] text-ink/45">
                        <code className="rounded bg-ink/6 px-1">{e.action}</code> · {new Date(e.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                        {e.targetType === "issue" && e.targetId && <> · <Link to={`/issues/${e.targetId}`} className="text-accent hover:underline">open issue</Link></>}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {data && <Pagination page={page} pages={data.pages} total={data.total} limit={AUDIT_PAGE} onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Page

export default function Admin() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "people") as Tab;

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader title="Admin console" subtitle="People and roles, community moderation, service-level clocks and a full record of every decision." />
      </div>
      <div className="no-print -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-ink/10 bg-surface p-1 shadow-card" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams({ tab: id })}
            className={`inline-flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === id ? "bg-accent text-paper shadow-card" : "text-ink/60 hover:bg-ink/5 hover:text-ink"}`}
          >
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>
      <div key={tab} className="animate-fade">
        {tab === "people" && <People />}
        {tab === "moderation" && <Moderation />}
        {tab === "sla" && <SlaSettings />}
        {tab === "audit" && <AuditLog />}
        {tab === "ai" && <ModelCard />}
      </div>
    </div>
  );
}
