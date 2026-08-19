"use server";

import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { z } from "zod";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

const ParseFileResponseSchema = z.object({
  text: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type ParseFileResult = Result<{ text: string; metadata?: Record<string, unknown> }, AppError>;

/**
 * Parses an uploaded document through the API gateway (multipart), avoiding
 * the browser-facing same-origin `/api/v1/*` path which is not proxied to the
 * backend in dev and is prefix-mismatched behind the production OLS proxy.
 */
export async function parseFileAction(
  kind: "templates" | "logframe" | "indicators" | "activities" | "evidence",
  file: File,
): Promise<ParseFileResult> {
  const context = await requireSession();
  if (!file || file.size === 0) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please select a non-empty file.", fields: {} },
    };
  }
  const formData = new FormData();
  formData.set("file", file);
  return gatewayRequest(`/v1/${kind}/parse-file`, ParseFileResponseSchema, context.token, {
    method: "POST",
    formData,
  });
}
