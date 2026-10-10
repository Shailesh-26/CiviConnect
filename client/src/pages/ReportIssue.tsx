import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardPen, Headset, ImagePlus, LocateFixed, Mail, MailOpen, Phone, Sparkles, UserRound, X, type LucideIcon } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { CategoryChip } from "../components/CategoryChip";
import { LocationPicker, type LatLng } from "../components/LocationPicker";
import { PageHeader } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { CATEGORIES, CATEGORY_COLOR, CHANNEL_META } from "../lib/constants";
import { CUSTOM_ICONS, OTHER_SUGGESTIONS } from "../lib/customIcons";
import { useToast } from "../lib/toast-context";
import type { Category, Channel, IssueDetail, Role } from "../types";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <span className="grid size-8 place-items-center rounded-full bg-accent font-display text-sm font-bold text-paper">{n}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const COPY: Record<Role, { title: string; subtitle: string; submit: string; busy: string; created: string; merged: string }> = {
  citizen: {
    title: "Report an issue",
    subtitle: "If someone nearby already reported the same problem, yours is added to it and raises its priority.",
    submit: "Submit report",
    busy: "Submitting…",
    created: "Report submitted. Thank you!",
    merged: "Your report was merged into an existing issue.",
  },
  officer: {
    title: "Log a field inspection",
    subtitle: "Found a problem on your rounds? Log it here. It is assigned to you straight away.",
    submit: "Log inspection",
    busy: "Logging…",
    created: "Inspection logged and assigned to you.",
    merged: "Added to the existing issue.",
  },
  admin: {
    title: "Register a complaint",
    subtitle: "For citizens who phone, walk in or write to the office. The complaint is filed in their name and merges like any report.",
    submit: "Register complaint",
    busy: "Registering…",
    created: "Complaint registered.",
    merged: "The complaint was added to an existing issue nearby.",
  },
};

const CHANNEL_ICON: Record<Channel, LucideIcon> = { phone: Phone, walk_in: UserRound, email: Mail, letter: MailOpen };

