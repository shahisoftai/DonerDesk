/**
 * Boundary files an organisation uploads for one country and one admin level (Phase 41.7). Pure: the bytes stay with the caller.
 *
 * Where no open file exists for districts, wards or communities, an organisation brings its own. Whatever it uploads is normalised once,
 * here, into the app's own boundary format (a name, a P-code, the parent's P-code, polygons only), so the map never has to know what the
 * original file called its columns. Nothing is guessed silently: the person picks the fields (with suggestions), and any feature that
 * does not fit blocks the whole file and is named.
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { MAP_LAYER_MAX_BYTES } from "./map-layer.js";

export const BOUNDARY_LAYER_LEVELS = [1, 2, 3, 4] as const;
export type BoundaryLayerLevel = (typeof BOUNDARY_LAYER_LEVELS)[number];
export const BOUNDARY_LAYER_MAX_FEATURES = 20_000;
/** Layers one organisation may keep (a country and a level each). */
export const BOUNDARY_LAYER_MAX_LAYERS = 60;
const COORDINATE_DIGITS = 5;

const bad = (message: string, field = "file") => err(DomainError.validation(message, { field }));
const round = (n: number): number => { const f = 10 ** COORDINATE_DIGITS; return Math.round(n * f) / f; };

interface RawFeature { properties?: Record<string, unknown> | null; geometry?: { type?: unknown; coordinates?: unknown } | null }

function parseCollection(raw: string, maxBytes: number): Result<RawFeature[]> {
  if (!raw || new TextEncoder().encode(raw).length > maxBytes) return bad(`The boundary file is too large: the limit is ${Math.round(maxBytes / (1024 * 1024))} MB`);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return bad("The boundary file is not valid JSON"); }
  const c = parsed as { type?: unknown; features?: unknown };
  if (!c || c.type !== "FeatureCollection" || !Array.isArray(c.features) || c.features.length === 0) return bad("Upload a GeoJSON FeatureCollection with at least one boundary");
  if (c.features.length > BOUNDARY_LAYER_MAX_FEATURES) return bad(`A boundary file has at most ${BOUNDARY_LAYER_MAX_FEATURES} boundaries`);
  return ok(c.features as RawFeature[]);
}

const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "");

// ---- helping a person choose the fields -------------------------------------------------------------------

export interface FieldGuide {
  featureCount: number;
  /** Every property name found in the first features, in file order. */
  fields: string[];
  /** The best guess for each, or null. Only a suggestion: the person confirms it. */
  suggested: { nameField: string | null; pcodeField: string | null; parentPcodeField: string | null };
  /** The first few features' values for the fields found, so the person can see what each holds. */
  sample: Array<Record<string, string>>;
}

const NAME_GUESSES: readonly RegExp[] = [/^(shape_?name|name_en|name|nom|nombre)$/i, /^adm\d_(en|name)$/i, /^(adm\d?|admin\d?)_?name$/i, /^name_?\d$/i, /name/i];
const CODE_GUESSES: readonly RegExp[] = [/^(p_?code|pcode)$/i, /^adm\d_pcode$/i, /^shape_?id$/i, /^(code|id)$/i, /code$/i];

const pick = (fields: readonly string[], guesses: readonly RegExp[], skip: ReadonlySet<string>): string | null => {
  for (const g of guesses) { const hit = fields.find((f) => !skip.has(f) && g.test(f)); if (hit) return hit; }
  return null;
};

/** What the file holds, and a suggestion for each field, for the screen to show before anything is uploaded. */
export function guideBoundaryFields(raw: string, adminLevel?: number): Result<FieldGuide> {
  const parsed = parseCollection(raw, MAP_LAYER_MAX_BYTES);
  if (!parsed.ok) return parsed;
  const fields: string[] = [];
  for (const f of parsed.value.slice(0, 200)) for (const key of Object.keys(f.properties ?? {})) if (!fields.includes(key)) fields.push(key);
  const nameField = pick(fields, NAME_GUESSES, new Set());
  const parentGuesses = [new RegExp(`^adm${(adminLevel ?? 0) - 1}_pcode$`, "i"), /^(parent_?(p_?code|id|code)|parent)$/i];
  const parentPcodeField = adminLevel && adminLevel > 1 ? pick(fields, parentGuesses, new Set()) : null;
  const pcodeField = pick(fields, CODE_GUESSES, new Set([parentPcodeField ?? "", nameField ?? ""].filter(Boolean)));
  const sample = parsed.value.slice(0, 5).map((f) => Object.fromEntries(fields.map((k) => [k, textOf(f.properties?.[k])])));
  return ok({ featureCount: parsed.value.length, fields, suggested: { nameField, pcodeField, parentPcodeField }, sample });
}

