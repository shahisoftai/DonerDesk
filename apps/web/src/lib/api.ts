const SERVER_API_URL =
  process.env.API_INTERNAL_URL ??
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:4001";

const BROWSER_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: { title: string; status: number; code?: string } };

export async function api<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (init?.token) headers.set("authorization", `Bearer ${init.token}`);
  const res = await fetch(`${SERVER_API_URL}${path}`, { ...init, headers, cache: "no-store" });
  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const message = typeof body === "object" && body !== null && "title" in body ? String((body as { title: unknown }).title) : `HTTP ${res.status}`;
    throw Object.assign(new Error(message), { status: res.status, body });
  }
  return body as T;
}

export async function apiRaw(path: string, init?: RequestInit & { token?: string }): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.token) headers.set("authorization", `Bearer ${init.token}`);
  return fetch(`${SERVER_API_URL}${path}`, { ...init, headers, cache: "no-store" });
}

export const browserApiUrl = BROWSER_API_URL;
