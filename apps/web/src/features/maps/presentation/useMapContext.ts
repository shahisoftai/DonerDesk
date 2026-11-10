"use client";

import { useEffect, useState } from "react";
import { getMapContextAction } from "@/lib/actions/map-context";
import type { MapContextDto } from "@/lib/server/schemas-map-context";

let shared: Promise<MapContextDto | null> | undefined;

/** The organisation's map context settings (Phase 49.6): the ones the page read on the server when given, else read once per page load. Null while loading, on failure, or on a share link. */
export function useMapContext(enabled = true, initial?: MapContextDto | null): MapContextDto | null {
  const [value, setValue] = useState<MapContextDto | null>(initial ?? null);
  useEffect(() => {
    if (!enabled || initial !== undefined) return;
    let live = true;
    shared ??= getMapContextAction().then((r) => (r.ok ? r.value : null)).catch(() => null);
    void shared.then((v) => { if (live) setValue(v); });
    return () => { live = false; };
  }, [enabled, initial]);
  return value;
}
