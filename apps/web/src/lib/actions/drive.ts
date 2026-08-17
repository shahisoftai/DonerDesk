"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { LinkEvidenceSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { WorkspaceFilesResponseSchema } from "@/lib/server/schemas";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema, UploadResponseSchema } from "./_schemas";

const AuthUrlResponseSchema = z.object({ authUrl: z.string(), state: z.string() });
const CallbackResponseSchema = z.object({ ok: z.boolean(), storageProvider: z.string() });

export type GoogleDriveAuthUrlResult = Result<{ authUrl: string }, AppError>;

/** Phase 1: ask the API to build a Google consent URL and stash the CSRF state. */
export async function getGoogleDriveAuthUrlAction(): Promise<GoogleDriveAuthUrlResult> {
  const context = await requireSession();
  const result = await gatewayRequest("/v1/drive/auth-url", AuthUrlResponseSchema, context.token, {
    method: "POST",
    body: {},
  });
  if (!result.ok) return result;
  (await cookies()).set("dd_gdrive_state", result.value.state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax so the cookie survives the cross-site top-level redirect back from Google.
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return { ok: true, value: { authUrl: result.value.authUrl } };
}

export type GoogleDriveCallbackResult = Result<{ storageProvider: string }, AppError>;

/** Phase 2: exchange the OAuth code (called from the Google redirect route). */
export async function completeGoogleDriveAuthAction(code: string): Promise<GoogleDriveCallbackResult> {
  const context = await requireSession();
  const result = await gatewayRequest("/v1/drive/callback", CallbackResponseSchema, context.token, {
    method: "POST",
    body: { code },
  });
  if (!result.ok) return result;
  return { ok: true, value: { storageProvider: result.value.storageProvider } };
}

export type LinkDriveEvidenceResult = Result<{ id: string; fileUrl: string }, AppError>;

/** Link an existing Google Drive file as evidence (no byte copy). */
export async function linkDriveEvidenceAction(input: unknown): Promise<LinkDriveEvidenceResult> {
  const context = await requireSession();
  const parsed = LinkEvidenceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest("/v1/evidence/link-drive", UploadResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: result.value };
}

export type ListWorkspaceFilesResult = Result<import("@/lib/server/schemas").WorkspaceFilesResponse, AppError>;

/** Re-reads the current files in the project's workspace folders (Drive/local). */
export async function listWorkspaceFilesAction(
  projectId: string,
  folders: string[],
): Promise<ListWorkspaceFilesResult> {
  const context = await requireSession();
  const folderParam = encodeURIComponent(folders.join(","));
  return gatewayRequest(
    `/v1/projects/${projectId}/workspace/files?folders=${folderParam}`,
    WorkspaceFilesResponseSchema,
    context.token,
  );
}
