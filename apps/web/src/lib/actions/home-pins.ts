"use server";

import { AddHomePinSchema, MoveHomePinSchema } from "@donordesk/contracts";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import { HomePinListSchema, type HomePinView } from "@/lib/server/schemas-home-pins";

/** The signed-in person's own pinned tiles (Phase 35.H4). */
export async function listHomePinsAction(): Promise<Result<HomePinView[], AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest("/v1/home-pins", HomePinListSchema, context.token);
  return r.ok ? { ok: true, value: r.value.pins } : r;
}

export async function pinDashboardAction(dashboardId: string): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = AddHomePinSchema.safeParse({ kind: "DASHBOARD", ref: dashboardId });
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "That cannot be pinned.", fields: {} } };
  return gatewayRequest("/v1/home-pins", z.object({ id: z.string() }), context.token, { method: "POST", body: parsed.data });
}

export async function removeHomePinAction(id: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/home-pins/${encodeURIComponent(id)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return r.ok ? { ok: true, value: undefined } : r;
}

export async function moveHomePinAction(id: string, to: number): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const parsed = MoveHomePinSchema.safeParse({ to });
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "That is not a place in the list.", fields: {} } };
  const r = await gatewayRequest(`/v1/home-pins/${encodeURIComponent(id)}/position`, OkResponseSchema, context.token, { method: "PUT", body: parsed.data });
  return r.ok ? { ok: true, value: undefined } : r;
}
