/** Browser `fetch` helper for JSON API routes (same contract as `api` in `page.tsx`). */
export async function clientApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      prismaCode?: string;
    };
    const msg = body.error || "Request failed";
    throw new Error(body.prismaCode ? `${msg} (${body.prismaCode})` : msg);
  }
  return response.json() as Promise<T>;
}
