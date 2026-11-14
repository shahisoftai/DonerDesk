"use server";

import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import {
  AddedVersionSchema, CheckResultSchema, DatasetDetailSchema, DatasetListSchema, KitDashboardsSchema, KitListSchema, LinkAddedSchema, LinkSuggestionsSchema, LinkSyncSchema, OkSchema, PullSchema,
  SavedDatasetSchema, UploadPreviewSchema,
} from "@/lib/server/schemas-datasets";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

/** Phase 54 datasets. Every function is an async server action (a "use server" file exports nothing else). */
const enc = encodeURIComponent;

export async function listDatasetsAction(projectId?: string) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets${projectId ? `?projectId=${enc(projectId)}` : ""}`, DatasetListSchema, c.token);
}
export async function listDatasetKitsAction() {
  const c = await requireSession();
  return gatewayRequest("/v1/dataset-kits", KitListSchema, c.token);
}
export async function getDatasetAction(id: string) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}`, DatasetDetailSchema, c.token);
}
export async function uploadDatasetFileAction(form: FormData) {
  const c = await requireSession();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: { kind: "validation", message: "Choose a file to upload.", fields: {} } } as Result<never, AppError>;
  const data = new FormData();
  data.set("file", file);
  return gatewayRequest("/v1/datasets/uploads", UploadPreviewSchema, c.token, { method: "POST", formData: data, timeoutMs: 120_000 });
}
export async function checkDatasetUploadAction(input: unknown) {
  const c = await requireSession();
  return gatewayRequest("/v1/datasets/uploads/check", CheckResultSchema, c.token, { method: "POST", body: input, timeoutMs: 120_000 });
}
export async function saveDatasetAction(input: unknown) {
  const c = await requireSession();
  return gatewayRequest("/v1/datasets", SavedDatasetSchema, c.token, { method: "POST", body: input, timeoutMs: 180_000 });
}
export async function addDatasetVersionAction(id: string, input: unknown) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}/versions`, AddedVersionSchema, c.token, { method: "POST", body: input, timeoutMs: 180_000 });
}
export async function decideDatasetVersionAction(id: string, versionId: string, accept: boolean, note?: string) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}/versions/${enc(versionId)}/decision`, OkSchema, c.token, { method: "POST", body: { accept, ...(note ? { note } : {}) } });
}
export async function restoreDatasetVersionAction(id: string, versionId: string) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}/versions/${enc(versionId)}/restore`, OkSchema, c.token, { method: "POST" });
}
export async function updateDatasetAction(id: string, input: unknown) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}`, OkSchema, c.token, { method: "PUT", body: input });
}
export async function deleteDatasetAction(id: string) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}`, OkSchema, c.token, { method: "DELETE" });
}
export async function setDatasetRestrictionAction(id: string, input: unknown) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}/restriction`, OkSchema, c.token, { method: "PUT", body: input });
}
export async function makeKitDashboardsAction(id: string, input: { kitKey?: string; title?: string; pageKeys?: string[] } = {}) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}/kit-dashboards`, KitDashboardsSchema, c.token, { method: "POST", body: input, timeoutMs: 60_000 });
}
export async function datasetLinkSuggestionsAction(id: string) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}/link-suggestions`, LinkSuggestionsSchema, c.token);
}
export async function addDatasetLinkAction(id: string, input: unknown) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}/links`, LinkAddedSchema, c.token, { method: "POST", body: input, timeoutMs: 120_000 });
}
export async function removeDatasetLinkAction(id: string, linkId: string) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}/links/${enc(linkId)}`, OkSchema, c.token, { method: "DELETE" });
}
export async function syncDatasetLinksAction(id: string) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}/links/sync`, LinkSyncSchema, c.token, { method: "POST", timeoutMs: 120_000 });
}
export async function saveDatasetConnectorAction(id: string, input: unknown) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}/connector`, OkSchema, c.token, { method: "PUT", body: input });
}
export async function pullDatasetConnectorAction(id: string) {
  const c = await requireSession();
  return gatewayRequest(`/v1/datasets/${enc(id)}/connector/pull`, PullSchema, c.token, { method: "POST", timeoutMs: 180_000 });
}
