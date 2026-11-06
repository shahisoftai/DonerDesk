"use server";

import { CreateCanvasSchema, SaveCanvasSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { CanvasSchema, ConvertedCanvasSchema, ResolvedCanvasSchema, SavedCanvasSchema, type CanvasView, type ResolvedCanvas } from "@/lib/server/schemas-canvas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";

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
export async function resolveCanvasAction(id: string, periodId?: string): Promise<Result<ResolvedCanvas, AppError>> {
  const context = await requireSession();
  const query = periodId ? `?periodId=${encodeURIComponent(periodId)}` : "";
  return gatewayRequest(`/v1/canvases/${encodeURIComponent(id)}/resolve${query}`, ResolvedCanvasSchema, context.token);
}

/** Opens an older dashboard or infographic as a canvas (once; the original stays). */
export async function openAsCanvasAction(kind: "dashboard" | "infographic", sourceId: string) {
  const context = await requireSession();
  return gatewayRequest(`/v1/canvases/from-${kind}/${encodeURIComponent(sourceId)}`, ConvertedCanvasSchema, context.token, { method: "POST" });
}
