"use server";

import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { PlaceListSchema, type PlaceItem } from "@/lib/server/schemas-places";
import { WorkPlanResponseSchema, type WorkPlanRow } from "@/lib/server/schemas";

/**
 * What a dashboard's map cards read, for the person looking at them and under their own access (the API applies it): the organisation's places,
 * and one project's planned activities with the project's country. Results by place use `getPlaceResultsAction`.
 */
export async function listPlacesForMapAction(): Promise<Result<PlaceItem[], AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest("/v1/places", PlaceListSchema, context.token);
  return r.ok ? { ok: true, value: r.value.places } : r;
}

const CountrySchema = z.object({ country: z.string().optional() }).passthrough();

export async function getActivityMapAction(projectId: string): Promise<Result<{ rows: WorkPlanRow[]; country?: string }, AppError>> {
  const context = await requireSession();
  const enc = encodeURIComponent(projectId);
  const [plan, project] = await Promise.all([
    gatewayRequest(`/v1/projects/${enc}/work-plan`, WorkPlanResponseSchema, context.token),
    gatewayRequest(`/v1/projects/${enc}`, CountrySchema, context.token),
  ]);
  if (!plan.ok) return plan;
  return { ok: true, value: { rows: plan.value.items, ...(project.ok && project.value.country ? { country: project.value.country } : {}) } };
}
