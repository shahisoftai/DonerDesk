"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoundaryUnit } from "../../../maps/domain/boundaries/join";
import { useMapServices } from "../../../maps/presentation/MapServices";

export type LevelsStatus = "idle" | "loading" | "ready" | "none";

/**
 * A country's boundaries, a level at a time: the first level when the country is chosen, a finer one only when someone opens an area
 * (or searches, or matches the documents' places). Reads the same files the Maps page reads, so nothing new is shipped.
 */
export function usePlaceLevels(country: string | null) {
  const { boundaries } = useMapServices();
  const [status, setStatus] = useState<LevelsStatus>("idle");
  const [levels, setLevels] = useState<number[]>([]);
  const [units, setUnits] = useState<ReadonlyMap<number, readonly BoundaryUnit[]>>(new Map());
  const asked = useRef(new Map<number, Promise<readonly BoundaryUnit[]>>());
  const store = useRef(new Map<number, readonly BoundaryUnit[]>());
  const generation = useRef(0);

  useEffect(() => {
    const mine = ++generation.current;
    asked.current = new Map();
    store.current = new Map();
    setUnits(new Map());
    setLevels([]);
    if (!country) { setStatus("idle"); return; }
    setStatus("loading");
    (async () => {
      const found = (await boundaries.levelsFor({ name: country })).filter((l) => l >= 1);
      if (mine !== generation.current) return;
      if (found.length === 0) { setStatus("none"); return; }
      setLevels(found);
      const first = await boundaries.load({ name: country }, found[0]!);
      if (mine !== generation.current) return;
      store.current.set(found[0]!, first ?? []);
      asked.current.set(found[0]!, Promise.resolve(first ?? []));
      setUnits(new Map([[found[0]!, first ?? []]]));
      setStatus(first && first.length > 0 ? "ready" : "none");
    })().catch(() => { if (mine === generation.current) setStatus("none"); });
  }, [country, boundaries]);

  /** Loads a level once; asking again waits for the same load. */
  const ensure = useCallback((level: number): Promise<readonly BoundaryUnit[]> => {
    if (!country) return Promise.resolve([]);
    let hit = asked.current.get(level);
    if (!hit) {
      const mine = generation.current;
      hit = boundaries.load({ name: country }, level).then((list) => {
        const got = list ?? [];
        if (mine === generation.current) { store.current.set(level, got); setUnits((cur) => (cur.has(level) ? cur : new Map(cur).set(level, got))); }
        return got;
      });
      asked.current.set(level, hit);
    }
    return hit;
  }, [country, boundaries]);

  /** Every level, returned at once (the state follows a moment later): for search and for matching the documents' places. */
  const ensureAll = useCallback(async (): Promise<ReadonlyMap<number, readonly BoundaryUnit[]>> => {
    await Promise.all(levels.map((l) => ensure(l)));
    return new Map(store.current);
  }, [levels, ensure]);
  return { status, levels, units, ensure, ensureAll };
}
