"use server";

import { SaveProgrammeSchema, SaveGrantSchema, PlaceProjectSchema } from "@donordesk/contracts";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema } from "./_schemas";
import { FundingResponseSchema } from "@/lib/server/schemas";

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

export type GrantChoice = { id: string; title: string; donorName: string; awardNumber?: string; amount?: string; currency?: string; startDate?: string; endDate?: string; status: string; programme?: string };

/** The organisation's grants, flat, for a picker. Empty when the person may not read them: the caller keeps its manual entry. */
export async function listGrantChoicesAction(): Promise<GrantChoice[]> {
  const context = await requireSession();
  const r = await gatewayRequest("/v1/funding", FundingResponseSchema, context.token);
  if (!r.ok) return [];
  return [
    ...r.value.programmes.flatMap((p) => p.grants.map((g) => ({ ...g, programme: p.name }))),
    ...r.value.looseGrants.map(({ projects: _p, totals: _t, ...g }) => g),
  ];
}
