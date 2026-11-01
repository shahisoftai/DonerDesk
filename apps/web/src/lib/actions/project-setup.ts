"use server";

import { ApplySetupProposalSchema, EditSetupProposalSchema, SetSetupDocumentKindSchema, SetupAreaSelectionSchema, StartSetupTextSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import {
  SetupApplyResultSchema, SetupEditedSchema, SetupPassageSchema, SetupRereadSchema, type SetupPassage, SetupPreviewSchema, SetupProposalListSchema, SetupProposalViewSchema, SetupStartedSchema,
  type SetupApplyResult, type SetupPreview, type SetupProposalView,
} from "@/lib/server/schemas-project-setup";

const invalid = (error: { issues: unknown[] } & Parameters<typeof flattenZodFields>[0]) => ({
  ok: false as const,
  error: { kind: "validation" as const, message: "Please correct the highlighted fields.", fields: flattenZodFields(error) },
});

/** A document upload (multipart) or pasted text; the server reads it and proposes the setup. Nothing is created here. */
export async function startSetupAction(formData: FormData): Promise<Result<{ proposalId: string }, AppError>> {
  const context = await requireSession();
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 0) {
    const body = new FormData();
    for (const file of files) body.append("file", file, file.name);
    const r = await gatewayRequest("/v1/project-setup/proposals", SetupStartedSchema, context.token, { method: "POST", formData: body });
    return r.ok ? { ok: true, value: { proposalId: r.value.proposalId } } : r;
  }
  const parsed = StartSetupTextSchema.safeParse({ text: String(formData.get("text") ?? ""), fileName: "Project description (pasted text).txt" });
  if (!parsed.success) return invalid(parsed.error);
  const r = await gatewayRequest("/v1/project-setup/proposals", SetupStartedSchema, context.token, { method: "POST", body: parsed.data });
  return r.ok ? { ok: true, value: { proposalId: r.value.proposalId } } : r;
}

export async function listSetupProposalsAction() {
  const context = await requireSession();
  return gatewayRequest("/v1/project-setup/proposals", SetupProposalListSchema, context.token);
}

export async function getSetupProposalAction(id: string): Promise<Result<SetupProposalView, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/project-setup/proposals/${encodeURIComponent(id)}`, SetupProposalViewSchema, context.token);
}

/** One review decision on one item. `expectedUpdatedAt` is the version the person was looking at. */
export async function editSetupItemAction(id: string, input: unknown): Promise<Result<{ ok: true; updatedAt: string }, AppError>> {
  const context = await requireSession();
  const parsed = EditSetupProposalSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/project-setup/proposals/${encodeURIComponent(id)}`, SetupEditedSchema, context.token, { method: "PATCH", body: parsed.data });
}

export async function rerunSetupAreaAction(id: string, area: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/project-setup/proposals/${encodeURIComponent(id)}/areas/${encodeURIComponent(area)}/rerun`, OkResponseSchema, context.token, { method: "POST", body: {} });
  return result.ok ? { ok: true, value: undefined } : result;
}

/** What Apply would do. Saves nothing. */
export async function previewSetupApplyAction(id: string, areas?: string[]): Promise<Result<SetupPreview, AppError>> {
  const context = await requireSession();
  const parsed = SetupAreaSelectionSchema.safeParse({ areas });
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/project-setup/proposals/${encodeURIComponent(id)}/preview`, SetupPreviewSchema, context.token, { method: "POST", body: parsed.data });
}

/** Creates the project from the person's form, then the accepted areas. */
export async function applySetupProposalAction(id: string, input: unknown): Promise<Result<SetupApplyResult, AppError>> {
  const context = await requireSession();
  const parsed = ApplySetupProposalSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/project-setup/proposals/${encodeURIComponent(id)}/apply`, SetupApplyResultSchema, context.token, { method: "POST", body: parsed.data });
}

export async function discardSetupProposalAction(id: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/project-setup/proposals/${encodeURIComponent(id)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return result.ok ? { ok: true, value: undefined } : result;
}

/** A person says what a document is (null = the reading stands); every part is then read again. */
export async function setSetupDocumentKindAction(id: string, documentId: string, kind: string | null): Promise<Result<{ rereading: string[] }, AppError>> {
  const context = await requireSession();
  const parsed = SetSetupDocumentKindSchema.safeParse({ kind });
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/project-setup/proposals/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/kind`, SetupRereadSchema, context.token, { method: "PUT", body: parsed.data });
}

/** The passage a proposed item was read from, to show the quote in its place. */
export async function getSetupPassageAction(id: string, documentId: string, block: number): Promise<Result<SetupPassage, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/project-setup/proposals/${encodeURIComponent(id)}/passages/${encodeURIComponent(documentId)}/${block}`, SetupPassageSchema, context.token);
}
