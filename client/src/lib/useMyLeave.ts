import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { api, ApiError } from "./api";
import { useToast } from "./toast-context";
import type { User } from "../types";

type Moved = { ticket: string; to: string | null }[];
export type LeaveBack = { returned: { ticket: string }[]; kept: { ticket: string; with: string | null; status: string }[] };

export function welcomeBack(back: LeaveBack) {
  const r = back.returned.length;
  const kept = back.kept.filter((k) => k.status === "in_progress");
  const parts = [];
  if (r) parts.push(`${r} ${r === 1 ? "issue that wasn't started is" : "issues that weren't started are"} back on your desk.`);
  if (kept.length) parts.push(`${kept.length} already in progress ${kept.length === 1 ? "stays" : "stay"} with ${[...new Set(kept.map((k) => k.with ?? "a colleague"))].join(", ")}.`);
  if (back.kept.length - kept.length > 0) parts.push(`${back.kept.length - kept.length} ${back.kept.length - kept.length === 1 ? "was" : "were"} fixed while you were away.`);
  return parts.length ? parts.join(" ") : "Nothing was handed over, so your desk is as you left it. New assignments will reach you again.";
}

// An officer starting or ending their own leave (used by the Field Desk and the Profile's Leave tab).
export function useMyLeave(onChanged?: () => void) {
  const { updateUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function change(onLeave: boolean, until: string | null = null, reason?: string) {
    setBusy(true);
    try {
      const d = await api<{ user: User; moved: Moved; back: LeaveBack }>("/officer/leave", { method: "PATCH", body: { onLeave, leaveUntil: until, leaveReason: reason } });
      updateUser(d.user);
      const handed = d.moved.filter((m) => m.to).length;
      toast.success(
        onLeave
          ? d.moved.length ? `${handed} of your ${d.moved.length} open ${d.moved.length === 1 ? "issue was" : "issues were"} handed to colleagues. Enjoy your time off.` : "Enjoy your time off."
          : welcomeBack(d.back),
        { title: onLeave ? "You're on leave" : "Welcome back" },
      );
      onChanged?.();
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? (err.fieldErrors.leaveReason ?? err.message) : "Could not update. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, start: (until: string | null, reason: string) => change(true, until, reason), end: () => change(false) };
}
