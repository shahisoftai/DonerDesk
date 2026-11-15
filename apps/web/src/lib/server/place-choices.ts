import "server-only";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { PlaceListSchema } from "@/lib/server/schemas-places";
import { ProjectPlacesSchema, RecordPlacesSchema } from "@/lib/server/schemas-place-tree";
import type { PickerPlace } from "@/features/places/presentation/picker/PlacePicker";

/**
 * What every place picker on a project page needs (Phase 56): the organisation's live places and this project's own (its open areas and
 * everything inside them, plus places its records already use). Read together; a failed read gives an empty picker, never a broken page.
 */
export async function placeChoicesFor(projectId: string, token: string): Promise<{ choices: PickerPlace[]; projectIds: string[] }> {
  const [list, mine] = await Promise.all([
    gatewayRequest("/v1/places", PlaceListSchema, token),
    gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/places`, ProjectPlacesSchema, token),
  ]);
  const choices = list.ok ? list.value.places.filter((p) => !p.archived).map((p) => ({ id: p.id, name: p.name, path: p.path, adminLevel: p.adminLevel, kind: p.kind })) : [];
  const projectIds = mine.ok ? [...new Set([...mine.value.forNewWork, ...mine.value.sites.map((s) => s.id)])] : [];
  return { choices, projectIds };
}

/** A record's places as the page reads them (its own, or its parent's marked inherited). */
export async function getRecordPlaces(projectId: string, kind: "ACTIVITY" | "EVIDENCE" | "BENEFICIARY", recordId: string, token: string) {
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/record-places/${kind}/${encodeURIComponent(recordId)}`, RecordPlacesSchema, token);
}
