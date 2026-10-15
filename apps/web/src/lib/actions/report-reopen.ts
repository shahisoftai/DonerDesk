"use server";

import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

const REASON_MAX = 1000;

/** Opens an approved, exported or submitted report for changes (approvers only; the API enforces it). The reason is audited. */
export async function reopenReportAction(draftId: string, reason: string): Promise<Result<{ status: string }, AppError>> {
  const context = await requireSession();
  const trimmed = reason.trim();
  if (trimmed.length < 5) return { ok: false, error: { kind: "validation", message: "Say why the report is being reopened (a few words).", fields: { reason: ["Required"] } } };
  if (trimmed.length > REASON_MAX) return { ok: false, error: { kind: "validation", message: `Keep the reason under ${REASON_MAX} characters.`, fields: { reason: ["Too long"] } } };
  return gatewayRequest(`/v1/report-drafts/${encodeURIComponent(draftId)}/reopen`, z.object({ status: z.string() }), context.token, { method: "POST", body: { reason: trimmed } });
}
