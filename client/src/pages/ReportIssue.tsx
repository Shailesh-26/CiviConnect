import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ClipboardPen,
  Headset,
  ImagePlus,
  LocateFixed,
  Mail,
  MailOpen,
  MapPin,
  Pencil,
  Phone,
  Sparkles,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { AddressSearch } from "../components/AddressSearch";
import { CategoryChip } from "../components/CategoryChip";
import { LocationPicker, type LatLng } from "../components/LocationPicker";
import { SimilarIssues } from "../components/SimilarIssues";
import { api, ApiError } from "../lib/api";
import { CATEGORIES, CATEGORY_COLOR, CHANNEL_META, issueLabel } from "../lib/constants";
import { CUSTOM_ICONS, OTHER_SUGGESTIONS } from "../lib/customIcons";
import { useToast } from "../lib/toast-context";
import type { Category, Channel, Issue, IssueDetail, NearbyItem, Role } from "../types";

type StepId = "who" | "photo" | "what" | "where" | "details" | "review";

const STEP_LABEL: Record<StepId, string> = {
  who: "Citizen",
  photo: "Photo",
  what: "Problem",
  where: "Location",
  details: "Details",
  review: "Review",
};

const COPY: Record<Role, { title: string; subtitle: string; submit: string; busy: string; created: string; merged: string }> = {
  citizen: {
    title: "Report an issue",
    subtitle: "Five quick steps. If someone nearby already reported it, your report joins theirs and raises its priority.",
    submit: "Submit report",
    busy: "Submitting…",
    created: "Thank you! Your report is live and you will get every update.",
    merged: "Someone nearby reported this already. Your report was added and the priority went up.",
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
    subtitle: "For citizens who phone, walk in or write to the office. The complaint merges like any report.",
    submit: "Register complaint",
    busy: "Registering…",
    created: "Complaint registered.",
    merged: "The complaint was added to an existing issue nearby.",
  },
};

const CHANNEL_ICON: Record<Channel, LucideIcon> = { phone: Phone, walk_in: UserRound, email: Mail, letter: MailOpen };

function StepCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card p-5 animate-rise sm:p-7">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink/60">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Summary({ label, onEdit, children }: { label: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-b border-ink/8 py-3.5 last:border-0">
      <p className="w-24 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-ink/45">{label}</p>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
        <Pencil size={12} aria-hidden /> Edit
      </button>
    </div>
  );
}

