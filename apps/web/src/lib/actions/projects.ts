"use server";

import { CreateProjectSchema } from "@donordesk/contracts";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema } from "./_schemas";

export type CreateProjectResult = Result<{ id: string }, AppError>;

export async function createProjectAction(input: unknown): Promise<CreateProjectResult> {
  const context = await requireSession();
  const parsed = CreateProjectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/projects", IdResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}
