// Base URL comes from the environment so dev/prod backends are swapped via
// .env, never hardcoded — see .env.example.
const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  throw new Error("VITE_API_URL is not set — copy .env.example to .env and fill it in.");
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function apiPost<TResponse>(path: string, payload: unknown): Promise<TResponse> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<TResponse>;
}
