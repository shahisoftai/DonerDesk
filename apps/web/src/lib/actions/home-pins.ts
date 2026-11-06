"use server";

import { AddHomePinSchema, MoveHomePinSchema } from "@donordesk/contracts";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import { HomePinListSchema, type HomePinView } from "@/lib/server/schemas-home-pins";
import { TeamResponseSchema } from "@/lib/server/schemas";

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

const FeaturedSchema = z.object({ featured: z.boolean(), audiences: z.array(z.string()).default([]), canChange: z.boolean() });
/** Whether a dashboard is shown on other people's Home, to whom (for those who may change it), and whether this person may change that. */
export async function getDashboardFeaturedAction(dashboardId: string): Promise<Result<z.infer<typeof FeaturedSchema>, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/dashboards/${encodeURIComponent(dashboardId)}/featured`, FeaturedSchema, context.token);
}

/** `["*"]` is everyone, a list of person ids is those people, an empty list stops showing it. */
export async function setDashboardFeaturedAction(dashboardId: string, audiences: string[]): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/dashboards/${encodeURIComponent(dashboardId)}/featured`, OkResponseSchema, context.token, { method: "PUT", body: { audiences } });
  return r.ok ? { ok: true, value: undefined } : r;
}

/** The people an administrator can choose from: active members of the organisation (not outside partners). */
export async function listPeopleForSharingAction(): Promise<Result<Array<{ id: string; name: string; email: string }>, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest("/v1/users", TeamResponseSchema, context.token);
  return r.ok ? { ok: true, value: r.value.items.filter((u) => !u.external && u.status === "ACTIVE").map((u) => ({ id: u.id, name: u.name, email: u.email })) } : r;
}
