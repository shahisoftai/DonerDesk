"use client";

import { useEffect, useState } from "react";
import { getMapContextAction } from "@/lib/actions/map-context";
import type { MapContextDto } from "@/lib/server/schemas-map-context";

let shared: Promise<MapContextDto | null> | undefined;

/** The organisation's map context settings, read once per page load (Phase 49.6). Null while loading, on failure, or on a share link. */
export function useMapContext(enabled = true): MapContextDto | null {
  const [value, setValue] = useState<MapContextDto | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    shared ??= getMapContextAction().then((r) => (r.ok ? r.value : null)).catch(() => null);
    void shared.then((v) => { if (live) setValue(v); });
    return () => { live = false; };
  }, [enabled]);
  return value;
}
