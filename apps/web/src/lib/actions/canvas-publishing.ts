"use server";

import { CanvasSnapshotsSchema, CreateCanvasShareSchema, DraftCanvasTextSchema, PublishCanvasSchema, ReviewCanvasSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import {
  CanvasExportSchema, CanvasShareLinkSchema, CanvasVersionDocSchema, CanvasVersionSchema, CreatedShareSchema, DraftTextSchema, ReviewResultSchema, SnapshotResultSchema,
  type CanvasExportView, type CanvasShareLinkView, type CanvasVersionView, type DraftTextView,
} from "@/lib/server/schemas-canvas";
import type { Canvas } from "@donordesk/domain/contexts/canvas/index.js";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import { z } from "zod";

const invalid = (message: string): Result<never, AppError> => ({ ok: false, error: { kind: "validation", message, fields: {} } });
const path = (id: string, rest = ""): string => `/v1/canvases/${encodeURIComponent(id)}${rest}`;

/** Keeps a copy of what the saved canvas says now. */
export async function publishCanvasAction(id: string, input: unknown): Promise<Result<CanvasExportView, AppError>> {
  const context = await requireSession();
  const parsed = PublishCanvasSchema.safeParse(input);
  if (!parsed.success) return invalid("Choose a format.");
  return gatewayRequest(path(id, "/publish"), CanvasExportSchema, context.token, { method: "POST", body: parsed.data });
}

export async function listCanvasExportsAction(id: string): Promise<Result<CanvasExportView[], AppError>> {
  const context = await requireSession();
  return gatewayRequest(path(id, "/exports"), z.array(CanvasExportSchema), context.token);
}

export async function listCanvasSharesAction(id: string): Promise<Result<CanvasShareLinkView[], AppError>> {
  const context = await requireSession();
  return gatewayRequest(path(id, "/shares"), z.array(CanvasShareLinkSchema), context.token);
}

/** The token comes back once; the page shows the link and cannot ask for it again. */
export async function createCanvasShareAction(id: string, input: unknown): Promise<Result<{ id: string; token: string; expiresAt: string }, AppError>> {
  const context = await requireSession();
  const parsed = CreateCanvasShareSchema.safeParse(input);
  if (!parsed.success) return invalid("Check the link's name and how long it lasts.");
  return gatewayRequest(path(id, "/shares"), CreatedShareSchema, context.token, { method: "POST", body: parsed.data });
}

export async function revokeCanvasShareAction(id: string, linkId: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(path(id, `/shares/${encodeURIComponent(linkId)}`), OkResponseSchema, context.token, { method: "DELETE" });
  return r.ok ? { ok: true, value: undefined } : r;
}

export async function reviewCanvasAction(id: string, input: unknown): Promise<Result<{ status: string; note?: string | undefined }, AppError>> {
  const context = await requireSession();
  const parsed = ReviewCanvasSchema.safeParse(input);
  if (!parsed.success) return invalid("Say what needs to change (500 characters at most).");
  return gatewayRequest(path(id, "/review"), ReviewResultSchema, context.token, { method: "POST", body: parsed.data });
}

export async function listCanvasVersionsAction(id: string): Promise<Result<CanvasVersionView[], AppError>> {
  const context = await requireSession();
  return gatewayRequest(path(id, "/versions"), z.array(CanvasVersionSchema), context.token);
}

export async function getCanvasVersionAction(id: string, revision: number): Promise<Result<{ revision: number; title: string; canvas: Canvas }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(path(id, `/versions/${revision}`), CanvasVersionDocSchema, context.token);
}

export async function setCanvasSnapshotsAction(id: string, input: unknown): Promise<Result<{ every: string }, AppError>> {
  const context = await requireSession();
  const parsed = CanvasSnapshotsSchema.safeParse(input);
  if (!parsed.success) return invalid("Choose how often.");
  return gatewayRequest(path(id, "/snapshots"), SnapshotResultSchema, context.token, { method: "PUT", body: parsed.data });
}

/** A proposal for an AI block's words. Nothing is saved; the person reads it and accepts it. */
export async function draftCanvasTextAction(input: unknown): Promise<Result<DraftTextView, AppError>> {
  const context = await requireSession();
  const parsed = DraftCanvasTextSchema.safeParse(input);
  if (!parsed.success) return invalid("Choose the project first.");
  return gatewayRequest("/v1/canvases/draft-text", DraftTextSchema, context.token, { method: "POST", body: parsed.data });
}
