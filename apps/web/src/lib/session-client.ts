"use client";
export function getSessionToken(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)dd_session=([^;]+)/);
  if (!m) return null;
  const v = m[1];
  return v ? decodeURIComponent(v) : null;
}

export function getClientToken(): string | null {
  return getSessionToken();
}
