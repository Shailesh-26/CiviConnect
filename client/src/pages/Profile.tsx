import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Bell,
  Camera,
  CalendarDays,
  Check,
  KeyRound,
  Lock,
  LocateFixed,
  LogOut,
  MapPinHouse,
  Moon,
  Palette,
  Smile,
  Sun,
  Trash2,
  Type,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Avatar } from "../components/Avatar";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CivicCard } from "../components/CivicCard";
import { CountUp } from "../components/CountUp";
import { Field } from "../components/Field";
import { HomeAreaMap } from "../components/HomeAreaMap";
import type { LatLng } from "../components/LocationPicker";
import { PageHeader, Switch } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { AVATAR_COLORS, AVATAR_EMOJIS } from "../lib/avatar";
import { OPEN } from "../lib/constants";
import { passwordScore, STRENGTH_LEVELS } from "../lib/passwordStrength";
import { useToast } from "../lib/toast-context";
import { useTheme } from "../theme/theme-context";
import type { Avatar as AvatarData, Issue, NotifyKey, Role, User } from "../types";

const RADII = [1, 2, 5, 10];

type AvatarDraft = { kind: "keep" } | { kind: "preset"; emoji: string; color: string } | { kind: "initials" };

type Draft = {
  name: string;
  bio: string;
  homeArea: string;
  homeLocation: LatLng | null;
  radiusKm: number;
  notify: Record<NotifyKey, boolean>;
  avatar: AvatarDraft;
};

const NOTIFY_OPTIONS: Record<Role, { key: NotifyKey; label: string; hint: string }[]> = {
  citizen: [
    { key: "statusUpdates", label: "Updates on my reports", hint: "When an officer picks up, works on or fixes something you reported." },
    { key: "comments", label: "Comments on my reports", hint: "When someone adds information or a photo to your report." },
    { key: "nearby", label: "New problems near home", hint: "When a serious problem is reported inside your neighbourhood radius." },
  ],
  officer: [
    { key: "assignments", label: "New assignments", hint: "When an admin assigns an issue to you." },
    { key: "slaWarnings", label: "Deadline warnings", hint: "When one of your issues is close to its fix-by time." },
    { key: "comments", label: "Comments on my issues", hint: "When citizens add information to an issue you handle." },
  ],
  admin: [
    { key: "assignments", label: "Issues waiting for an officer", hint: "When a new issue has nobody assigned to it." },
    { key: "escalations", label: "Escalations", hint: "When an issue misses its deadline or citizens reopen it." },
    { key: "slaWarnings", label: "Deadline warnings", hint: "When high-priority issues are close to their fix-by time." },
  ],
};

const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "identity", label: "Profile", icon: UserRound },
  { id: "home", label: "Neighbourhood", icon: MapPinHouse },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "security", label: "Password", icon: KeyRound },
];

const fromUser = (user: User): Draft => ({
  name: user.name,
  bio: user.bio ?? "",
  homeArea: user.homeArea ?? "",
  homeLocation: user.homeLocation ?? null,
  radiusKm: user.radiusKm,
  notify: {
    statusUpdates: true,
    comments: true,
    nearby: true,
    assignments: true,
    slaWarnings: true,
    escalations: true,
    ...user.notify,
  },
  avatar: { kind: "keep" },
});

function previewAvatar(user: User, draft: AvatarDraft): AvatarData | null {
  if (draft.kind === "preset") return { emoji: draft.emoji, color: draft.color, url: null };
  if (draft.kind === "initials") return null;
  return user.avatar;
}

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 p-5 animate-rise sm:p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-ink/5 px-4 py-3">
      <p className="font-display text-2xl font-bold"><CountUp value={value} /></p>
      <p className="text-xs text-ink/60">{label}</p>
    </div>
  );
}

function stats(role: Role, issues: Issue[]) {
  const resolved = issues.filter((i) => i.status === "resolved").length;
  const open = issues.filter((i) => OPEN.includes(i.status)).length;
  if (role === "citizen") {
    // How many other people joined the problems this citizen raised (merged reports plus supporters).
    const joined = issues.reduce((sum, i) => sum + Math.max(0, i.reportCount - 1) + i.supporterCount, 0);
    return [
      { label: "Problems reported", value: issues.length },
      { label: "Fixed so far", value: resolved },
      { label: "Neighbours who joined in", value: joined },
    ];
  }
  if (role === "officer") {
    return [
      { label: "Assigned to you", value: issues.length },
      { label: "Still open", value: open },
      { label: "Fixed by you", value: resolved },
    ];
  }
  return [
    { label: "Issues in the city", value: issues.length },
    { label: "Open right now", value: open },
    { label: "Unassigned", value: issues.filter((i) => OPEN.includes(i.status) && !i.assignedTo).length },
  ];
}

