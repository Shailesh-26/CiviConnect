import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Lock, Mail, Shield, User, Wrench } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { AuthShell } from "../components/AuthShell";
import { Field } from "../components/Field";
import { ApiError } from "../lib/api";

// Shown only on the dev server. Matches the accounts created by `npm run seed:demo`.
const DEMO_PASSWORD = "Demo@1234";
const DEMO_ACCOUNTS = [
  { label: "Citizen", email: "anjali.sharma@civiconnect.demo", icon: User },
  { label: "Officer", email: "ravi.kumar@civiconnect.demo", icon: Wrench },
  { label: "Admin", email: "admin@civiconnect.demo", icon: Shield },
];

export default function Login() {
  const { user, login } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to track your reports and see what has been fixed.">
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" icon={Mail} />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" icon={Lock} />
        {error && (
          <p role="alert" className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">{error}</p>
        )}
        <button type="submit" disabled={submitting} className="btn btn-primary w-full !py-3">
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      {import.meta.env.DEV && (
        <div className="mt-5 rounded-2xl border border-dashed border-ink/20 p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Demo accounts</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map(({ label, email: demoEmail, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => { setEmail(demoEmail); setPassword(DEMO_PASSWORD); }}
                className="btn btn-outline flex-col !gap-1 !px-2 !py-2.5 text-xs"
              >
                <Icon size={17} aria-hidden /> {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink/50">Run the demo seed first to create these.</p>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-ink/65">
        No account yet?{" "}
        <Link to="/register" className="font-semibold text-accent hover:underline">Create one</Link>
      </p>
    </AuthShell>
  );
}
