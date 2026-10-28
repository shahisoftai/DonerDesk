"use server";

import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { ProjectsResponseSchema } from "@/lib/server/schemas";
import { FormFieldViewSchema } from "@/lib/server/schemas-collection";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { packFromServer, type OfflinePack } from "@/features/offline/domain/offline-pack";

const PackSchema = z.object({
  projectId: z.string(), generatedAt: z.string(),
  forms: z.array(z.object({ id: z.string(), name: z.string(), description: z.string().optional(), fields: z.array(FormFieldViewSchema) })),
  places: z.array(z.object({ id: z.string(), name: z.string(), path: z.string() })),
});

/** The projects whose forms the signed-in person can fill, for the "download for offline" list. */
export async function listFieldProjectsAction(): Promise<Result<{ userId: string; userName: string; projects: Array<{ id: string; name: string }> }, AppError>> {
  const context = await requireSession();
  const payload = decodeSessionPayload(context.token);
  const result = await gatewayRequest("/v1/projects", ProjectsResponseSchema, context.token);
  if (!result.ok) return result;
  return { ok: true, value: { userId: payload?.sub ?? "", userName: payload?.name ?? "", projects: result.value.items.map((p) => ({ id: p.id, name: p.title })) } };
}

/** Makes the pack for one project: its open forms and the places list. Nothing else leaves the server. */
export async function downloadOfflinePackAction(projectId: string, projectName: string): Promise<Result<OfflinePack, AppError>> {
  const context = await requireSession();
  const payload = decodeSessionPayload(context.token);
  if (!payload?.sub) return { ok: false, error: { kind: "unauthenticated", message: "Sign in again to download for offline." } };
  const result = await gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/offline-pack`, PackSchema, context.token);
  if (!result.ok) return result;
  return {
    ok: true,
    value: packFromServer({ userId: payload.sub, userName: payload.name ?? "", projectId, projectName, generatedAt: result.value.generatedAt, forms: result.value.forms as never, places: result.value.places }),
  };
}
