// Stand-ins for the organisation's boundary-layer actions. The list comes from window.__layers (set by the check); every call is recorded
// on window.__h, and an upload records the fields and the file's name so the check can read what the form sent.
type Call = { name: string; args: unknown[] };
const h = (): { calls: Call[] } => ((window as unknown as { __h: { calls: Call[] } }).__h ??= { calls: [] });
const record = (name: string, ...args: unknown[]) => h().calls.push({ name, args });

export async function listBoundaryLayersAction() {
  return { ok: true as const, value: (window as unknown as { __layers?: unknown[] }).__layers ?? [] };
}
export async function uploadBoundaryLayerAction(formData: FormData) {
  const sent: Record<string, string> = {};
  for (const [key, value] of formData.entries()) sent[key] = value instanceof File ? `file:${value.name}` : String(value);
  record("upload", sent);
  return { ok: true as const, value: { iso: sent.iso, countryName: sent.countryName, adminLevel: Number(sent.adminLevel), name: "uploaded", featureCount: 2, sizeBytes: 100, hasCodes: !!sent.pcodeField, uploadedAt: "2026-11-03T00:00:00Z" } };
}
export async function removeBoundaryLayerAction(iso: string, adminLevel: number) {
  record("remove", iso, adminLevel);
  return { ok: true as const, value: undefined };
}