// ---- the check -------------------------------------------------------------------------------------------------

export interface BoundaryLayerInput {
  iso: string;
  countryName: string;
  adminLevel: number;
  fileName?: string | undefined;
  nameField: string;
  pcodeField?: string | null | undefined;
  parentPcodeField?: string | null | undefined;
}

export interface CheckedBoundaryLayer {
  iso: string;
  countryName: string;
  adminLevel: BoundaryLayerLevel;
  /** The layer's own name: the file's, or "<country> level n". */
  name: string;
  nameField: string;
  pcodeField: string | null;
  parentPcodeField: string | null;
  featureCount: number;
  /** The exact GeoJSON to store, in the app's boundary format. */
  json: string;
}

function roundPositions(value: unknown): unknown {
  if (typeof value === "number") return round(value);
  return Array.isArray(value) ? value.map(roundPositions) : value;
}

function positionsOf(value: unknown, out: Array<[number, number]> = []): Array<[number, number]> {
  if (!Array.isArray(value)) return out;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") { out.push([value[0], value[1]]); return out; }
  for (const part of value) positionsOf(part, out);
  return out;
}

export function validateBoundaryLayer(raw: string, input: BoundaryLayerInput, opts: { maxBytes?: number } = {}): Result<CheckedBoundaryLayer> {
  const iso = input.iso.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(iso)) return bad("Give the country's three-letter code, for example UGA", "iso");
  const countryName = input.countryName.trim();
  if (!countryName || countryName.length > 80) return bad("Give the country's name", "countryName");
  if (!(BOUNDARY_LAYER_LEVELS as readonly number[]).includes(input.adminLevel)) return bad("Choose which level these boundaries are: provinces, districts, sub-districts or communities", "adminLevel");
  const nameField = input.nameField.trim();
  if (!nameField) return bad("Choose the column that holds each boundary's name", "nameField");
  const pcodeField = input.pcodeField?.trim() || null;
  const parentPcodeField = input.parentPcodeField?.trim() || null;

  const parsed = parseCollection(raw, opts.maxBytes ?? MAP_LAYER_MAX_BYTES);
  if (!parsed.ok) return parsed;

  const features: unknown[] = [];
  const codeOwner = new Map<string, string>();
  for (const [index, f] of parsed.value.entries()) {
    const props = f?.properties ?? {};
    const name = textOf(props[nameField]);
    const where = `Boundary ${index + 1}${name ? ` (${name})` : ""}`;
    if (!name) return bad(`${where} has no value in "${nameField}"; every boundary needs a name`);
    const type = f?.geometry?.type;
    if ((type !== "Polygon" && type !== "MultiPolygon") || !Array.isArray(f?.geometry?.coordinates)) return bad(`${where} is not a polygon; only areas can be boundaries`);
    const points = positionsOf(f.geometry!.coordinates);
    if (points.length < 4) return bad(`${where} has no shape drawn`);
    if (points.some(([x, y]) => x < -180 || x > 180 || y < -90 || y > 90)) return bad(`${where} lies outside the map (longitude -180 to 180, latitude -90 to 90)`);
    let id = "";
    if (pcodeField) {
      id = textOf(props[pcodeField]);
      if (!id) return bad(`${where} has no value in "${pcodeField}"; every boundary needs its code, or choose no code column`);
      const other = codeOwner.get(id);
      if (other !== undefined) return bad(`The code ${id} is used by two boundaries: ${other} and ${name}`);
      codeOwner.set(id, name);
    }
    const parentId = parentPcodeField ? textOf(props[parentPcodeField]) : "";
    features.push({ type: "Feature", properties: { name, id, parentId }, geometry: { type, coordinates: roundPositions(f.geometry!.coordinates) } });
  }
  const stripped = (input.fileName ?? "").replace(/\.(geo)?json$/i, "").trim().slice(0, 200);
  return ok({
    iso, countryName, adminLevel: input.adminLevel as BoundaryLayerLevel, name: stripped || `${countryName} level ${input.adminLevel}`,
    nameField, pcodeField, parentPcodeField, featureCount: features.length,
    json: JSON.stringify({ type: "FeatureCollection", features }),
  });
}
