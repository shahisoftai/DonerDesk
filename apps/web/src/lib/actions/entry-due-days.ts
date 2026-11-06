"use server";

import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

const DaysSchema = z.object({ days: z.number() });

/** Days after a period ends that this project's indicator values are due (5 until it is changed). */
export async function getEntryDueDaysAction(projectId: string): Promise<Result<{ days: number }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/entry-due-days`, DaysSchema, context.token);
}

/** Changes it. The server checks the range (0 to 60) and that the person may edit the project. */
export async function setEntryDueDaysAction(projectId: string, days: number): Promise<Result<{ days: number }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/entry-due-days`, DaysSchema, context.token, { method: "PUT", body: { days } });
}
