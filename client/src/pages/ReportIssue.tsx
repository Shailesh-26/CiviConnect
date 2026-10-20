import { createElement, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  Siren,
  Sparkles,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { AddressSearch } from "../components/AddressSearch";
import { CategoryChip } from "../components/CategoryChip";
import { LocationPicker, type LatLng } from "../components/LocationPicker";
import { PhotoAssistantCard, PhotoScan } from "../components/PhotoAssistantCard";
import { PhotoMatches } from "../components/PhotoMatches";
import { UnsavedChangesDialog } from "../components/UnsavedChangesDialog";
import { SimilarIssues } from "../components/SimilarIssues";
import { api, ApiError } from "../lib/api";
import { CATEGORIES, CATEGORY_COLOR, CHANNEL_META, EMERGENCY_KINDS, EMERGENCY_META, issueLabel } from "../lib/constants";
import { CUSTOM_ICONS, OTHER_SUGGESTIONS } from "../lib/customIcons";
import { useToast } from "../lib/toast-context";
import { useLeaveGuard } from "../lib/useLeaveGuard";
import { confetti } from "../lib/confetti";
import { usePhotoAssistant } from "../lib/usePhotoAssistant";
import { realPhotos, shrinkPhotos } from "../lib/shrinkPhoto";
import type { Category, Channel, EmergencyKind, Issue, IssueDetail, NearbyItem, PhotoMatch, Role } from "../types";

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

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

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
  // A double-click fires twice before the button can turn grey; this stops the second one at once.
  const sendingRef = useRef(false);
  const [similar, setSimilar] = useState<NearbyItem[] | null>(null);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [supportingId, setSupportingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [emergencyKind, setEmergencyKind] = useState<EmergencyKind | "">("");

  // The Photo Assistant looks at every photo and pre-selects the problem when it is confident.
  const assistant = usePhotoAssistant(files, (r) => {
    if (r.verdict === "confident" && r.category) setCategory((c) => c || r.category!);
  });

  // Same-photo duplicate check: once there is a pin, compare the photo with nearby report photos.
  const photoVector = assistant.result?.vector;
  const matchKey = point && photoVector ? `${point.lat.toFixed(5)},${point.lng.toFixed(5)},${photoVector.slice(0, 4).join(",")}` : "";
  const [photoMatches, setPhotoMatches] = useState<{ key: string; items: PhotoMatch[] }>({ key: "", items: [] });
  // Leaving halfway through asks first, so a photo and details aren't lost by a stray click.
  const started = files.length > 0 || Boolean(category) || Boolean(description.trim()) || Boolean(point) || Boolean(onBehalfName.trim());
  const { blocker, allowLeave } = useLeaveGuard(started);
  useEffect(() => {
    if (!matchKey || !point || !photoVector) return;
    let active = true;
    const t = window.setTimeout(() => {
      api<{ matches: PhotoMatch[] }>("/vision/similar", { method: "POST", body: { vector: photoVector, lat: point.lat, lng: point.lng } })
        .then((d) => active && setPhotoMatches({ key: matchKey, items: d.matches }))
        .catch(() => undefined);
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey]);
  const shownMatches = photoMatches.key === matchKey ? photoMatches.items : [];

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

  // One entry point for photos from the file picker, drag and drop, or paste. Checks type, size and the limit of 3.
  async function addFiles(list: FileList | File[] | null, how: "picked" | "dropped" | "pasted" = "picked") {
    if (!list) return;
    // Copy the files now: the input is cleared right after this runs.
    const all = Array.from(list);
    // Big phone photos are made smaller first, so they fit the 5 MB limit and upload quickly.
    const { real, fake } = await realPhotos(all.filter((f) => PHOTO_TYPES.includes(f.type)));
    if (fake.length) toast.error(fake.length === 1 ? "That file is not a real photo. Use a JPEG, PNG or WebP image." : `${fake.length} files are not real photos. Use JPEG, PNG or WebP images.`, { title: "Not a photo" });
    const images = await shrinkPhotos(real);
    const fitting = images.filter((f) => f.size <= MAX_PHOTO_BYTES);
    const room = Math.max(0, 3 - files.length);
    const added = fitting.slice(0, room);
    if (all.length > images.length + fake.length) toast.error("Only JPEG, PNG or WebP photos can be added.", { title: "Not a photo" });
    if (images.length > fitting.length) toast.error(`${images.length - fitting.length === 1 ? "A photo was" : `${images.length - fitting.length} photos were`} larger than 5 MB and skipped.`);
    if (fitting.length > room) toast.error(room === 0 ? "You already have 3 photos. Remove one to add another." : `Only ${room} more ${room === 1 ? "photo fits" : "photos fit"}, so the rest were skipped.`);
    if (!added.length) return;
    setFiles((prev) => [...prev, ...added].slice(0, 3));
    if (how !== "picked") toast.success(`${added.length} ${added.length === 1 ? "photo" : "photos"} ${how}.`, { duration: 2200 });
    if (step !== "photo") setStepIndex(steps.indexOf("photo"));
  }

  // Drag photos from the desktop onto the page, or paste a screenshot with Ctrl+V, on any step of the wizard.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (e: DragEvent) => {
      // relatedTarget is null only when the pointer leaves the browser window.
      if (e.relatedTarget === null) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer?.files ?? null, "dropped");
    };
    const onPaste = (e: ClipboardEvent) => {
      const pasted = Array.from(e.clipboardData?.files ?? []);
      if (!pasted.length) return;
      e.preventDefault();
      addFiles(pasted, "pasted");
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  });

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
        toast.error(Object.values(p)[0], { title: "One more thing" });
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
      allowLeave();
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
        toast.error(Object.values(p)[0], { title: "One more thing" });
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
    if (emergencyKind) form.append("emergencyKind", emergencyKind);
    if (assistant.result) {
      form.append("aiVerdict", assistant.result.verdict);
      form.append("aiCategory", assistant.result.top[0]?.category ?? "");
      form.append("aiConfidence", String(assistant.result.top[0]?.score ?? ""));
      form.append("aiMode", assistant.result.model.mode);
    }

    if (sendingRef.current) return;
    sendingRef.current = true;
    setSubmitting(true);
    try {
      const data = await api<{ merged: boolean; issue: IssueDetail; privacy?: { facesBlurred: number } }>("/issues", { method: "POST", body: form });
      toast.success(data.merged ? copy.merged : copy.created, { title: data.merged ? "Merged" : "Submitted" });
      if (data.privacy?.facesBlurred) {
        const n = data.privacy.facesBlurred;
        toast.success(`${n} ${n === 1 ? "face was" : "faces were"} blurred in your photos before saving, to protect people's privacy.`, { title: "Privacy protected" });
      }
      confetti();
      allowLeave();
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
          toast.error("Please fix the highlighted fields.", { title: "Check your details" });
        } else {
          setError({
            message: err.message,
            issueId: typeof err.data.issueId === "string" ? err.data.issueId : undefined,
            ticket: typeof err.data.ticket === "string" ? err.data.ticket : undefined,
          });
          // Offline: the "Reconnecting" bar and the note above the button already say so.
          if (err.status !== 0) toast.error(err.message);
        }
      } else {
        setError({ message: "Something went wrong. Try again." });
      }
    } finally {
      sendingRef.current = false;
      setSubmitting(false);
    }
  }

  const progress = ((stepIndex + 1) / steps.length) * 100;
  const label = category ? issueLabel({ category, customLabel: isOther ? customLabel.trim() || "Something else" : null }) : "";
  const willMerge = similar?.find((s) => s.willMerge);
  const suggested = assistant.result && assistant.result.verdict !== "not_civic" ? assistant.result.top[0]?.category : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {dragging && createPortal(
        <div className="pointer-events-none fixed inset-0 z-[2500] grid place-items-center bg-ink/30 p-6 backdrop-blur-sm animate-fade">
          <div className="cc-dropzone grid w-full max-w-lg place-items-center gap-3 rounded-[2rem] border-[3px] border-dashed border-accent bg-surface/95 px-8 py-14 text-center shadow-lift animate-pop">
            <span className="grid size-20 place-items-center rounded-3xl bg-accent/12 text-accent cc-bob"><ImagePlus size={38} aria-hidden /></span>
            <p className="font-display text-2xl font-semibold">Drop your photos anywhere</p>
            <p className="text-sm text-ink/60">{files.length >= 3 ? "You already have 3 photos. Remove one first." : `JPEG, PNG or WebP · up to 5 MB each · ${3 - files.length} more ${3 - files.length === 1 ? "fits" : "fit"}`}</p>
          </div>
        </div>,
        document.body,
      )}
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
              <span className="text-sm text-ink/55"><span className="hidden sm:inline">or drag photos here, or paste with Ctrl+V · </span>JPEG, PNG or WebP, up to 5 MB each</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {previews.map((src, index) => (
                <div key={src} className="relative aspect-square animate-pop overflow-hidden rounded-2xl border border-ink/15">
                  <img src={src} alt={`Photo ${index + 1}`} className="size-full object-cover" />
                  <PhotoScan loading={assistant.photo(index).loading} result={assistant.photo(index).result} />
                  <button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/70 text-white">
                    <X size={15} aria-hidden />
                  </button>
                </div>
              ))}
              {files.length < 3 && (
                <label className="grid aspect-square cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-ink/20 text-sm text-ink/55 transition hover:border-accent hover:text-accent">
                  <span className="flex flex-col items-center gap-1.5 text-center"><ImagePlus size={24} aria-hidden /> Add another<span className="hidden text-[11px] text-ink/40 sm:block">or drop it here</span></span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
          )}
          {files.length > 0 && (
            <PhotoAssistantCard
              loading={assistant.loading}
              offline={assistant.offline}
              result={assistant.result}
              notCivicPhotos={assistant.notCivicPhotos}
              photoCount={files.length}
              selected={category}
              onPick={(c) => {
                setCategory(c);
                setFieldErrors((e) => ({ ...e, category: "" }));
              }}
            />
          )}
        </StepCard>
      )}

      {step === "what" && (
        <StepCard title="What kind of problem is it?" hint={suggested ? "The Photo Assistant's suggestion is marked. Change it if it's wrong." : undefined}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {CATEGORIES.map(({ value, label: text, icon: Icon }) => {
              const active = category === value;
              const color = CATEGORY_COLOR[value];
              const isSuggested = suggested === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  aria-pressed={active}
                  style={active ? { borderColor: color, background: `${color}1a` } : undefined}
                  className="relative flex flex-col items-start gap-3 rounded-2xl border border-ink/15 bg-surface p-4 text-left text-sm font-semibold transition hover:-translate-y-0.5 hover:border-ink/35 hover:shadow-card"
                >
                  {isSuggested && (
                    <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-semibold text-accent animate-pop">
                      <Sparkles size={11} aria-hidden /> Suggested
                    </span>
                  )}
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
              <PhotoMatches matches={shownMatches} canSupport={role === "citizen"} supportingId={supportingId} onSupport={(id) => supportInstead({ id } as NearbyItem)} />
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

          {/* Emergency: dangerous right now */}
          <div className={`mt-6 overflow-hidden rounded-2xl border transition-colors duration-300 ${emergencyKind ? "border-alert/50 bg-alert/[0.06]" : "border-ink/12"}`}>
            <label className="flex cursor-pointer items-center gap-3 p-4">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl transition-colors ${emergencyKind ? "bg-alert text-white cc-emergency" : "bg-alert/10 text-alert"}`}><Siren size={20} aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Is anyone in danger right now?</span>
                <span className="block text-xs text-ink/55">For example a live wire or an open manhole. It gets a 4-hour fix-by time and admins are alerted at once.</span>
              </span>
              <input type="checkbox" checked={Boolean(emergencyKind)} onChange={(e) => setEmergencyKind(e.target.checked ? "live_wire" : "")} className="peer sr-only" />
              <span className="relative h-6 w-11 shrink-0 rounded-full bg-ink/20 transition-colors peer-checked:bg-alert peer-focus-visible:ring-2 peer-focus-visible:ring-accent after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-300 peer-checked:after:translate-x-5" />
            </label>
            {emergencyKind && (
              <div className="border-t border-alert/20 p-4 animate-fade">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {EMERGENCY_KINDS.map((k) => {
                    const on = emergencyKind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setEmergencyKind(k)}
                        aria-pressed={on}
                        className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition ${on ? "border-alert bg-surface text-alert shadow-card" : "border-ink/12 bg-surface/60 hover:border-ink/30"}`}
                      >
                        {createElement(EMERGENCY_META[k].icon, { size: 16, className: "mt-0.5 shrink-0", "aria-hidden": true })}
                        <span>
                          <span className="block text-sm font-semibold">{EMERGENCY_META[k].label}</span>
                          <span className="block text-[11px] text-ink/55">{EMERGENCY_META[k].hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-alert/10 px-3 py-2 text-xs text-ink/75">
                  <Phone size={14} className="mt-0.5 shrink-0 text-alert" aria-hidden />
                  <span>If someone is hurt or in immediate danger, call <a href="tel:112" className="font-bold text-alert underline">112</a> first. Please use this only for real danger.</span>
                </p>
              </div>
            )}
          </div>
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
            {emergencyKind && (
              <Summary label="Emergency" onEdit={() => goTo(steps.indexOf("details"))}>
                <span className="inline-flex items-center gap-1.5 font-semibold text-alert"><Siren size={14} aria-hidden /> {EMERGENCY_META[emergencyKind].label} · 4-hour fix-by time</span>
              </Summary>
            )}
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
      <UnsavedChangesDialog blocker={blocker} title="Leave this report?" message="Your report hasn't been sent yet. If you leave now, the photos and details you added will be lost." discardLabel="Leave and discard" />
    </div>
  );
}
