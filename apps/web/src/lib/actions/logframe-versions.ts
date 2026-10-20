"use server";

import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

/** Signs the framework off as the agreed one (what the donor approved). Records the current version if it changed since the last. */
export async function approveLogframeVersionAction(projectId: string): Promise<Result<{ version: number }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/logframe/versions/approve`, z.object({ version: z.number() }), context.token, { method: "POST", body: {} });
}
