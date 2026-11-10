"use server";

import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { PopulationAnswerSchema, type PopulationAnswerDto } from "@/lib/server/schemas-map-context";

/** People living within rings around chosen points (Phase 49.7). The API reads the self-hosted population grid; nothing is stored. */
export async function populationWithinAction(projectId: string, rings: Array<{ lng: number; lat: number; km: number }>): Promise<Result<PopulationAnswerDto, AppError>> {
  const context = await requireSession();
  const body = z.object({ rings: z.array(z.object({ lng: z.number(), lat: z.number(), km: z.number() })).min(1).max(50) }).parse({ rings });
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/analysis/population`, PopulationAnswerSchema, context.token, { method: "POST", body });
}
