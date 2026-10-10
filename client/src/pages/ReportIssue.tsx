import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, LocateFixed, X } from "lucide-react";
import { LocationPicker, type LatLng } from "../components/LocationPicker";
import { PageHeader } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { CATEGORIES, CATEGORY_COLOR } from "../lib/constants";
import { useToast } from "../lib/toast-context";
import type { Category, IssueDetail } from "../types";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
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

export default function ReportIssue() {
  const navigate = useNavigate();
  const toast = useToast();

  const [category, setCategory] = useState<Category | "">("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [point, setPoint] = useState<LatLng | null>(null);
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

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
    if (!category) problems.category = "Choose a category";
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
    files.forEach((f) => form.append("photos", f));

    setSubmitting(true);
    try {
      const data = await api<{ merged: boolean; issue: IssueDetail }>("/issues", { method: "POST", body: form });
      toast.success(data.merged ? "Your report was merged into an existing issue." : "Report submitted. Thank you!");
      navigate(`/issues/${data.issue.id}`, { state: { merged: data.merged } });
    } catch (err) {
      if (err instanceof ApiError) {
        const errors = { ...err.fieldErrors };
        if (errors.lat || errors.lng) errors.location = errors.lat ?? errors.lng;
        setFieldErrors(errors);
        if (Object.keys(err.fieldErrors).length === 0) {
          setError(err.message);
          toast.error(err.message);
        }
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Report an issue"
        subtitle="If someone nearby already reported the same problem, yours is added to it and raises its priority."
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <Step n={1} title="What is the problem?">
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
                  {label}
                </button>
              );
            })}
          </div>
          {fieldErrors.category && <p className="mt-2 text-sm text-alert">{fieldErrors.category}</p>}
        </Step>

        <Step n={2} title="Where is it?">
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
            <input id="landmark" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Near the bus stop on Station Road" className="input mt-1.5" />
          </div>
        </Step>

        <Step n={3} title="Describe it">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={1000}
            aria-invalid={fieldErrors.description ? true : undefined}
            placeholder="What is wrong, how big is it, and why does it matter?"
            className="input"
          />
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-alert">{fieldErrors.description}</span>
            <span className="text-ink/45">{description.length}/1000</span>
          </div>
        </Step>

        <Step n={4} title="Add photos">
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

        {error && <p role="alert" className="rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert">{error}</p>}
        <button type="submit" disabled={submitting} className="btn btn-primary !px-8 !py-3.5 text-base">
          {submitting ? "Submitting…" : "Submit report"}
        </button>
      </form>
    </div>
  );
}
