import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, LocateFixed, X } from "lucide-react";
import { LocationPicker, type LatLng } from "../components/LocationPicker";
import { api, ApiError } from "../lib/api";
import { CATEGORIES } from "../lib/constants";
import type { Category, IssueDetail } from "../types";

export default function ReportIssue() {
  const navigate = useNavigate();

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
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 3));
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
      navigate(`/issues/${data.issue.id}`, { state: { merged: data.merged } });
    } catch (err) {
      if (err instanceof ApiError) {
        const errors = { ...err.fieldErrors };
        if (errors.lat || errors.lng) errors.location = errors.lat ?? errors.lng;
        setFieldErrors(errors);
        if (Object.keys(err.fieldErrors).length === 0) setError(err.message);
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Report an issue</h1>
      <p className="mt-1 text-sm text-ink/60">
        If someone nearby already reported the same problem, yours is added to it and raises its priority.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-8">
        <section>
          <h2 className="text-sm font-medium">1. What is the problem?</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                aria-pressed={category === value}
                className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm ${
                  category === value
                    ? "border-signboard bg-signboard/10 font-medium text-signboard"
                    : "border-ink/20 bg-white hover:border-ink/40"
                }`}
              >
                <Icon size={20} aria-hidden /> {label}
              </button>
            ))}
          </div>
          {fieldErrors.category && <p className="mt-2 text-sm text-alert">{fieldErrors.category}</p>}
        </section>

        <section>
          <h2 className="text-sm font-medium">2. Where is it?</h2>
          <div className="mt-3">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="mb-3 inline-flex items-center gap-2 rounded-md border border-ink/25 bg-white px-3 py-2 text-sm hover:border-ink/50 disabled:opacity-60"
            >
              <LocateFixed size={17} aria-hidden /> {locating ? "Finding you…" : "Use my location"}
            </button>
            <LocationPicker value={point} onChange={setPoint} flyTarget={flyTarget} />
            <p className="mt-2 text-xs text-ink/60">
              {point
                ? `Selected: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}. Tap the map to adjust.`
                : "Tap the exact spot on the map."}
            </p>
            {geoError && <p className="mt-1 text-sm text-alert">{geoError}</p>}
            {fieldErrors.location && <p className="mt-1 text-sm text-alert">{fieldErrors.location}</p>}
          </div>
          <div className="mt-4">
            <label htmlFor="landmark" className="block text-sm font-medium">
              Landmark <span className="font-normal text-ink/50">(optional)</span>
            </label>
            <input
              id="landmark"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Near the bus stop on Station Road"
              className="mt-1 w-full rounded border border-ink/25 bg-white px-3 py-2 focus:outline-2 focus:outline-signboard"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium">3. Describe it</h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="What is wrong, how big is it, and why does it matter?"
            className="mt-3 w-full rounded border border-ink/25 bg-white px-3 py-2 focus:outline-2 focus:outline-signboard"
          />
          {fieldErrors.description && <p className="mt-1 text-sm text-alert">{fieldErrors.description}</p>}
        </section>

        <section>
          <h2 className="text-sm font-medium">
            4. Add photos <span className="font-normal text-ink/50">(up to 3)</span>
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {previews.map((src, index) => (
              <div key={src} className="relative size-24 overflow-hidden rounded-md border border-ink/20">
                <img src={src} alt={`Photo ${index + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink/80 text-white"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            ))}
            {files.length < 3 && (
              <label className="grid size-24 cursor-pointer place-items-center rounded-md border border-dashed border-ink/30 text-xs text-ink/60 hover:border-signboard hover:text-signboard">
                <span className="flex flex-col items-center gap-1">
                  <ImagePlus size={20} aria-hidden /> Add photo
                </span>
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
        </section>

        {error && <p className="text-sm text-alert">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-signboard px-5 py-2.5 font-medium text-white hover:bg-signboard/90 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit report"}
        </button>
      </form>
    </div>
  );
}
