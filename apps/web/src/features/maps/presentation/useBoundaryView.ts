"use client";

import { useEffect, useState } from "react";
import { unitsWithin, type WithinBasis } from "../domain/boundaries/within";
import type { BoundaryUnit } from "../domain/boundaries/join";
import { shownLevel, type DrillPath } from "../domain/drill/drill-path";
import type { BoundarySource } from "../ports/boundary-source";

export interface BoundaryView {
  status: "loading" | "ready" | "error";
  /** Levels below the country that can be drawn (empty at the world). */
  levels: readonly number[];
  /** The level drawn. */
  shown: number;
  /** The boundaries drawn: the shown level, inside the last opened one. */
  units: readonly BoundaryUnit[];
  /** The unit of each crumb, in order (for names and for filtering). */
  opened: readonly BoundaryUnit[];
  basis: WithinBasis | null;
}

const LOADING: BoundaryView = { status: "loading", levels: [], shown: 0, units: [], opened: [], basis: null };

/** Loads the boundaries a drill path points at, walking each opened level so the next can be filtered to sit inside it. */
export function useBoundaryView(path: DrillPath, source: BoundarySource): BoundaryView {
  const [view, setView] = useState<BoundaryView>(LOADING);
  const key = path.map((c) => `${c.level}:${c.ref}`).join("/");

  useEffect(() => {
    let live = true;
    (async () => {
      const country = path[0] ? { name: path[0].name } : null;
      const levels = country ? await source.levelsFor(country) : [];
      const opened: BoundaryUnit[] = [];
      let parent: BoundaryUnit | null = null;
      for (const crumb of path) {
        const all = await source.load(country, crumb.level);
        const scoped: readonly BoundaryUnit[] = all && parent ? unitsWithin(all, parent).units : (all ?? []);
        const hit = scoped.find((u) => u.ref === crumb.ref) ?? (all ?? []).find((u) => u.ref === crumb.ref);
        if (!hit) break;
        opened.push(hit);
        parent = hit;
      }
      const shown = shownLevel(path, levels);
      const all = await source.load(country, shown);
      const within = all && parent ? unitsWithin(all, parent) : null;
      if (!live) return;
      setView({ status: all ? "ready" : "error", levels, shown, units: within ? within.units : (all ?? []), opened, basis: within?.basis ?? null });
    })().catch(() => { if (live) setView({ ...LOADING, status: "error" }); });
    return () => { live = false; };
    // The path is read through its key: a new array with the same crumbs must not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, source]);

  return view;
}
