"use server";

import { CreateCanvasSchema, PreviewCanvasSchema, SaveCanvasSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { CanvasSchema, ConvertedCanvasSchema, ResolvedCanvasSchema, SavedCanvasSchema, type CanvasView, type ResolvedCanvas } from "@/lib/server/schemas-canvas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { z } from "zod";
import { OkResponseSchema } from "./_schemas";

const OkOrSubscriptionSchema = z.object({ canvasId: z.string(), every: z.string() });

const invalid = (message: string): Result<never, AppError> => ({ ok: false, error: { kind: "validation", message, fields: {} } });

/** Makes a canvas (blank, or from the pages of a template the page applied). */
export async function createCanvasAction(input: unknown): Promise<Result<CanvasView, AppError>> {
  const context = await requireSession();
  const parsed = CreateCanvasSchema.safeParse(input);
  if (!parsed.success) return invalid("Give it a name of 1 to 120 characters and choose who it is for.");
  return gatewayRequest("/v1/canvases", CanvasSchema, context.token, { method: "POST", body: parsed.data });
}

/** Saves the canvas as edited. `expectedRevision` is the version the edit started from: a save over someone else's change is refused. */
export async function saveCanvasAction(id: string, input: unknown) {
  const context = await requireSession();
  const parsed = SaveCanvasSchema.safeParse(input);
  if (!parsed.success) return invalid("Something in this canvas cannot be saved: " + (parsed.error.issues[0]?.message ?? "check its blocks."));
  return gatewayRequest(`/v1/canvases/${encodeURIComponent(id)}`, SavedCanvasSchema, context.token, { method: "PUT", body: parsed.data });
}

export async function deleteCanvasAction(id: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/canvases/${encodeURIComponent(id)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return r.ok ? { ok: true, value: undefined } : r;
}

export async function duplicateCanvasAction(id: string): Promise<Result<CanvasView, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/canvases/${encodeURIComponent(id)}/duplicate`, CanvasSchema, context.token, { method: "POST" });
}

/** Reads what the canvas shows now, for the signed-in person: used after a save and when the period filter changes. */
export async function resolveCanvasAction(id: string, filters: { periodId?: string; places?: string[]; group?: string; status?: string; level?: string; indicator?: string; donors?: string[]; partners?: string[] } = {}): Promise<Result<ResolvedCanvas, AppError>> {
  const context = await requireSession();
  const params = new URLSearchParams();
  if (filters.periodId) params.set("periodId", filters.periodId);
  if (filters.places?.length) params.set("places", filters.places.join(","));
  if (filters.group) params.set("group", filters.group);
  if (filters.status) params.set("status", filters.status);
  if (filters.level) params.set("level", filters.level);
  if (filters.indicator) params.set("indicator", filters.indicator);
  if (filters.donors?.length) params.set("donors", filters.donors.join(","));
  if (filters.partners?.length) params.set("partners", filters.partners.join(","));
  const query = params.size ? `?${params}` : "";
  return gatewayRequest(`/v1/canvases/${encodeURIComponent(id)}/resolve${query}`, ResolvedCanvasSchema, context.token);
}

/** Opens an older dashboard or infographic as a canvas (once; the original stays). */
export async function openAsCanvasAction(kind: "dashboard" | "infographic", sourceId: string) {
  const context = await requireSession();
  return gatewayRequest(`/v1/canvases/from-${kind}/${encodeURIComponent(sourceId)}`, ConvertedCanvasSchema, context.token, { method: "POST" });
}

/** What an edited, unsaved canvas would show: sent as the person edits so the page answers before a save. Nothing is stored. */
export async function previewCanvasAction(input: unknown): Promise<Result<ResolvedCanvas, AppError>> {
  const context = await requireSession();
  const parsed = PreviewCanvasSchema.safeParse(input);
  if (!parsed.success) return invalid("This canvas cannot be previewed yet: " + (parsed.error.issues[0]?.message ?? "check its blocks."));
  return gatewayRequest("/v1/canvases/preview", ResolvedCanvasSchema, context.token, { method: "POST", body: parsed.data });
}

/** Be told weekly or monthly that this canvas is ready to open, or stop being told. Only a title and a link are sent. */
export async function subscribeCanvasAction(id: string, every: "WEEKLY" | "MONTHLY" | "NONE"): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = every === "NONE"
    ? await gatewayRequest(`/v1/canvases/${encodeURIComponent(id)}/subscription`, OkResponseSchema, context.token, { method: "DELETE" })
    : await gatewayRequest(`/v1/canvases/${encodeURIComponent(id)}/subscription`, OkOrSubscriptionSchema, context.token, { method: "PUT", body: { every } });
  return result.ok ? { ok: true, value: undefined } : result;
}

/** Tells the others what this person is doing on the canvas (the block selected, whether editing). Nothing is stored. */
export async function updatePresenceAction(id: string, change: { blockId: string | null; editing: boolean }): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/canvases/${encodeURIComponent(id)}/presence`, OkResponseSchema, context.token, { method: "POST", body: change });
  return result.ok ? { ok: true, value: undefined } : result;
}
