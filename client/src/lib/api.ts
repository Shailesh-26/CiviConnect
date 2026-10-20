import { looksUnreachable, reportReachable } from "./connection";

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;
  // Extra fields the server sent with the error, e.g. { issueId, ticket } for a duplicate.
  data: Record<string, unknown>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.data = data;
  }
}

type Options = { method?: string; body?: unknown };

export async function api<T>(path: string, { method = "GET", body }: Options = {}): Promise<T> {
  const isForm = body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "include",
      headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    reportReachable(false);
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  const data = await res.json().catch(() => null);
  if (looksUnreachable(res.status, data)) {
    reportReachable(false);
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  reportReachable(true);

  // Logged out by the server (password changed elsewhere, account turned off, session expired):
  // tell the app once so it can go to the login page and say why, instead of failing page by page.
  if (res.status === 401 && !/^\/auth\/(login|register|reset)/.test(path) && data?.message && data.message !== "Please log in to continue") {
    window.dispatchEvent(new CustomEvent("cc:signed-out", { detail: data.message }));
  }

  if (!res.ok) {
    const fieldErrors: Record<string, string> = {};
    for (const item of data?.errors ?? []) {
      if (item.field && !fieldErrors[item.field]) fieldErrors[item.field] = item.message;
    }
    throw new ApiError(res.status, data?.message ?? "Something went wrong", fieldErrors, data ?? {});
  }

  return data as T;
}
