"use client";

import { useMemo } from "react";
import type { DatasetMap } from "@donordesk/domain/contexts/canvas/index.js";
import { MapExplorer, type PlaceResultsLoader } from "@/features/maps/presentation/MapExplorer";
import type { PlaceItem, PlaceResults } from "@/lib/server/schemas-places";

/**
 * A dataset on the real map (Phase 54): the Maps explorer (boundaries, colours, legend, drilling from province to district) drawing the
 * dataset's figures by place, worked out on the server for every level. Nothing is read again from the browser: each level is already in
 * the model, so the same map works on a share link.
 */
export function DatasetMapView({ map, projectId }: { map: DatasetMap; projectId: string | undefined }) {
  const places = useMemo<PlaceItem[]>(() => map.places.map((p) => ({
    id: p.id, name: p.name, kind: p.kind, adminLevel: p.adminLevel, path: p.path, aliases: [], archived: false,
    childCount: map.places.filter((c) => c.parentId === p.id).length,
    ...(p.parentId ? { parentId: p.parentId } : {}), ...(p.country ? { country: p.country } : {}), ...(p.code ? { code: p.code } : {}),
    ...(p.latitude !== undefined ? { latitude: p.latitude } : {}), ...(p.longitude !== undefined ? { longitude: p.longitude } : {}),
  })), [map]);
  const first = map.byLevel[String(map.firstLevel)] as unknown as PlaceResults | undefined;
  const loader = useMemo<PlaceResultsLoader>(() => async (_project, level) => {
    const r = map.byLevel[String(level)];
    return r ? { ok: true as const, value: r as unknown as PlaceResults } : { ok: false as const, error: { kind: "unexpected" as const, message: "Nothing in this dataset is at that level." } };
  }, [map]);
  if (!first) return null;
  return <MapExplorer compact staticData={false} projectId={projectId ?? ""} places={places} initial={first} periods={[]} loadResults={loader} />;
}
