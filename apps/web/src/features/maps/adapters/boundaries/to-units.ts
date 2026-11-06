import { unitFromFeature, type BoundaryUnit } from "../../domain/boundaries/join.ts";
import type { NamedGeoCollection } from "../../../workplan/domain/geo/geo-types.ts";

/** A boundary file's features as units (name, code, parent code, shape); a feature with no name or no shape is left out. */
export const toUnits = (collection: NamedGeoCollection): BoundaryUnit[] =>
  collection.features.map((f) => unitFromFeature(f as Parameters<typeof unitFromFeature>[0])).filter((u): u is BoundaryUnit => u !== null);
