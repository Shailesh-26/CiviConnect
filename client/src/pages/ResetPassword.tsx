import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { AuthShell } from "../components/AuthShell";
import { Field } from "../components/Field";
import { api, ApiError } from "../lib/api";
import { passwordScore, STRENGTH_LEVELS } from "../lib/passwordStrength";
import { useToast } from "../lib/toast-context";
import type { User } from "../types";

// Step 2 of a password reset: the link from the email lands here.
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const toast = useToast();
  const { updateUser } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const score = passwordScore(password);
  const validLink = /^[a-f\d]{64}$/i.test(token);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const data = await api<{ user: User }>("/auth/reset", { method: "POST", body: { token, password } });
      updateUser(data.user);
      toast.success("You're signed in with your new password.", { title: "Password changed" });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors.password ?? err.fieldErrors.token ?? err.message) : "Something went wrong. Try again.");
      setSaving(false);
    }
  }

  if (!validLink) {
    return (
      <AuthShell title="This link doesn't work" subtitle="It may be incomplete or copied wrongly. Ask for a new reset link.">
        <Link to="/forgot-password" className="btn btn-primary mt-6 w-full !py-3">Get a new link</Link>
        <p className="mt-4 text-center text-sm"><Link to="/login" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"><ArrowLeft size={14} aria-hidden /> Back to log in</Link></p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Make it something you don't use anywhere else.">
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Field label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters, with a letter and a number." icon={Lock} />
          {password && (
            <div className="mt-2 flex items-center gap-3" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((step) => (
                  <span key={step} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step <= score ? STRENGTH_LEVELS[score].color : "bg-ink/10"}`} />
                ))}
              </div>
              <span className="w-16 text-right text-xs text-ink/60">{STRENGTH_LEVELS[score].label}</span>
            </div>
          )}
        </div>
        <Field label="Type it again" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" icon={ShieldCheck} error={confirm && confirm !== password ? "Doesn't match yet" : undefined} />
        {error && <p role="alert" className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">{error}</p>}
        <button type="submit" disabled={saving || !password || !confirm} className="btn btn-primary w-full !py-3">
          {saving ? "Saving…" : "Save and sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
