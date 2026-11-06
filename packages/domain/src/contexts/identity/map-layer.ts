/**
 * The workspace's own map boundaries (Phase 30.1): one uploaded GeoJSON layer that the site map draws
 * instead of the bundled country and province outlines. Validation is pure — the bytes stay with the
 * caller, which stores the returned JSON verbatim. District and sub-district polygons come in exactly
 * this way: whatever the workspace uploads is what the map draws.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";

/** An upload above this is refused before parsing; boundaries files beyond it belong in a GIS tool. */
export const MAP_LAYER_MAX_BYTES = 12 * 1024 * 1024;
const MAP_LAYER_NAME_MAX = 200;

export interface ValidatedMapLayer {
  /** The exact GeoJSON to store, re-serialized from the parsed file. */
  json: string;
  featureCount: number;
  name: string;
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.(geo)?json$/i, "").trim();
}

export function validateMapLayer(raw: string, opts: { fileName?: string; maxBytes?: number }): Result<ValidatedMapLayer> {
  const maxBytes = opts.maxBytes ?? MAP_LAYER_MAX_BYTES;
  if (!raw || Buffer.byteLength(raw, "utf8") > maxBytes) {
    return err(DomainError.validation(`The map file is too large: the limit is ${Math.round(maxBytes / (1024 * 1024))} MB`, { field: "file" }));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err(DomainError.validation("The map file is not valid JSON", { field: "file" }));
  }
  const collection = parsed as { type?: unknown; features?: unknown };
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length === 0) {
    return err(DomainError.validation("Upload a GeoJSON FeatureCollection with at least one boundary", { field: "file" }));
  }
  for (const [index, feature] of collection.features.entries()) {
    const geometry = (feature as { geometry?: unknown } | null)?.geometry;
    const coordinates = (geometry as { coordinates?: unknown } | null)?.coordinates;
    if (!geometry || typeof geometry !== "object" || !Array.isArray(coordinates)) {
      const name = (feature as { properties?: { name?: unknown } } | null)?.properties?.name;
      const label = typeof name === "string" && name ? ` ("${name}")` : ` ${index + 1}`;
      return err(DomainError.validation(`The boundary${label} has no shape drawn — every feature needs a geometry`, { field: "file" }));
    }
  }
  const name = stripExtension(opts.fileName ?? "").slice(0, MAP_LAYER_NAME_MAX) || "Uploaded boundaries";
  return ok({ json: JSON.stringify(collection), featureCount: collection.features.length, name });
}
