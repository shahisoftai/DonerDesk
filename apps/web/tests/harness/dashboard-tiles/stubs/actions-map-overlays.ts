// Stand-in for the map overlay actions: one kept overlay (a river) so the panel's list, tick and remove can be driven.
const river = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Nile" }, geometry: { type: "LineString", coordinates: [[32, 13], [33, 14]] } }] });
 name: string; sizeBytes: number; featureCount: number; createdAt: string };
export async function listMapOverlaysAction() { return { ok: true as const, value: { overlays: [{ id: "ov1", name: "Rivers", sizeBytes: 300, featureCount: 1, createdAt: "2026-10-30T00:00:00Z" }] as MapOverlayItem[], canEdit: true } }; }
export async function readMapOverlayAction(_id: string) { return { ok: true as const, value: river }; }
export async function addMapOverlayAction(input: { name: string }) { return { ok: true as const, value: { id: "ov2", name: input.name, sizeBytes: 1, featureCount: 1, createdAt: "2026-10-30T00:00:00Z" } }; }
export async function removeMapOverlayAction(_id: string) { return { ok: true as const, value: undefined }; }
