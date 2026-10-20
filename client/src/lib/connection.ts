// Tracks whether the server can be reached, so one banner can say "Reconnecting…" on every page.
// api() reports each request here; the banner listens.
let offline = false;
const listeners = new Set<(offline: boolean) => void>();

export function reportReachable(ok: boolean) {
  if (offline === !ok) return;
  offline = !ok;
  listeners.forEach((l) => l(offline));
}

export const isOffline = () => offline;

export function onConnectionChange(listener: (offline: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// No answer at all, a gateway error, or the dev proxy's empty 500 = the server itself is down.
export const looksUnreachable = (status: number, body: unknown) => status === 0 || status === 502 || status === 503 || status === 504 || (status === 500 && body === null);
