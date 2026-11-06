"use client";

import { useEffect, useState } from "react";
import type { BoundaryUnit } from "../domain/boundaries/join";
import { geometryContains } from "../domain/point-in-area";
import type { Pin } from "../domain/marking/pin";
import { containingAreas, type ContainingArea } from "../domain/marking/snap";
import type { BoundarySource } from "../ports/boundary-source";

/** The areas a pin falls inside, from the country down to the finest boundary files there are. Read after a short pause so dragging does not load files. */
export function useContainingAreas(pin: Pin | null, country: string | undefined, source: BoundarySource): ContainingArea[] {
  const [areas, setAreas] = useState<ContainingArea[]>([]);
  const key = pin ? `${pin.latitude},${pin.longitude}` : "";

  useEffect(() => {
    if (!pin) { setAreas([]); return; }
    let live = true;
    const timer = setTimeout(() => {
      void (async () => {
        const world = (await source.load(null, 0)) ?? [];
        const home: BoundaryUnit | undefined = world.find((u) => geometryContains(u.geometry, pin.latitude, pin.longitude));
        const name = home?.name ?? country;
        if (!name) { if (live) setAreas([]); return; }
        const levels = await source.levelsFor({ name });
        const layers: Array<{ level: number; units: readonly BoundaryUnit[] }> = home ? [{ level: 0, units: [home] }] : [];
        for (const level of levels) { const units = await source.load({ name }, level); if (units) layers.push({ level, units }); }
        if (live) setAreas(containingAreas(pin, layers));
      })().catch(() => { if (live) setAreas([]); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
    // The pin is read through its key: a new object with the same point must not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, country, source]);

  return areas;
}
