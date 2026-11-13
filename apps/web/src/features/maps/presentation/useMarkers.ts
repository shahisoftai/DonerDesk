"use client";

import { useMemo, useState } from "react";
import { calloutAnchors, type AnchorPlace } from "../domain/scene/callout-anchors";
import { placeMarkers, type MarkerIndicator, type MarkerKind, type MarkerResult } from "../domain/scene/place-markers";
import type { JoinedUnit } from "../domain/boundaries/join";
import type { PlaceResults } from "@/lib/server/schemas-places";

/** The small-charts choice and what it draws (Phase 53.5): kept out of the explorer so the explorer only composes. */
export function useMarkers(results: PlaceResults | null, places: readonly AnchorPlace[], joined: readonly JoinedUnit[]) {
  const [kind, setKind] = useState<MarkerKind>("NONE");
  const [ids, setIds] = useState<string[]>([]);
  const data = useMemo<MarkerResult | null>(() => {
    if (kind === "NONE" || !results) return null;
    const inds: MarkerIndicator[] = results.indicators.filter((i) => ids.includes(i.id)).map((i) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, isRate: i.isRate, additive: i.rollup.additive, rows: i.rollup.rows.map((x) => ({ placeId: x.placeId, name: x.name, value: x.value })) }));
    return placeMarkers(kind, inds);
  }, [kind, ids, results]);
  const anchors = useMemo(() => {
    if (!data || !data.ok) return new Map<string, { lng: number; lat: number }>();
    const placed = calloutAnchors(data.markers.map((m) => ({ key: m.placeId, placeKey: m.name })), places, joined).placed;
    return new Map(placed.map((c) => [c.key, { lng: c.lng, lat: c.lat }]));
  }, [data, places, joined]);
  return { kind, setKind, ids, setIds, data, anchors };
}
