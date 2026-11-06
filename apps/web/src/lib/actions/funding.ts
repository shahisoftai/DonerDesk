"use server";

import { SaveProgrammeSchema, SaveGrantSchema, PlaceProjectSchema } from "@donordesk/contracts";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema } from "./_schemas";

const invalid = (error: z.ZodError): Result<never, AppError> => ({ ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(error) } });

export async function saveProgrammeAction(input: unknown, id?: string): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = SaveProgrammeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(id ? `/v1/programmes/${encodeURIComponent(id)}` : "/v1/programmes", IdResponseSchema, context.token, { method: id ? "PUT" : "POST", body: parsed.data });
}

export async function saveGrantAction(input: unknown, id?: string): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = SaveGrantSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(id ? `/v1/grants/${encodeURIComponent(id)}` : "/v1/grants", IdResponseSchema, context.token, { method: id ? "PUT" : "POST", body: parsed.data });
}

export async function placeProjectAction(projectId: string, input: unknown): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const parsed = PlaceProjectSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const r = await gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/funding`, z.object({ programmeId: z.string().nullable(), grantId: z.string().nullable() }), context.token, { method: "PUT", body: parsed.data });
  return r.ok ? { ok: true, value: true } : r;
}
