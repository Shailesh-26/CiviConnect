import type { FlagReason } from "../types";

export const publicLink = (ticket: string) => `${window.location.origin}/i/${ticket}`;

// Opens the phone's share sheet when there is one, otherwise copies the public link.
export async function shareIssue(ticket: string, title: string): Promise<"shared" | "copied" | "failed"> {
  const url = publicLink(ticket);
  if (navigator.share) {
    try {
      await navigator.share({ title: `${title} · ${ticket}`, text: `${title} reported on CiviConnect`, url });
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "shared";
    }
  }
  return copyText(url);
}

export async function copyText(text: string): Promise<"copied" | "failed"> {
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

export function formatDistance(m: number) {
  if (m < 50) return "right here";
  if (m < 1000) return `${Math.round(m / 10) * 10} m away`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km away`;
}

export const FLAG_REASONS: { value: FlagReason; label: string; hint: string }[] = [
  { value: "fake", label: "Not a real problem", hint: "The report is false or made up." },
  { value: "duplicate", label: "Duplicate", hint: "Already reported as another issue." },
  { value: "wrong_location", label: "Wrong location", hint: "The pin is in the wrong place." },
  { value: "spam", label: "Spam or advertising", hint: "Has nothing to do with a civic problem." },
  { value: "abusive", label: "Abusive or personal", hint: "Insults, threats or someone's private details." },
  { value: "other", label: "Something else", hint: "Tell the admins in the note." },
];
