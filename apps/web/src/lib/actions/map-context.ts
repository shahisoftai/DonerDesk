"use server";

import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { MapContextSchema, type MapContextDto } from "@/lib/server/schemas-map-context";

/** Which context layers and imagery the organisation's maps offer (Phase 49.6). */
export async function getMapContextAction(): Promise<Result<MapContextDto, AppError>> {
  const context = await requireSession();
  return gatewayRequest("/v1/organization/map-context", MapContextSchema, context.token);
}

/** An administrator's change; the API checks it (known layers, a public https tile address) and audits it. */
export async function saveMapContextAction(input: { layers: string[]; imageryUrl: string | null; imageryCredit: string | null }): Promise<Result<MapContextDto, AppError>> {
  const context = await requireSession();
  return gatewayRequest("/v1/organization/map-context", MapContextSchema, context.token, { method: "PUT", body: input });
}
