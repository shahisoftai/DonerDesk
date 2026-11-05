/** The Places slide's map as a scene (Phase 43): the areas inside the open one, shaded by what is ticked. Pure; a renderer turns it into pixels. */
import { geometryBounds, unionBounds } from "../../../maps/domain/model/bounds.ts";
import type { BoundaryUnit } from "../../../maps/domain/boundaries/join.ts";
import { pinTipKey, type FillLayerSpec, type LayerSpec, type MapScene, type Tip } from "../../../maps/domain/model/scene.ts";
import type { Mark, TickState } from "./place-picker.ts";

/** Ticked is the strongest; inside a ticked area is lighter; some-inside is lighter still; unticked is plain. Each also has a words and a pattern elsewhere (the list), never colour alone. */
export const TICK_COLOR: Readonly<Record<TickState, string>> = { ON: "#0f766e", INSIDE: "#5eead4", SOME: "#bfdbfe", OFF: "#cbd5e1" };
/** The point drawn for a ticked area too fine to see at this level: the same teal as a ticked shape, darker than any tint. */
const MARK_COLOR = "#0f766e";

export function pickerScene(input: {
  label: string;
  units: readonly BoundaryUnit[];
  stateOf: (unit: BoundaryUnit) => TickState;
  stateWords: Readonly<Record<TickState, string>>;
  activeRef: string | null;
  dark: boolean;
  marks?: readonly Mark[];
}): MapScene {
  const tips: Record<string, Tip> = {};
  const fill: FillLayerSpec = {
    kind: "FILL", opacity: 0.8, outline: true, selectedRef: input.activeRef,
    features: input.units.map((u) => {
      const state = input.stateOf(u);
      tips[u.ref] = { title: u.name, lines: state === "OFF" ? [] : [input.stateWords[state]] };
      return { ref: u.ref, name: u.name, color: TICK_COLOR[state], geometry: u.geometry };
    }),
  };
  const layers: LayerSpec[] = [fill];
  if (input.marks && input.marks.length > 0) {
    for (const m of input.marks) tips[pinTipKey(m.ref)] = { title: m.name, lines: [] };
    layers.push({ kind: "PINS", opacity: 1, selectedId: null, cluster: false, pins: input.marks.map((m) => ({ id: m.ref, name: m.name, lng: m.lng, lat: m.lat, color: MARK_COLOR, radius: 6 })) });
  }
  return { label: input.label, basemap: input.dark ? "dark" : "light", bounds: unionBounds(input.units.map((u) => geometryBounds(u.geometry))), layers, tips };
}