function PasswordSection() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const score = passwordScore(next);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problems: Record<string, string> = {};
    if (!current) problems.currentPassword = "Enter your current password";
    if (next.length < 8) problems.newPassword = "At least 8 characters, with a letter and a number";
    if (next !== confirm) problems.confirm = "The two new passwords do not match";
    setErrors(problems);
    if (Object.keys(problems).length) return;

    setBusy(true);
    try {
      await api("/auth/me/password", { method: "PATCH", body: { currentPassword: current, newPassword: next } });
      toast.success("Password changed. Use the new one next time you log in.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      } else toast.error("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section id="security" title="Password" subtitle="Use at least 8 characters with a letter and a number. You stay logged in on this device.">
      <form onSubmit={onSubmit} className="grid gap-4 sm:max-w-md" noValidate>
        <Field label="Current password" type="password" value={current} onChange={setCurrent} autoComplete="current-password" error={errors.currentPassword} icon={Lock} />
        <div>
          <Field label="New password" type="password" value={next} onChange={setNext} autoComplete="new-password" error={errors.newPassword} icon={KeyRound} />
          {next && (
            <div className="mt-2 flex items-center gap-3" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <span key={step} className={`h-1.5 flex-1 rounded-full transition-colors ${step <= score ? STRENGTH_LEVELS[score].color : "bg-ink/10"}`} />
                ))}
              </div>
              <span className="w-16 text-right text-xs text-ink/60">{STRENGTH_LEVELS[score].label}</span>
            </div>
          )}
        </div>
        <Field label="Repeat new password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" error={errors.confirm} icon={KeyRound} />
        <div>
          <button type="submit" disabled={busy} className="btn btn-primary">{busy ? "Changing…" : "Change password"}</button>
        </div>
      </form>
    </Section>
  );
}

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const [draft, setDraft] = useState<Draft | null>(() => (user ? fromUser(user) : null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarTab, setAvatarTab] = useState<"emoji" | "photo" | "initials">(user?.avatar?.url ? "photo" : user?.avatar?.emoji ? "emoji" : "initials");
  const [locating, setLocating] = useState(false);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const role = user?.role;
  useEffect(() => {
    if (!role) return;
    const path = role === "citizen" ? "/issues/mine" : role === "officer" ? "/issues/assigned" : "/issues";
    let active = true;
    api<{ issues: Issue[] }>(path)
      .then((data) => active && setIssues(data.issues))
      .catch(() => active && setIssues([]));
    return () => {
      active = false;
    };
  }, [role]);

  const original = useMemo(() => (user ? fromUser(user) : null), [user]);

  const changes = useMemo(() => {
    if (!draft || !original) return {};
    const body: Record<string, unknown> = {};
    if (draft.name.trim() !== original.name) body.name = draft.name.trim();
    if (draft.bio.trim() !== original.bio) body.bio = draft.bio.trim();
    if (draft.homeArea.trim() !== original.homeArea) body.homeArea = draft.homeArea.trim();
    if (JSON.stringify(draft.homeLocation) !== JSON.stringify(original.homeLocation)) body.homeLocation = draft.homeLocation;
    if (draft.radiusKm !== original.radiusKm) body.radiusKm = draft.radiusKm;
    const notify = Object.fromEntries(Object.entries(draft.notify).filter(([k, v]) => original.notify[k as NotifyKey] !== v));
    if (Object.keys(notify).length) body.notify = notify;
    if (draft.avatar.kind === "preset") body.avatar = { emoji: draft.avatar.emoji, color: draft.avatar.color };
    if (draft.avatar.kind === "initials" && user?.avatar) body.avatar = null;
    return body;
  }, [draft, original, user]);
  const dirty = Object.keys(changes).length > 0;

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const set = useCallback((patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d)), []);
  const cancelLogout = useCallback(() => setConfirmLogout(false), []);

  if (!user || !draft) return null;

  const shownAvatar = previewAvatar(user, draft.avatar);
  const preset = draft.avatar.kind === "preset" ? draft.avatar : { emoji: user.avatar?.emoji ?? AVATAR_EMOJIS[0], color: user.avatar?.color ?? AVATAR_COLORS[0] };
  const memberSince = new Date(user.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  async function save() {
    if (!dirty) return;
    if ("name" in changes && String(changes.name).length < 2) {
      setErrors({ name: "Name must be at least 2 characters" });
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const data = await api<{ user: User }>("/auth/me", { method: "PATCH", body: changes });
      updateUser(data.user);
      setDraft(fromUser(data.user));
      toast.success("Profile saved.");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      } else toast.error("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("The photo must be 5 MB or smaller.");
      return;
    }
    const form = new FormData();
    form.append("avatar", file);
    setUploading(true);
    try {
      const data = await api<{ user: User }>("/auth/me/avatar", { method: "POST", body: form });
      updateUser(data.user);
      set({ avatar: { kind: "keep" } });
      toast.success("New profile photo is live.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      toast.error("Your browser does not support location. Tap the map instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({ homeLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
        setLocating(false);
      },
      () => {
        toast.error("Could not get your location. Allow location access or tap the map.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function doLogout() {
    setLeaving(true);
    try {
      await logout();
      toast.info("You have been logged out. See you soon!");
      navigate("/");
    } finally {
      setLeaving(false);
      setConfirmLogout(false);
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <PageHeader title="Your profile" subtitle="How you appear in CiviConnect, the area you care about, and how we keep you posted." />

      {/* Hero card with a live preview of every change */}
      <div className="card relative overflow-hidden animate-rise">
        <div className="relative h-28 bg-signboard sm:h-32">
          <div className="grid-paper absolute inset-0 opacity-30" aria-hidden />
          <svg className="absolute inset-0 size-full" viewBox="0 0 600 130" preserveAspectRatio="none" aria-hidden>
            <path d="M0 95 C120 60 220 120 330 80 S520 40 600 70" stroke="#fff" strokeOpacity=".25" strokeWidth="10" fill="none" />
            <path d="M0 95 C120 60 220 120 330 80 S520 40 600 70" stroke="#e0a100" strokeOpacity=".8" strokeWidth="1.5" strokeDasharray="8 8" fill="none" />
          </svg>
        </div>
        <div className="px-5 pb-5 sm:px-6">
          <div className="-mt-12 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:gap-4">
            <div className="relative">
              <Avatar name={draft.name || user.name} avatar={shownAvatar} size="xl" className="border-4 border-surface shadow-lift" />
              <a href="#identity" className="absolute bottom-1 right-1 grid size-9 place-items-center rounded-full border-2 border-surface bg-marker text-[#241a00] shadow-card transition hover:scale-110" aria-label="Change avatar">
                <Camera size={16} aria-hidden />
              </a>
            </div>
            <div className="w-full min-w-0 flex-1 pb-1">
              <h2 className="truncate text-2xl font-semibold">{draft.name || user.name}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink/60">
                <span className="rounded-full bg-accent/12 px-2.5 py-0.5 text-xs font-semibold capitalize text-accent">{user.role}</span>
                {user.department && <span>{user.department}</span>}
                <span className="inline-flex items-center gap-1"><CalendarDays size={14} aria-hidden /> Since {memberSince}</span>
                {draft.homeArea && <span className="inline-flex items-center gap-1"><MapPinHouse size={14} aria-hidden /> {draft.homeArea}</span>}
              </p>
            </div>
          </div>
          {draft.bio && <p className="mt-4 max-w-2xl text-sm text-ink/75">{draft.bio}</p>}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {issues
              ? stats(user.role, issues).map((s) => <Stat key={s.label} label={s.label} value={s.value} />)
              : Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-16 !rounded-2xl" />)}
          </div>
        </div>
      </div>

      {user.role === "citizen" && <CivicCard />}

      <div className="grid gap-6 lg:grid-cols-[12rem_1fr]">
        <nav className="hidden lg:block" aria-label="Profile sections">
          <ul className="sticky top-10 space-y-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <a href={`#${id}`} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink/65 transition hover:bg-ink/5 hover:text-ink">
                  <Icon size={16} aria-hidden /> {label}
                </a>
              </li>
            ))}
            <li className="pt-3">
              <button type="button" onClick={() => setConfirmLogout(true)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-alert transition hover:bg-alert/10">
                <LogOut size={16} aria-hidden /> Log out
              </button>
            </li>
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <Section id="identity" title="Profile" subtitle="Your name and avatar appear on your account. Reporter names are never shown to other citizens.">
            <div className="flex flex-wrap gap-1.5 rounded-xl bg-ink/5 p-1" role="tablist" aria-label="Avatar type">
              {[
                { id: "emoji" as const, label: "Emoji", icon: Smile },
                { id: "photo" as const, label: "Photo", icon: Camera },
                { id: "initials" as const, label: "Initials", icon: Type },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={avatarTab === id}
                  onClick={() => {
                    setAvatarTab(id);
                    if (id === "initials") set({ avatar: { kind: "initials" } });
                    if (id === "emoji") set({ avatar: { kind: "preset", emoji: preset.emoji ?? AVATAR_EMOJIS[0], color: preset.color ?? AVATAR_COLORS[0] } });
                    if (id === "photo") set({ avatar: { kind: "keep" } });
                  }}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${avatarTab === id ? "bg-surface text-ink shadow-card" : "text-ink/60 hover:text-ink"}`}
                >
                  <Icon size={15} aria-hidden /> {label}
                </button>
              ))}
            </div>

            {avatarTab === "emoji" && (
              <div className="mt-4 space-y-4 animate-fade">
                <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-13">
                  {AVATAR_EMOJIS.map((emoji) => {
                    const active = draft.avatar.kind === "preset" && draft.avatar.emoji === emoji;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => set({ avatar: { kind: "preset", emoji, color: preset.color ?? AVATAR_COLORS[0] } })}
                        aria-pressed={active}
                        className={`grid aspect-square place-items-center rounded-xl text-xl transition hover:scale-110 ${active ? "bg-accent/15 ring-2 ring-accent" : "bg-ink/5"}`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-sm text-ink/60">Background</span>
                  {AVATAR_COLORS.map((color) => {
                    const active = draft.avatar.kind === "preset" && draft.avatar.color === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => set({ avatar: { kind: "preset", emoji: preset.emoji ?? AVATAR_EMOJIS[0], color } })}
                        aria-label={`Colour ${color}`}
                        aria-pressed={active}
                        className={`grid size-8 place-items-center rounded-full transition hover:scale-110 ${active ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
                        style={{ background: color }}
                      >
                        {active && <Check size={15} className="text-white" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {avatarTab === "photo" && (
              <div className="mt-4 flex flex-wrap items-center gap-4 animate-fade">
                <Avatar name={user.name} avatar={user.avatar?.url ? user.avatar : null} size="lg" />
                <label className={`btn btn-outline cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}>
                  <Camera size={16} aria-hidden /> {uploading ? "Uploading…" : user.avatar?.url ? "Choose another photo" : "Upload a photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      void uploadPhoto(file);
                    }}
                  />
                </label>
                <p className="w-full text-xs text-ink/55">JPEG, PNG or WebP up to 5 MB. It is cropped to a square around your face and saved straight away.</p>
              </div>
            )}

            {avatarTab === "initials" && (
              <p className="mt-4 flex items-center gap-3 text-sm text-ink/65 animate-fade">
                <Avatar name={draft.name || user.name} avatar={null} size="lg" /> Your initials on a blue circle. Save to apply.
              </p>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pf-name" className="block text-sm font-medium">Display name</label>
                <input id="pf-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} aria-invalid={errors.name ? true : undefined} className="input mt-1.5" />
                {errors.name && <p className="mt-1.5 text-sm text-alert">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="pf-email" className="block text-sm font-medium">Email</label>
                <input id="pf-email" value={user.email} readOnly className="input mt-1.5 cursor-not-allowed opacity-70" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="pf-bio" className="block text-sm font-medium">About you <span className="font-normal text-ink/50">(optional)</span></label>
                <textarea id="pf-bio" value={draft.bio} onChange={(e) => set({ bio: e.target.value })} rows={2} maxLength={160} placeholder="Cyclist, morning walker, school-run parent…" className="input mt-1.5" />
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-alert">{errors.bio}</span>
                  <span className="text-ink/45">{draft.bio.length}/160</span>
                </div>
              </div>
            </div>
          </Section>

          <Section id="home" title="Neighbourhood" subtitle="Set your home spot and how far around it you care about. Your Neighbourhood feed shows problems inside this circle. Only you can see your home spot.">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label htmlFor="pf-area" className="block text-sm font-medium">Area name</label>
                <input id="pf-area" value={draft.homeArea} onChange={(e) => set({ homeArea: e.target.value })} maxLength={80} placeholder="For example, Kukatpally" className="input mt-1.5" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={locate} disabled={locating} className="btn btn-outline !py-2.5 text-sm">
                  <LocateFixed size={16} aria-hidden /> {locating ? "Finding you…" : "Use my location"}
                </button>
                {draft.homeLocation && (
                  <button type="button" onClick={() => set({ homeLocation: null })} className="btn btn-ghost !py-2.5 text-sm" aria-label="Remove home spot">
                    <Trash2 size={16} aria-hidden />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <HomeAreaMap home={draft.homeLocation} radiusKm={draft.radiusKm} onPick={(p) => set({ homeLocation: p })} />
              <p className="mt-2 text-xs text-ink/55">
                {draft.homeLocation ? "Tap the map to move your home spot." : "Tap the map or use your location to set your home spot."}
              </p>
            </div>

            <p className="mt-5 text-sm font-medium">Radius</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {RADII.map((r) => {
                const active = draft.radiusKm === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set({ radiusKm: r })}
                    aria-pressed={active}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 transition ${active ? "border-accent bg-accent/10 text-accent" : "border-ink/15 hover:border-ink/35"}`}
                  >
                    <span className="grid size-9 place-items-center" aria-hidden>
                      <span className="rounded-full border-2 border-current opacity-70" style={{ width: `${10 + Math.sqrt(r) * 8}px`, height: `${10 + Math.sqrt(r) * 8}px` }} />
                    </span>
                    <span className="text-sm font-semibold">{r} km</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section id="notifications" title="Notifications" subtitle="Choose what is worth a ping. These appear under the bell at the top of the app.">
            <div className="-mx-3 divide-y divide-ink/8">
              {NOTIFY_OPTIONS[user.role].map((option) => (
                <Switch
                  key={option.key}
                  label={option.label}
                  hint={option.hint}
                  checked={draft.notify[option.key]}
                  onChange={(value) => set({ notify: { ...draft.notify, [option.key]: value } })}
                />
              ))}
            </div>
          </Section>

          <Section id="appearance" title="Appearance" subtitle="Saved on this device.">
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              {([
                { id: "light", label: "Light", icon: Sun, paper: "#f4f5f1", surface: "#ffffff", ink: "#17202b" },
                { id: "dark", label: "Dark", icon: Moon, paper: "#0c1219", surface: "#131b25", ink: "#e7edf3" },
              ] as const).map((option) => {
                const active = theme === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => !active && toggle()}
                    aria-pressed={active}
                    className={`overflow-hidden rounded-2xl border-2 text-left transition ${active ? "border-accent" : "border-ink/10 hover:border-ink/30"}`}
                  >
                    <span className="block p-3" style={{ background: option.paper }}>
                      <span className="block rounded-lg p-2" style={{ background: option.surface }}>
                        <span className="block h-2 w-1/2 rounded" style={{ background: option.ink, opacity: 0.8 }} />
                        <span className="mt-1.5 block h-2 w-3/4 rounded" style={{ background: option.ink, opacity: 0.25 }} />
                        <span className="mt-2 block h-3 w-1/3 rounded" style={{ background: "#e0a100" }} />
                      </span>
                    </span>
                    <span className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
                      <option.icon size={15} aria-hidden /> {option.label}
                      {active && <Check size={15} className="ml-auto text-accent" aria-hidden />}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <PasswordSection />

          <button type="button" onClick={() => setConfirmLogout(true)} className="btn btn-outline w-full !py-3 text-alert lg:hidden">
            <LogOut size={17} aria-hidden /> Log out
          </button>
        </div>
      </div>

      {dirty && (
        <div className="fixed inset-x-3 bottom-24 z-[1800] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-ink/10 bg-ink px-4 py-3 text-paper shadow-lift animate-pop lg:bottom-6">
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-marker opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-marker" />
          </span>
          <p className="flex-1 text-sm font-medium">You have unsaved changes</p>
          <button type="button" onClick={() => { setDraft(fromUser(user)); setErrors({}); setAvatarTab(user.avatar?.url ? "photo" : user.avatar?.emoji ? "emoji" : "initials"); }} className="rounded-lg px-3 py-1.5 text-sm font-medium text-paper/75 hover:text-paper">
            Discard
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn btn-marker !py-1.5 text-sm">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmLogout}
        icon={LogOut}
        tone="danger"
        title="Log out of CiviConnect?"
        message="You will need your email and password to sign back in."
        confirmLabel="Log out"
        cancelLabel="Stay"
        busy={leaving}
        onConfirm={doLogout}
        onCancel={cancelLogout}
      />
    </div>
  );
}