export default function ReportIssue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const role: Role = user?.role ?? "citizen";
  const copy = COPY[role];

  const steps: StepId[] = role === "admin" ? ["who", "photo", "what", "where", "details", "review"] : ["photo", "what", "where", "details", "review"];
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  const [category, setCategory] = useState<Category | "">("");
  const [customLabel, setCustomLabel] = useState("");
  const [customIcon, setCustomIcon] = useState("circle-help");
  const [onBehalfName, setOnBehalfName] = useState("");
  const [channel, setChannel] = useState<Channel | "">("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [addressTouched, setAddressTouched] = useState(false);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [locating, setLocating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ message: string; issueId?: string; ticket?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [similar, setSimilar] = useState<NearbyItem[] | null>(null);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [supportingId, setSupportingId] = useState<string | null>(null);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const isOther = category === "other";
  const home = user?.homeLocation ?? null;

  // Look up the street name for the chosen spot and offer it as the landmark.
  useEffect(() => {
    if (!point) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const data = await api<{ place: { label: string } | null }>(`/geo/reverse?lat=${point.lat}&lng=${point.lng}`);
        if (!active) return;
        setPlaceName(data.place?.label ?? null);
        if (data.place && !addressTouched) setAddress(data.place.label.slice(0, 200));
      } catch {
        if (active) setPlaceName(null);
      }
    }, 700);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [point, addressTouched]);

  // Open issues close to the chosen spot, with a match score.
  useEffect(() => {
    if (!point) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setSimilarLoading(true);
      const params = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng), text: description });
      if (category) params.set("category", category);
      if (isOther && customLabel.trim()) params.set("label", customLabel.trim());
      try {
        const data = await api<{ items: NearbyItem[] }>(`/issues/nearby?${params}`);
        if (active) setSimilar(data.items);
      } catch {
        if (active) setSimilar(null);
      } finally {
        if (active) setSimilarLoading(false);
      }
    }, 500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [point, category, customLabel, isOther, description]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    // Copy the files now: the input is cleared right after this runs.
    const picked = Array.from(list);
    setFiles((prev) => [...prev, ...picked].slice(0, 3));
  }

  function pick(p: LatLng) {
    setPoint(p);
    setFieldErrors((e) => ({ ...e, location: "" }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Your browser does not support location. Search or tap the map instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        pick(here);
        setFlyTarget(here);
        setLocating(false);
      },
      () => {
        toast.error("Allow location access, or search for the place instead.", { title: "Location blocked" });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function problemsFor(id: StepId): Record<string, string> {
    const p: Record<string, string> = {};
    if (id === "who") {
      if (onBehalfName.trim().length < 2) p.onBehalfName = "Enter the citizen's name";
      if (!channel) p.channel = "Choose how they contacted you";
    }
    if (id === "what") {
      if (!category) p.category = "Choose what kind of problem it is";
      if (isOther && customLabel.trim().length < 3) p.customLabel = "Give the problem a short name (at least 3 letters)";
    }
    if (id === "where" && !point) p.location = "Search for the place, use your location, or tap the map";
    if (id === "details" && description.trim().length < 10) p.description = "Describe the problem in at least 10 characters";
    return p;
  }

  function goTo(index: number) {
    // Moving forward checks every step on the way.
    for (let i = stepIndex; i < index; i++) {
      const p = problemsFor(steps[i]);
      if (Object.keys(p).length) {
        setFieldErrors(p);
        setStepIndex(i);
        toast.error(Object.values(p)[0]);
        return;
      }
    }
    setFieldErrors({});
    setStepIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function supportInstead(item: NearbyItem) {
    setSupportingId(item.id);
    try {
      await api<{ issue: Issue }>(`/issues/${item.id}/support`, { method: "POST" });
      toast.success("Your upvote raised its priority. No duplicate created.", { title: "Added your voice" });
      navigate(`/issues/${item.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not upvote. Try again.");
    } finally {
      setSupportingId(null);
    }
  }

  async function submit() {
    for (const id of steps) {
      const p = problemsFor(id);
      if (Object.keys(p).length) {
        setFieldErrors(p);
        setStepIndex(steps.indexOf(id));
        toast.error(Object.values(p)[0]);
        return;
      }
    }
    setError(null);
    const form = new FormData();
    form.append("category", category);
    form.append("description", description.trim());
    form.append("lat", String(point!.lat));
    form.append("lng", String(point!.lng));
    if (address.trim()) form.append("address", address.trim());
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
      toast.success(data.merged ? copy.merged : copy.created, { title: data.merged ? "Merged" : "Submitted" });
      navigate(`/issues/${data.issue.id}`, { state: { merged: data.merged } });
    } catch (err) {
      if (err instanceof ApiError) {
        const errors = { ...err.fieldErrors };
        if (errors.lat || errors.lng) errors.location = errors.lat ?? errors.lng;
        if (Object.keys(errors).length) {
          setFieldErrors(errors);
          const first = steps.find((id) =>
            (id === "who" && (errors.onBehalfName || errors.channel)) ||
            (id === "what" && (errors.category || errors.customLabel)) ||
            (id === "where" && errors.location) ||
            (id === "details" && errors.description),
          );
          if (first) setStepIndex(steps.indexOf(first));
          toast.error("Please fix the highlighted fields.");
        } else {
          setError({
            message: err.message,
            issueId: typeof err.data.issueId === "string" ? err.data.issueId : undefined,
            ticket: typeof err.data.ticket === "string" ? err.data.ticket : undefined,
          });
          toast.error(err.message);
        }
      } else {
        setError({ message: "Something went wrong. Try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const progress = ((stepIndex + 1) / steps.length) * 100;
  const label = category ? issueLabel({ category, customLabel: isOther ? customLabel.trim() || "Something else" : null }) : "";
  const willMerge = similar?.find((s) => s.willMerge);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="animate-rise">
        <h1 className="text-3xl font-semibold leading-tight">{copy.title}</h1>
        <p className="mt-1.5 text-sm text-ink/60">{copy.subtitle}</p>
      </div>

      {role !== "citizen" && (
        <p className="flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/8 px-4 py-3 text-sm text-ink/75">
          {role === "officer" ? <ClipboardPen size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden /> : <Headset size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />}
          <span>
            {role === "officer"
              ? "Your entry is labelled \"Field inspection\" so it is never counted as a citizen complaint. If the problem is already logged nearby, you will be sent to that issue instead."
              : "Your entry is labelled \"On behalf\" with the contact channel. The citizen's name stays private to the office."}
          </span>
        </p>
      )}

      {/* Stepper */}
      <div className="sticky top-[3.7rem] z-[1400] -mx-4 bg-paper/85 px-4 py-3 backdrop-blur-xl sm:-mx-8 sm:px-8 lg:top-0">
        <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <ol className="mt-3 flex justify-between">
          {steps.map((id, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => (i <= stepIndex ? goTo(i) : goTo(i))}
                  className={`flex items-center gap-1.5 text-xs font-semibold transition ${current ? "text-accent" : done ? "text-ink/70 hover:text-ink" : "text-ink/40"}`}
                  aria-current={current ? "step" : undefined}
                >
                  <span className={`grid size-6 place-items-center rounded-full text-[11px] ${current ? "bg-accent text-paper" : done ? "bg-resolved text-white" : "bg-ink/10"}`}>
                    {done ? <Check size={13} aria-hidden /> : i + 1}
                  </span>
                  <span className="hidden sm:inline">{STEP_LABEL[id]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {step === "who" && (
        <StepCard title="Who is complaining?" hint="Their name stays inside the office. It is never shown to other users.">
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
          <p className="mt-5 text-sm font-medium">How did they reach you?</p>
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
                  className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-sm font-medium transition ${active ? "border-accent bg-accent/10 text-accent" : "border-ink/15 hover:border-ink/35"}`}
                >
                  <Icon size={20} aria-hidden /> {CHANNEL_META[c]}
                </button>
              );
            })}
          </div>
          {fieldErrors.channel && <p className="mt-1.5 text-sm text-alert">{fieldErrors.channel}</p>}
        </StepCard>
      )}

      {step === "photo" && (
        <StepCard title="Show us the problem" hint="A clear photo helps officers find and fix it faster. You can add up to 3, or skip this step.">
          {files.length === 0 ? (
            <label className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-ink/20 bg-paper/60 px-6 py-14 text-center transition hover:border-accent hover:bg-accent/5">
              <span className="grid size-16 place-items-center rounded-2xl bg-accent/12 text-accent transition group-hover:scale-110">
                <Camera size={30} aria-hidden />
              </span>
              <span className="font-display text-lg font-semibold">Take a photo or choose one</span>
              <span className="text-sm text-ink/55">JPEG, PNG or WebP, up to 5 MB each</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment" className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {previews.map((src, index) => (
                <div key={src} className="relative aspect-square animate-pop overflow-hidden rounded-2xl border border-ink/15">
                  <img src={src} alt={`Photo ${index + 1}`} className="size-full object-cover" />
                  <button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/70 text-white">
                    <X size={15} aria-hidden />
                  </button>
                </div>
              ))}
              {files.length < 3 && (
                <label className="grid aspect-square cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-ink/20 text-sm text-ink/55 transition hover:border-accent hover:text-accent">
                  <span className="flex flex-col items-center gap-1.5"><ImagePlus size={24} aria-hidden /> Add another</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
          )}
        </StepCard>
      )}

      {step === "what" && (
        <StepCard title="What kind of problem is it?">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {CATEGORIES.map(({ value, label: text, icon: Icon }) => {
              const active = category === value;
              const color = CATEGORY_COLOR[value];
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  aria-pressed={active}
                  style={active ? { borderColor: color, background: `${color}1a` } : undefined}
                  className="flex flex-col items-start gap-3 rounded-2xl border border-ink/15 bg-surface p-4 text-left text-sm font-semibold transition hover:-translate-y-0.5 hover:border-ink/35 hover:shadow-card"
                >
                  <span className="grid size-11 place-items-center rounded-xl" style={{ background: `${color}22`, color }}>
                    <Icon size={22} aria-hidden />
                  </span>
                  {value === "other" ? "Something else" : text}
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
                <input id="customLabel" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} maxLength={40} aria-invalid={fieldErrors.customLabel ? true : undefined} placeholder="For example, open manhole" className="input mt-1.5" />
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-alert">{fieldErrors.customLabel}</span>
                  <span className="text-ink/45">{customLabel.length}/40</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Pick an icon</p>
                <div className="mt-2 grid max-h-52 grid-cols-6 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-9" role="radiogroup" aria-label="Icon">
                  {CUSTOM_ICONS.map(({ key, label: text, icon: Icon }) => {
                    const active = customIcon === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={text}
                        title={text}
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
        </StepCard>
      )}

      {step === "where" && (
        <StepCard title="Where exactly is it?" hint="Search for the place or use your location, then tap the map to put the pin on the exact spot.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <AddressSearch
                near={point ?? home}
                onPick={(place) => {
                  const p = { lat: place.lat, lng: place.lng };
                  pick(p);
                  setFlyTarget(p);
                }}
              />
            </div>
            <button type="button" onClick={useMyLocation} disabled={locating} className="btn btn-outline shrink-0">
              <LocateFixed size={17} aria-hidden /> {locating ? "Finding you…" : "Use my location"}
            </button>
          </div>
          <div className="mt-3">
            <LocationPicker value={point} onChange={pick} flyTarget={flyTarget} start={home} className="h-80 sm:h-96" />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-ink/65">
            <MapPin size={15} className="shrink-0 text-marker-dark" aria-hidden />
            {point ? placeName ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "No pin yet. Tap the exact spot on the map."}
          </p>
          {fieldErrors.location && <p className="mt-1 text-sm text-alert">{fieldErrors.location}</p>}
          {point && (
            <div className="mt-5">
              <SimilarIssues items={similar} loading={similarLoading} canSupport={role === "citizen"} supportingId={supportingId} onSupport={supportInstead} />
            </div>
          )}
        </StepCard>
      )}

      {step === "details" && (
        <StepCard title="Tell us more" hint="What is wrong, how big is it, and why does it matter? Specific details get faster fixes.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={1000}
            aria-invalid={fieldErrors.description ? true : undefined}
            placeholder={role === "admin" ? "What did the citizen tell you? Where exactly, how big, since when?" : "For example: a deep pothole in the middle of the lane, about a foot wide. Two-wheelers swerve to avoid it."}
            className="input"
          />
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-alert">{fieldErrors.description}</span>
            <span className="text-ink/45">{description.length}/1000</span>
          </div>
          <label htmlFor="landmark" className="mt-4 block text-sm font-medium">
            Landmark <span className="font-normal text-ink/50">(filled from the map, edit if needed)</span>
          </label>
          <input
            id="landmark"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setAddressTouched(true);
            }}
            maxLength={200}
            placeholder="Near the bus stop on Station Road"
            className="input mt-1.5"
          />
        </StepCard>
      )}

      {step === "review" && (
        <StepCard title="Check and submit" hint="This is what the city will see. Your name is never shown to other citizens.">
          <div className="rounded-2xl border border-ink/10 px-4">
            {role === "admin" && (
              <Summary label="Citizen" onEdit={() => goTo(steps.indexOf("who"))}>
                {onBehalfName} · {channel ? CHANNEL_META[channel] : ""}
              </Summary>
            )}
            <Summary label="Problem" onEdit={() => goTo(steps.indexOf("what"))}>
              {category && (
                <span className="flex items-center gap-2.5">
                  <CategoryChip category={category} icon={isOther ? customIcon : null} size="sm" />
                  <span className="font-semibold">{label}</span>
                </span>
              )}
            </Summary>
            <Summary label="Location" onEdit={() => goTo(steps.indexOf("where"))}>
              <p>{address || placeName || (point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "")}</p>
            </Summary>
            <Summary label="Details" onEdit={() => goTo(steps.indexOf("details"))}>
              <p className="whitespace-pre-line text-ink/80">{description}</p>
            </Summary>
            <Summary label="Photos" onEdit={() => goTo(steps.indexOf("photo"))}>
              {previews.length ? (
                <div className="flex gap-2">
                  {previews.map((src) => <img key={src} src={src} alt="" className="size-16 rounded-lg border border-ink/15 object-cover" />)}
                </div>
              ) : (
                <p className="text-ink/50">No photos</p>
              )}
            </Summary>
          </div>
          {willMerge && (
            <p className="mt-4 rounded-2xl border border-marker/50 bg-marker/10 px-4 py-3 text-sm text-ink/80">
              <span className="font-semibold">Heads up:</span> {issueLabel(willMerge)} ({willMerge.ticket}) is already open {willMerge.distanceM} m away. Your report will be added to it and raise its priority.
            </p>
          )}
          {error && (
            <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert">
              <span>{error.message}</span>
              {error.issueId && (
                <Link to={`/issues/${error.issueId}`} className="btn btn-outline !py-1.5 text-xs">
                  Open {error.ticket ?? "issue"} <ArrowRight size={14} aria-hidden />
                </Link>
              )}
            </div>
          )}
        </StepCard>
      )}

      <div className="flex items-center justify-between gap-3 pb-4">
        <button type="button" onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0} className="btn btn-ghost">
          <ArrowLeft size={17} aria-hidden /> Back
        </button>
        {step === "review" ? (
          <button type="button" onClick={submit} disabled={submitting} className="btn btn-primary !px-8 !py-3.5 text-base">
            {submitting ? copy.busy : copy.submit}
          </button>
        ) : (
          <button type="button" onClick={() => goTo(stepIndex + 1)} className="btn btn-primary !px-7 !py-3">
            {step === "photo" && files.length === 0 ? "Skip photo" : "Next"} <ArrowRight size={17} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