export default function ReportIssue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const role: Role = user?.role ?? "citizen";
  const copy = COPY[role];

  const [category, setCategory] = useState<Category | "">("");
  const [customLabel, setCustomLabel] = useState("");
  const [customIcon, setCustomIcon] = useState("circle-help");
  const [onBehalfName, setOnBehalfName] = useState("");
  const [channel, setChannel] = useState<Channel | "">("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [point, setPoint] = useState<LatLng | null>(null);
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ message: string; issueId?: string; ticket?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const isOther = category === "other";
  let n = 0;
  const next = () => ++n;

  function addFiles(list: FileList | null) {
    if (!list) return;
    // Copy the files now: the input is cleared right after this runs.
    const picked = Array.from(list);
    setFiles((prev) => [...prev, ...picked].slice(0, 3));
  }

  function useMyLocation() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Your browser does not support location. Tap the map instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPoint(here);
        setFlyTarget(here);
        setLocating(false);
      },
      () => {
        setGeoError("Could not get your location. Allow location access or tap the map instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const problems: Record<string, string> = {};
    if (role === "admin") {
      if (onBehalfName.trim().length < 2) problems.onBehalfName = "Enter the citizen's name";
      if (!channel) problems.channel = "Choose how they contacted you";
    }
    if (!category) problems.category = "Choose a category";
    if (isOther && customLabel.trim().length < 3) problems.customLabel = "Give the problem a short name (at least 3 letters)";
    if (description.trim().length < 10) problems.description = "Describe the problem in at least 10 characters";
    if (!point) problems.location = "Tap the map or use your location";
    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const form = new FormData();
    form.append("category", category);
    form.append("description", description);
    form.append("lat", String(point!.lat));
    form.append("lng", String(point!.lng));
    if (address.trim()) form.append("address", address);
    if (isOther) {
      form.append("customLabel", customLabel.trim());
      form.append("customIcon", customIcon);
    }
    if (role === "admin") {
      form.append("onBehalfName", onBehalfName.trim());
      form.append("channel", channel);
    }
    files.forEach((f) => form.append("photos", f));

    setSubmitting(true);
    try {
      const data = await api<{ merged: boolean; issue: IssueDetail }>("/issues", { method: "POST", body: form });
      toast.success(data.merged ? copy.merged : copy.created);
      navigate(`/issues/${data.issue.id}`, { state: { merged: data.merged } });
    } catch (err) {
      if (err instanceof ApiError) {
        const errors = { ...err.fieldErrors };
        if (errors.lat || errors.lng) errors.location = errors.lat ?? errors.lng;
        setFieldErrors(errors);
        if (Object.keys(err.fieldErrors).length === 0) {
          setError({
            message: err.message,
            issueId: typeof err.data.issueId === "string" ? err.data.issueId : undefined,
            ticket: typeof err.data.ticket === "string" ? err.data.ticket : undefined,
          });
          toast.error(err.message);
        } else {
          toast.error("Please fix the highlighted fields.");
        }
      } else {
        setError({ message: "Something went wrong. Try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      {role !== "citizen" && (
        <p className="flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/8 px-4 py-3 text-sm text-ink/75 animate-rise">
          {role === "officer" ? <ClipboardPen size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden /> : <Headset size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />}
          <span>
            {role === "officer"
              ? "Your entry is labelled \"Field inspection\" so it is never counted as a citizen complaint. If the problem is already logged nearby, you will be sent to that issue instead."
              : "Your entry is labelled \"On behalf\" with the contact channel. The citizen's name stays private to the office."}
          </span>
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {role === "admin" && (
          <Step n={next()} title="Who is complaining?">
            <label htmlFor="onBehalfName" className="block text-sm font-medium">Citizen's name</label>
            <input
              id="onBehalfName"
              value={onBehalfName}
              onChange={(e) => setOnBehalfName(e.target.value)}
              maxLength={80}
              aria-invalid={fieldErrors.onBehalfName ? true : undefined}
              placeholder="For example, Lakshmi Prasad"
              className="input mt-1.5"
            />
            {fieldErrors.onBehalfName && <p className="mt-1.5 text-sm text-alert">{fieldErrors.onBehalfName}</p>}
            <p className="mt-4 text-sm font-medium">How did they reach you?</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(CHANNEL_META) as Channel[]).map((c) => {
                const Icon = CHANNEL_ICON[c];
                const active = channel === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChannel(c)}
                    aria-pressed={active}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${active ? "border-accent bg-accent/10 text-accent" : "border-ink/15 hover:border-ink/35"}`}
                  >
                    <Icon size={16} aria-hidden /> {CHANNEL_META[c]}
                  </button>
                );
              })}
            </div>
            {fieldErrors.channel && <p className="mt-1.5 text-sm text-alert">{fieldErrors.channel}</p>}
          </Step>
        )}

        <Step n={next()} title="What is the problem?">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {CATEGORIES.map(({ value, label, icon: Icon }) => {
              const active = category === value;
              const color = CATEGORY_COLOR[value];
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  aria-pressed={active}
                  style={active ? { borderColor: color, background: `${color}1a` } : undefined}
                  className="flex items-center gap-3 rounded-xl border border-ink/15 bg-surface px-3.5 py-3.5 text-left text-sm font-medium transition hover:-translate-y-0.5 hover:border-ink/35"
                >
                  <span className="grid size-9 place-items-center rounded-lg" style={{ background: `${color}22`, color }}>
                    <Icon size={19} aria-hidden />
                  </span>
                  {value === "other" ? "Something else" : label}
                </button>
              );
            })}
          </div>
          {fieldErrors.category && <p className="mt-2 text-sm text-alert">{fieldErrors.category}</p>}

          {isOther && (
            <div className="mt-5 space-y-4 rounded-2xl border border-dashed border-ink/20 bg-paper/60 p-4 animate-rise">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium"><Sparkles size={15} className="text-marker-dark" aria-hidden /> Quick picks</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OTHER_SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => { setCustomLabel(s.label); setCustomIcon(s.icon); }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${customLabel === s.label ? "border-accent bg-accent/10 text-accent" : "border-ink/15 bg-surface hover:border-ink/35"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="customLabel" className="block text-sm font-medium">Name the problem</label>
                <input
                  id="customLabel"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  maxLength={40}
                  aria-invalid={fieldErrors.customLabel ? true : undefined}
                  placeholder="For example, open manhole"
                  className="input mt-1.5"
                />
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-alert">{fieldErrors.customLabel}</span>
                  <span className="text-ink/45">{customLabel.length}/40</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium">Pick an icon</p>
                <div className="mt-2 grid max-h-52 grid-cols-6 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-9" role="radiogroup" aria-label="Icon">
                  {CUSTOM_ICONS.map(({ key, label, icon: Icon }) => {
                    const active = customIcon === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={label}
                        title={label}
                        onClick={() => setCustomIcon(key)}
                        className={`grid aspect-square place-items-center rounded-xl border transition ${active ? "scale-105 border-accent bg-accent text-paper shadow-card" : "border-ink/10 bg-surface text-ink/65 hover:border-ink/30 hover:text-ink"}`}
                      >
                        <Icon size={19} aria-hidden />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-surface p-3">
                <CategoryChip category="other" icon={customIcon} />
                <div className="min-w-0">
                  <p className="text-xs text-ink/50">Shows on the map and lists as</p>
                  <p className="truncate font-display text-base font-semibold">{customLabel.trim() || "Your problem name"}</p>
                </div>
              </div>
            </div>
          )}
        </Step>

        <Step n={next()} title="Where is it?">
          <button type="button" onClick={useMyLocation} disabled={locating} className="btn btn-outline mb-3 !py-2 text-sm">
            <LocateFixed size={17} aria-hidden /> {locating ? "Finding you…" : "Use my location"}
          </button>
          <LocationPicker value={point} onChange={setPoint} flyTarget={flyTarget} />
          <p className="mt-2 text-xs text-ink/60">
            {point ? `Selected: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}. Tap the map to adjust.` : "Tap the exact spot on the map."}
          </p>
          {geoError && <p className="mt-1 text-sm text-alert">{geoError}</p>}
          {fieldErrors.location && <p className="mt-1 text-sm text-alert">{fieldErrors.location}</p>}
          <div className="mt-4">
            <label htmlFor="landmark" className="block text-sm font-medium">
              Landmark <span className="font-normal text-ink/50">(optional)</span>
            </label>
            <input id="landmark" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} placeholder="Near the bus stop on Station Road" className="input mt-1.5" />
          </div>
        </Step>

        <Step n={next()} title="Describe it">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={1000}
            aria-invalid={fieldErrors.description ? true : undefined}
            placeholder={role === "admin" ? "What did the citizen tell you? Where exactly, how big, since when?" : "What is wrong, how big is it, and why does it matter?"}
            className="input"
          />
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-alert">{fieldErrors.description}</span>
            <span className="text-ink/45">{description.length}/1000</span>
          </div>
        </Step>

        <Step n={next()} title="Add photos">
          <div className="flex flex-wrap gap-3">
            {previews.map((src, index) => (
              <div key={src} className="relative size-24 animate-pop overflow-hidden rounded-xl border border-ink/15">
                <img src={src} alt={`Photo ${index + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-white"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            ))}
            {files.length < 3 && (
              <label className="grid size-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-ink/25 text-xs text-ink/60 transition hover:border-accent hover:text-accent">
                <span className="flex flex-col items-center gap-1"><ImagePlus size={22} aria-hidden /> Add photo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
          <p className="mt-2 text-xs text-ink/55">Up to 3 photos. A clear photo helps officers find and fix it faster.</p>
        </Step>

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert">
            <span>{error.message}</span>
            {error.issueId && (
              <Link to={`/issues/${error.issueId}`} className="btn btn-outline !py-1.5 text-xs">
                Open {error.ticket ?? "issue"} <ArrowRight size={14} aria-hidden />
              </Link>
            )}
          </div>
        )}
        <button type="submit" disabled={submitting} className="btn btn-primary !px-8 !py-3.5 text-base">
          {submitting ? copy.busy : copy.submit}
        </button>
      </form>
    </div>
  );
}
