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
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const fieldErrors: Record<string, string> = {};
    for (const item of data?.errors ?? []) {
      if (item.field && !fieldErrors[item.field]) fieldErrors[item.field] = item.message;
    }
    throw new ApiError(res.status, data?.message ?? "Something went wrong", fieldErrors, data ?? {});
  }

  return data as T;
}
