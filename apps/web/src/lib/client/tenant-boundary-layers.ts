"use client";

import { listBoundaryLayersAction } from "@/lib/actions/org";
import type { BoundaryLayerMeta } from "@/lib/server/schemas-boundary-layers";
import type { NamedGeoCollection } from "../../features/workplan/domain/geo/geo-types";

/**
 * What the map knows about the boundary files this organisation uploaded: the list (once per visit) and each file when a map needs it.
 * After an upload or a removal the settings card resets this, so the next map reads the new files.
 */
let list: Promise<readonly BoundaryLayerMeta[]> | undefined;
const files = new Map<string, Promise<NamedGeoCollection | null>>();

export function loadBoundaryLayerList(): Promise<readonly BoundaryLayerMeta[]> {
  return (list ??= listBoundaryLayersAction().then((r) => (r.ok ? r.value : [])).catch(() => []));
}

export function loadBoundaryLayerFile(iso: string, adminLevel: number): Promise<NamedGeoCollection | null> {
  const key = `${iso}-${adminLevel}`;
  let hit = files.get(key);
  if (!hit) {
    hit = fetch(`/api/organization/boundary-layers/${encodeURIComponent(iso)}/${adminLevel}`)
      .then((r) => (r.ok ? (r.json() as Promise<NamedGeoCollection>) : null))
      .catch(() => null);
    files.set(key, hit);
  }
  return hit;
}

export function resetBoundaryLayerCache(): void {
  list = undefined;
  files.clear();
}
