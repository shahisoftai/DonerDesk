"use client";

import { useMemo, useState } from "react";
import { MapLibreCanvas } from "../../../maps/presentation/MapLibreCanvas";
import { useMapServices } from "../../../maps/presentation/MapServices";
import { useColorMode } from "../../../design/presentation/use-color-mode";
import type { BoundaryUnit } from "../../../maps/domain/boundaries/join";
import { pickerScene } from "../domain/place-picker-scene";
import type { TickState } from "../domain/place-picker";
import { PickSvgMap } from "./PickSvgMap";
import type { PcwCopy } from "../copy";

type PlacesCopy = PcwCopy["places"];

/**
 * The map beside the list: the areas inside the open one, shaded by what is ticked. Clicking an area chooses it (the list and the card follow);
 * it is the same choice as clicking its name in the list. When the device cannot start the map the same areas are drawn as plain shapes.
 */
export function PlacePickMap({ units, stateOf, activeRef, label, copy, onChoose }: {
  units: readonly BoundaryUnit[]; stateOf: (u: BoundaryUnit) => TickState; activeRef: string | null; label: string; copy: PlacesCopy; onChoose: (ref: string | null) => void;
}) {
  const services = useMapServices();
  const dark = useColorMode() === "dark";
  const [failed, setFailed] = useState(false);
  const useWebGl = useMemo(() => !failed && services.canUseWebGL(), [failed, services]);
  const words = useMemo<Record<TickState, string>>(() => ({ ON: copy.ticked(1), INSIDE: copy.insideTicked(""), SOME: copy.partlyTicked, OFF: "" }), [copy]);
  const scene = useMemo(() => pickerScene({ label, units, stateOf, stateWords: words, activeRef, dark }), [label, units, stateOf, words, activeRef, dark]);
  if (units.length === 0) return <div className="flex h-[26rem] items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">{copy.loading}</div>;
  return (
    <div className="space-y-1">
      {useWebGl
        ? <MapLibreCanvas scene={scene} height="h-[26rem]" onFailed={() => setFailed(true)} onSelect={(ref) => onChoose(ref && ref.kind === "REGION" ? ref.id : null)} />
        : <PickSvgMap units={units} stateOf={stateOf} activeRef={activeRef} label={label} onChoose={onChoose} />}
      {failed ? <p className="text-xs text-amber-900 dark:text-amber-300">{copy.mapUnavailable}</p> : <p className="text-xs text-slate-600 dark:text-slate-300">{copy.mapHint}</p>}
    </div>
  );
}
