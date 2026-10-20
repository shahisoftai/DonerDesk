"use server";

import { z } from "zod";
import { parseRequirementLines } from "@donordesk/domain/contexts/reporting/pack-authoring.js";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema, OkResponseSchema } from "./_schemas";

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const fail = (message: string, fields: Record<string, string[]> = {}): Result<never, AppError> => ({ ok: false, error: { kind: "validation", message, fields } });

/** Saves a requirement pack as a draft from the lines the person typed (see `parseRequirementLines`). */
export async function saveRequirementPackAction(input: { name: string; donor: string; mechanism: string; reportType: string; lines: string }): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const name = input.name.trim();
  const donorKey = slug(input.donor);
  const mechanismKey = slug(input.mechanism);
  if (!name) return fail("Give the pack a name.", { name: ["Required"] });
  if (donorKey.length < 4) return fail("Name the donor (at least four letters).", { donor: ["Required"] });
  if (!mechanismKey) return fail("Name the funding mechanism or template this applies to.", { mechanism: ["Required"] });
  const parsed = parseRequirementLines(input.lines, name);
  if (parsed.errors.length > 0) return fail(parsed.errors[0] as string, { lines: parsed.errors });
  if (parsed.requirements.length === 0) return fail("Add at least one requirement.", { lines: ["Add at least one requirement"] });
  return gatewayRequest("/v1/reporting-requirement-packs", IdResponseSchema, context.token, {
    method: "POST",
    body: { donorKey, mechanismKey, reportType: input.reportType, name, requirements: parsed.requirements },
  });
}

/** Makes a reviewed pack the one that governs production reports for its donor, mechanism and report type. */
export async function activateRequirementPackAction(id: string): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/reporting-requirement-packs/${encodeURIComponent(id)}/activate`, OkResponseSchema, context.token, { method: "POST", body: {} });
  return r.ok ? { ok: true, value: true } : r;
}
