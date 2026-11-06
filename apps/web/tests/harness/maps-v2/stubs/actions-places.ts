// Stand-ins for the signed-in place actions. The geometry ones keep shapes in memory and use the domain's own `validateGeometry`,
// so a refusal in the check is the real refusal; every call is recorded on window.__h for the checks to read.
import { validateGeometry } from "@donordesk/domain/contexts/places/geometry.js";
import { fixtureResults } from "../fixture";

type Call = { name: string; args: unknown[] };
const h = (): { calls: Call[]; shapes: Record<string, unknown> } => ((window as unknown as { __h: { calls: Call[]; shapes: Record<string, unknown> } }).__h ??= { calls: [], shapes: {} });
const record = (name: string, ...args: unknown[]) => h().calls.push({ name, args });

export async function getPlaceResultsAction(_projectId: string, level: number) {
  return { ok: true as const, value: { ...fixtureResults, level } };
}
export async function getPlaceGeometryAction(placeId: string) {
  record("get", placeId);
  const geometry = h().shapes[placeId] as { type: string } | undefined;
  if (!geometry) return { ok: false as const, error: { kind: "notFound" as const, message: "No outline" } };
  return { ok: true as const, value: { kind: geometry.type === "Polygon" ? "POLYGON" : "LINE", geometry } };
}
export async function setPlaceGeometryAction(placeId: string, geometry: unknown) {
  record("set", placeId, geometry);
  const checked = validateGeometry(geometry);
  if (!checked.ok) return { ok: false as const, error: { kind: "validation" as const, message: checked.error.message } };
  h().shapes[placeId] = checked.value.geometry;
  return { ok: true as const, value: { kind: checked.value.kind, vertices: checked.value.vertices } };
}
export async function clearPlaceGeometryAction(placeId: string) {
  record("clear", placeId);
  delete h().shapes[placeId];
  return { ok: true as const, value: undefined };
}
export async function importPlacesAction(input: { text: string; apply: boolean }) {
  record("import", input);
  return { ok: true as const, value: { create: [], skipped: [], problems: [], applied: input.apply } };
}
