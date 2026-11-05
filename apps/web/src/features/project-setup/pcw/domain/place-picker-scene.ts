/** The Places slide's map as a scene (Phase 43): the areas inside the open one, shaded by what is ticked. Pure; a renderer turns it into pixels. */
import { geometryBounds, unionBounds } from "../../../maps/domain/model/bounds.ts";
import type { BoundaryUnit } from "../../../maps/domain/boundaries/join.ts";
import type { FillLayerSpec, MapScene, Tip } from "../../../maps/domain/model/scene.ts";
import type { TickState } from "./place-picker.ts";

/** Ticked is the strongest; inside a ticked area is lighter; some-inside is lighter still; unticked is plain. Each also has a words and a pattern elsewhere (the list), never colour alone. */
export const TICK_COLOR: Readonly<Record<TickState, string>> = { ON: "#0f766e", INSIDE: "#5eead4", SOME: "#99f6e4", OFF: "#cbd5e1" };

export function pickerScene(input: {
  label: string;
  units: readonly BoundaryUnit[];
  stateOf: (unit: BoundaryUnit) => TickState;
  stateWords: Readonly<Record<TickState, string>>;
  activeRef: string | null;
  dark: boolean;
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
  return { label: input.label, basemap: input.dark ? "dark" : "light", bounds: unionBounds(input.units.map((u) => geometryBounds(u.geometry))), layers: [fill], tips };
}
