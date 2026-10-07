import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Field } from "../components/Field";
import { ApiError } from "../lib/api";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        if (Object.keys(err.fieldErrors).length === 0) setError(err.message);
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Full name" value={name} onChange={setName} autoComplete="name" error={fieldErrors.name} />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          error={fieldErrors.email}
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number."
          error={fieldErrors.password}
        />
        {error && <p className="text-sm text-alert">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-signboard px-4 py-2 font-medium text-white hover:bg-signboard/90 disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Register"}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink/70">
        Already registered?{" "}
        <Link to="/login" className="font-medium text-signboard underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
