"use client";

/**
 * Maps kept on the phone for working without a signal (Phase 49.4): a piece of the street map cut to the project's country and the
 * country's province outlines. Kept in the Cache API under one cache per person (`donordesk-offline-maps-<userId>`), answered by the service
 * worker when there is no network, and removed on sign-out with the packs. They are public map data: no record, figure or name of the project.
 */
const PREFIX = "donordesk-offline-maps-";
const CURRENT = "dd-offline-basemap";

export interface OfflineMapRecord { projectId: string; url: string; bbox: [number, number, number, number]; bytes: number; savedAt: string }

const cacheName = (userId: string): string => `${PREFIX}${userId || "anyone"}`;

/** The size of the map for this box, asked before anything large is downloaded. Null when the server cannot make one. */
export async function offlineMapSize(projectId: string, bbox: readonly number[]): Promise<number | null> {
  const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/offline-basemap?bbox=${bbox.join(",")}&check=1`, { cache: "no-store" }).catch(() => null);
  if (!r?.ok) return null;
  const body = (await r.json().catch(() => null)) as { bytes?: number } | null;
  return typeof body?.bytes === "number" ? body.bytes : null;
}

export async function saveOfflineMap(userId: string, projectId: string, bbox: [number, number, number, number], admin1Url: string | null): Promise<OfflineMapRecord | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(cacheName(userId));
  const file = await fetch(`/api/projects/${encodeURIComponent(projectId)}/offline-basemap?bbox=${bbox.join(",")}`, { cache: "no-store" }).catch(() => null);
  if (!file?.ok) return null;
  const url = `/offline-maps/${encodeURIComponent(projectId)}.pmtiles`;
  const body = await file.blob();
  await cache.put(url, new Response(body, { headers: { "content-type": "application/octet-stream", "content-length": String(body.size) } }));
  if (admin1Url) { const outline = await fetch(admin1Url).catch(() => null); if (outline?.ok) await cache.put(admin1Url, outline); }
  const record: OfflineMapRecord = { projectId, url, bbox, bytes: body.size, savedAt: new Date().toISOString() };
  try { localStorage.setItem(CURRENT, JSON.stringify(record)); } catch { /* the file is kept; only the shortcut is lost */ }
  return record;
}

/** The map this phone keeps, if any (read by the basemap when there is no network). */
export function currentOfflineMap(): OfflineMapRecord | null {
  try { const raw = localStorage.getItem(CURRENT); return raw ? (JSON.parse(raw) as OfflineMapRecord) : null; } catch { return null; }
}

/** Removes every kept map (all people on this device): called on sign-out. */
export async function wipeOfflineMaps(): Promise<void> {
  try { localStorage.removeItem(CURRENT); } catch { /* nothing kept */ }
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith(PREFIX)).map((k) => caches.delete(k)));
}
