// Stand-in for the overlay actions: one kept overlay; what was sent is recorded.
const river = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Nile" }, geometry: { type: "LineString", coordinates: [[32, 13], [33, 14]] } }] });
type H = { calls: Array<{ name: string; args: unknown[] }> };
const h = (): H => (window as unknown as { __h: H }).__h;
export type MapOverlayItem = { id: string; name: string; sizeBytes: number; featureCount: number; createdAt: string };
export async function listMapOverlaysAction() { return { ok: true as const, value: { overlays: [{ id: "ov1", name: "Rivers", sizeBytes: 300, featureCount: 1, createdAt: "2026-10-30T00:00:00Z" }] as MapOverlayItem[], canEdit: true } }; }
export async function readMapOverlayAction(id: string) { h().calls.push({ name: "read", args: [id] }); return { ok: true as const, value: river }; }
export async function addMapOverlayAction(input: { name: string; geojson: string }) { h().calls.push({ name: "add", args: [input] }); return { ok: true as const, value: { id: "ov2", name: input.name.replace(/\.[a-z]+$/i, ""), sizeBytes: input.geojson.length, featureCount: 1, createdAt: "2026-10-30T00:00:00Z" } }; }
export async function removeMapOverlayAction(id: string) { h().calls.push({ name: "remove", args: [id] }); return { ok: true as const, value: undefined }; }
