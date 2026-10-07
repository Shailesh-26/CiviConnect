export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type Options = { method?: string; body?: unknown };

export async function api<T>(path: string, { method = "GET", body }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
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
    throw new ApiError(res.status, data?.message ?? "Something went wrong", fieldErrors);
  }

  return data as T;
}
