"use server";

import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { FacilityTypesSchema, type FacilityTypes } from "@/lib/server/schemas-facility-types";

/** The organisation's facility types and the starting lists by sector (Phase 50.3b). */
export async function getFacilityTypesAction(): Promise<Result<FacilityTypes, AppError>> {
  const context = await requireSession();
  return gatewayRequest("/v1/organization/facility-types", FacilityTypesSchema, context.token);
}

/** Replaces the organisation's list (administrators only; the server checks the list). */
export async function saveFacilityTypesAction(types: Array<{ key: string; label: string; sector?: string }>): Promise<Result<{ types: Array<{ key: string; label: string }> }, AppError>> {
  const context = await requireSession();
  return gatewayRequest("/v1/organization/facility-types", z.object({ types: z.array(z.object({ key: z.string(), label: z.string() })) }), context.token, { method: "PUT", body: { types } });
}
