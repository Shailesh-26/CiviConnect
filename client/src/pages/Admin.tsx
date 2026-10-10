import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import {
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
import { Field } from "../components/Field";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState, ErrorNote, ListSkeleton, PageHeader, Switch } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { FLAG_REASONS } from "../lib/community";
import { categoryMeta, issueLabel } from "../lib/constants";
import { timeAgo } from "../lib/format";
import { useToast } from "../lib/toast-context";
import type { AdminUser, AuditEntry, CategorySla, FlagGroup, Role } from "../types";

type Tab = "people" | "moderation" | "sla" | "audit";
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "people", label: "People", icon: Users },
  { id: "moderation", label: "Moderation", icon: Flag },
  { id: "sla", label: "Categories & SLA", icon: Timer },
  { id: "audit", label: "Audit log", icon: History },
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

  const load = useCallback(() => {
    api<{ users: AdminUser[] }>("/admin/users")
      .then((d) => setUsers(d.users))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load people"));
  }, []);
  useEffect(load, [load]);

  async function patch(target: AdminUser, body: Partial<{ isActive: boolean; role: Role; department: string }>) {
    try {
      const d = await api<{ user: AdminUser }>(`/admin/users/${target.id}`, { method: "PATCH", body });
      setUsers((all) => (all ?? []).map((u) => (u.id === target.id ? { ...u, ...d.user } : u)));
      toast.success(body.isActive === false ? `${target.name} can no longer log in.` : body.isActive ? `${target.name} can log in again.` : "Changes saved.", { title: "Updated" });
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save. Try again.");
      return false;
    }
  }

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
            {r === "all" ? "Everyone" : `${r}s`} <span className="ml-1 tabular-nums opacity-70">{counts[r]}</span>
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
                <span className="hidden w-40 truncate text-xs text-ink/60 md:block">{u.department ?? (u.role === "citizen" ? `${u.reportCount} reports` : "")}</span>
                <span className="hidden w-24 text-xs text-ink/50 lg:block">Joined {timeAgo(u.createdAt)}</span>
                <div className="w-36">
                  <Switch
                    label={u.isActive ? "Active" : "Deactivated"}
                    checked={u.isActive}
                    onChange={(v) => (v ? patch(u, { isActive: true }) : u.id !== me?.id && setConfirmOff(u))}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <EditUser user={editing} onClose={() => setEditing(null)} onSave={async (body) => editing && (await patch(editing, body)) && setEditing(null)} isMe={editing?.id === me?.id} />
      <AddOfficer open={adding} onClose={() => setAdding(false)} onCreated={(u) => { setUsers((all) => [u, ...(all ?? [])]); setAdding(false); }} />
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
    </div>
  );
}

function EditUser({ user, onClose, onSave, isMe }: { user: AdminUser | null; onClose: () => void; onSave: (b: Partial<{ role: Role; department: string }>) => void; isMe: boolean }) {
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
            <div>
              <label htmlFor="dept" className="block text-sm font-medium">Department</label>
              <input id="dept" value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={80} placeholder="Roads and Pavements" className="input mt-1.5" />
            </div>
          )}
          <button type="button" onClick={() => onSave({ ...(role !== user.role ? { role } : {}), ...(department !== (user.department ?? "") ? { department } : {}) })} className="btn btn-primary w-full">
            Save changes
          </button>
        </div>
      )}
    </Drawer>
  );
}

function AddOfficer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (u: AdminUser) => void }) {
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
        <Field label="Department" value={form.department} onChange={set("department")} error={errors.department} hint="For example, Roads and Pavements. Used for smart routing." />
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

function AuditLog() {
  const [filter, setFilter] = useState("");
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ entries: AuditEntry[]; hasMore: boolean }>(`/admin/audit${filter ? `?action=${filter}` : ""}`).then((d) => {
      if (!active) return;
      setEntries(d.entries);
      setHasMore(d.hasMore);
    });
    return () => {
      active = false;
    };
  }, [filter]);

  async function more() {
    if (!entries?.length) return;
    setLoadingMore(true);
    const params = new URLSearchParams({ before: entries[entries.length - 1].at });
    if (filter) params.set("action", filter);
    const d = await api<{ entries: AuditEntry[]; hasMore: boolean }>(`/admin/audit?${params}`);
    setEntries((all) => [...(all ?? []), ...d.entries]);
    setHasMore(d.hasMore);
    setLoadingMore(false);
  }

  const days = useMemo(() => {
    const map = new Map<string, AuditEntry[]>();
    for (const e of entries ?? []) {
      const key = new Date(e.at).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [entries]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {AUDIT_FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => { setEntries(null); setFilter(f.id); }} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${filter === f.id ? "bg-ink text-paper" : "text-ink/65 hover:bg-ink/6"}`}>
            {f.label}
          </button>
        ))}
      </div>
      {entries === null ? (
        <ListSkeleton rows={5} />
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title="Nothing logged yet" text="Every assignment, status change, escalation and admin decision is recorded here." />
      ) : (
        <div className="space-y-6">
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
          {hasMore && <button type="button" onClick={more} disabled={loadingMore} className="btn btn-outline w-full">{loadingMore ? "Loading…" : "Older entries"}</button>}
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
      <PageHeader title="Admin console" subtitle="People and roles, community moderation, service-level clocks and a full record of every decision." />
      <div className="-mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-ink/10 bg-surface p-1 shadow-card" role="tablist">
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
      </div>
    </div>
  );
}
