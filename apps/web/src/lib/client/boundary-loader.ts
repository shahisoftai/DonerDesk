"use client";

import type { NamedGeoCollection } from "../../features/workplan/domain/geo/geo-types";
import type { BoundaryFileEntry, BoundaryManifest } from "../../features/maps/domain/boundary-sources";

/** Fetches the boundary manifest and a country's finer files on demand (static files under /geo, never in a first bundle). */
let manifest: Promise<BoundaryManifest | null> | undefined;

export function loadBoundaryManifest(): Promise<BoundaryManifest | null> {
  return (manifest ??= fetch("/geo/manifest.json").then((r) => (r.ok ? (r.json() as Promise<BoundaryManifest>) : null)).catch(() => null));
}

const files = new Map<string, Promise<NamedGeoCollection | null>>();

export function loadBoundaryFile(entry: BoundaryFileEntry): Promise<NamedGeoCollection | null> {
  let hit = files.get(entry.file);
  if (!hit) {
    hit = fetch(`/geo/${entry.file}`)
      .then((r) => (r.ok ? (r.json() as Promise<NamedGeoCollection>) : null))
      .catch(() => null);
    files.set(entry.file, hit);
  }
  return hit;
}

const provinces = new Map<string, Promise<NamedGeoCollection | null>>();

/** One country's provinces from its own small file (`/geo/ADM1/<key>.json`), or null when it is not there (the caller then falls back to the bundled module). */
export function loadAdmin1File(key: string): Promise<NamedGeoCollection | null> {
  let hit = provinces.get(key);
  if (!hit) {
    hit = key
      ? fetch(`/geo/ADM1/${encodeURIComponent(key)}.json`).then((r) => (r.ok ? (r.json() as Promise<NamedGeoCollection>) : null)).catch(() => null)
      : Promise.resolve(null);
    provinces.set(key, hit);
  }
  return hit;
}
