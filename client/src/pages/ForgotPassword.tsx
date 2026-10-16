import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound, Mail, MailCheck } from "lucide-react";
import { AuthShell } from "../components/AuthShell";
import { Field } from "../components/Field";
import { api, ApiError } from "../lib/api";

// Step 1 of a password reset: ask for the email, then show "check your inbox".
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ message: string; devLink?: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      setSent(await api<{ message: string; devLink?: string }>("/auth/forgot", { method: "POST", body: { email } }));
    } catch (err) {
      setError(err instanceof ApiError ? (err.fieldErrors.email ?? err.message) : "Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    const devPath = sent.devLink ? new URL(sent.devLink).pathname + new URL(sent.devLink).search : null;
    return (
      <AuthShell title="Check your inbox" subtitle={sent.message}>
        <div className="mt-6 grid place-items-center gap-3 rounded-3xl border border-ink/10 bg-surface/70 px-6 py-8 text-center animate-pop">
          <span className="grid size-16 place-items-center rounded-2xl bg-resolved/15 text-resolved cc-bob"><MailCheck size={30} aria-hidden /></span>
          <p className="text-sm text-ink/65">Sent to <span className="font-semibold text-ink">{email}</span>. Look in Spam too if it doesn't arrive in a minute.</p>
        </div>
        {devPath && (
          <div className="mt-4 rounded-2xl border border-dashed border-marker/60 bg-marker/10 p-4 text-sm">
            <p className="font-semibold">Email isn't set up on this computer</p>
            <p className="mt-1 text-ink/65">So here is the link the email would contain. It is also printed in the server terminal.</p>
            <Link to={devPath} className="btn btn-marker mt-3 w-full"><KeyRound size={16} aria-hidden /> Open the reset link</Link>
          </div>
        )}
        <button type="button" onClick={() => setSent(null)} className="btn btn-ghost mt-4 w-full">Use a different email</button>
        <p className="mt-4 text-center text-sm"><Link to="/login" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"><ArrowLeft size={14} aria-hidden /> Back to log in</Link></p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to choose a new one.">
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" icon={Mail} />
        {error && <p role="alert" className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">{error}</p>}
        <button type="submit" disabled={sending || !email} className="btn btn-primary w-full !py-3">
          {sending ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm"><Link to="/login" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"><ArrowLeft size={14} aria-hidden /> Back to log in</Link></p>
    </AuthShell>
  );
}
