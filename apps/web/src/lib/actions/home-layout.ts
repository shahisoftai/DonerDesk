"use server";

import { SaveHomeLayoutSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { HomeLayoutSavedSchema } from "@/lib/server/schemas-home-layout";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";

/** Saves the signed-in person's arrangement of Home. `expectedUpdatedAt` is the version the edit started from (null when there was none). */
export async function saveHomeLayoutAction(input: unknown): Promise<Result<{ updatedAt: string }, AppError>> {
  const context = await requireSession();
  const parsed = SaveHomeLayoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "That arrangement cannot be saved.", fields: {} } };
  return gatewayRequest("/v1/home-layout", HomeLayoutSavedSchema, context.token, { method: "PUT", body: parsed.data });
}

/** Goes back to the default arrangement for this Home. */
export async function resetHomeLayoutAction(variant: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/home-layout?variant=${encodeURIComponent(variant)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return r.ok ? { ok: true, value: undefined } : r;
}
