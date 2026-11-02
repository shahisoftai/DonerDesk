"use server";

import { SetupPackSchema } from "@donordesk/contracts";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

const Ok = z.object({ ok: z.literal(true) });

/** Saves the organisation's pack for a sector. The server checks it and answers in plain words when it refuses. */
export async function savePackAction(input: unknown): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const parsed = SetupPackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) } };
  const r = await gatewayRequest("/v1/organization/setup-packs", Ok, context.token, { method: "PUT", body: parsed.data });
  return r.ok ? { ok: true, value: undefined } : r;
}

/** Removes the organisation's own pack for a sector, so the built-in one applies again. */
export async function removePackAction(sectorKey: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/organization/setup-packs/${encodeURIComponent(sectorKey)}`, Ok, context.token, { method: "DELETE" });
  return r.ok ? { ok: true, value: undefined } : r;
}
