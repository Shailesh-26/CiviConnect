import { useState } from "react";

type Check = (value: string) => string | undefined;

// Shared rules, matching the server's (server/src/validators/auth.validators.ts).
export const rules = {
  email: (v: string) => (!v.trim() ? "Enter your email" : !/^\S+@\S+\.\S+$/.test(v.trim()) ? "Enter a valid email address" : undefined),
  required: (message: string) => (v: string) => (v ? undefined : message),
  name: (v: string) => (!v.trim() ? "Enter your full name" : v.trim().length < 2 ? "Name must be at least 2 characters" : undefined),
  newPassword: (v: string) =>
    !v
      ? "Choose a password"
      : v.length < 8
        ? "Password must be at least 8 characters"
        : !/[A-Za-z]/.test(v)
          ? "Password must contain a letter"
          : !/\d/.test(v)
            ? "Password must contain a number"
            : undefined,
};

// Form messages that don't nag: a box is checked once you leave it (or press the button), and from then
// on its message updates live as you type, disappearing as soon as the value is fine.
// Messages from the server (like "email already registered") show until that box is edited.
export function useFormChecks<K extends string>(values: Record<K, string>, checks: Record<K, Check>) {
  const [watched, setWatched] = useState<Partial<Record<K, boolean>>>({});
  const [server, setServer] = useState<Partial<Record<K, { message: string; value: string }>>>({});

  const errorFor = (key: K): string | undefined => {
    if (watched[key]) {
      const problem = checks[key](values[key]);
      if (problem) return problem;
    }
    const s = server[key];
    return s && s.value === values[key] ? s.message : undefined;
  };

  const errors = Object.fromEntries((Object.keys(checks) as K[]).map((k) => [k, errorFor(k)])) as Record<K, string | undefined>;

  return {
    errors,
    // Call from a box's onBlur. An untouched empty box is left alone while you tab past it.
    blur: (key: K) => {
      if (values[key]) setWatched((w) => ({ ...w, [key]: true }));
    },
    // Call when the form is submitted. Returns true when every box passes.
    checkAll: () => {
      setWatched(Object.fromEntries(Object.keys(checks).map((k) => [k, true])) as Record<K, boolean>);
      return (Object.keys(checks) as K[]).every((k) => !checks[k](values[k]));
    },
    setServerErrors: (fieldErrors: Record<string, string>) => {
      const next: Partial<Record<K, { message: string; value: string }>> = {};
      for (const k of Object.keys(checks) as K[]) if (fieldErrors[k]) next[k] = { message: fieldErrors[k], value: values[k] };
      setServer(next);
    },
  };
}
