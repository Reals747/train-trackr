import type { ApiError, ApiErrorBody } from "./types";

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const e = new Error(body.error || "Request failed") as ApiError;
    e.code = body.code;
    e.storeName = body.storeName;
    throw e;
  }
  return response.json() as Promise<T>;
}
