"use server";

import { AddMapOverlaySchema } from "@donordesk/contracts";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import { MapOverlayItemSchema, MapOverlayListSchema, type MapOverlayItem } from "@/lib/server/schemas-map-overlays";

/** The organisation's map overlays (Phase 35): context layers kept once and ticked per map. (A "use server" file exports only async functions: the schemas are in schemas-map-overlays.ts.) */

export async function listMapOverlaysAction(): Promise<Result<z.infer<typeof MapOverlayListSchema>, AppError>> {
  const context = await requireSession();
  return gatewayRequest("/v1/map-overlays", MapOverlayListSchema, context.token);
}

export async function addMapOverlayAction(input: unknown): Promise<Result<MapOverlayItem, AppError>> {
  const context = await requireSession();
  const parsed = AddMapOverlaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "Give the overlay a name and choose a file.", fields: {} } };
  return gatewayRequest("/v1/map-overlays", MapOverlayItemSchema, context.token, { method: "POST", body: parsed.data });
}

/** The stored GeoJSON as text (the gateway reads JSON; it is written back out unchanged). */
export async function readMapOverlayAction(id: string): Promise<Result<string, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/map-overlays/${encodeURIComponent(id)}/data`, z.unknown(), context.token);
  return r.ok ? { ok: true, value: JSON.stringify(r.value) } : r;
}

export async function removeMapOverlayAction(id: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/map-overlays/${encodeURIComponent(id)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return r.ok ? { ok: true, value: undefined } : r;
}
