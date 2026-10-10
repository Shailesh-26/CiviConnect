import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { Lock, Mail, User } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { AuthShell } from "../components/AuthShell";
import { Field } from "../components/Field";
import { ApiError } from "../lib/api";

function strength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score++;
  if (password.length >= 12) score++;
  if (/[^A-Za-z0-9]/.test(password) && /[A-Z]/.test(password)) score++;
  return score;
}

const LEVELS = [
  { label: "Too short", color: "bg-alert" },
  { label: "Weak", color: "bg-alert" },
  { label: "Okay", color: "bg-marker" },
  { label: "Good", color: "bg-resolved" },
  { label: "Strong", color: "bg-resolved" },
];

export default function Register() {
  const { user, register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const score = strength(password);

  if (user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await register(name, email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        if (Object.keys(err.fieldErrors).length === 0) setError(err.message);
      } else {
        setError("Something went wrong. Try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Join your neighbours" subtitle="Create a free account and start fixing what is broken around you.">
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Full name" value={name} onChange={setName} autoComplete="name" error={fieldErrors.name} icon={User} />
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" error={fieldErrors.email} icon={Mail} />
        <div>
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            hint="At least 8 characters, with a letter and a number."
            error={fieldErrors.password}
            icon={Lock}
          />
          {password && (
            <div className="mt-2 flex items-center gap-3" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <span key={step} className={`h-1.5 flex-1 rounded-full transition-colors ${step <= score ? LEVELS[score].color : "bg-ink/10"}`} />
                ))}
              </div>
              <span className="w-16 text-right text-xs text-ink/60">{LEVELS[score].label}</span>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">{error}</p>
        )}
        <button type="submit" disabled={submitting} className="btn btn-primary w-full !py-3">
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink/65">
        Already registered?{" "}
        <Link to="/login" className="font-semibold text-accent hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
