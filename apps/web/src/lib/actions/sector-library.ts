"use server";

import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { SetupDraftViewSchema, type SetupDraftView } from "@/lib/server/schemas-project-setup-draft";
import {
  AdoptResultSchema, AdoptSkeletonResultSchema, ApplyUpdateResultSchema, BrowseLibraryResultSchema, HiddenSchema, LibraryUpdatesSchema, RecordedSchema, ReviewImportSchema,
  ReviewProgressSchema, ReviewSheetSchema, SectorPackViewSchema,
  type AdoptResult, type AdoptSkeletonResult, type BrowseLibraryResult,
} from "@/lib/server/schemas-sector-library";

export interface LibraryQueryInput {
  projectId?: string;
  sectors?: string[];
  text?: string;
  sources?: string[];
  levels?: string[];
  kinds?: string[];
  reviewedOnly?: boolean;
  recommendedOnly?: boolean;
  withStandard?: boolean;
  includeAdopted?: boolean;
  limit?: number;
}

function queryString(q: LibraryQueryInput): string {
  const p = new URLSearchParams();
  if (q.projectId) p.set("projectId", q.projectId);
  if (q.sectors?.length) p.set("sectors", q.sectors.join(","));
  if (q.text?.trim()) p.set("text", q.text.trim());
  if (q.sources?.length) p.set("sources", q.sources.join(","));
  if (q.levels?.length) p.set("levels", q.levels.join(","));
  if (q.kinds?.length) p.set("kinds", q.kinds.join(","));
  for (const [k, v] of [["reviewedOnly", q.reviewedOnly], ["recommendedOnly", q.recommendedOnly], ["withStandard", q.withStandard], ["includeAdopted", q.includeAdopted]] as const) if (v) p.set(k, "1");
  if (q.limit) p.set("limit", String(q.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function browseLibraryAction(query: LibraryQueryInput): Promise<Result<BrowseLibraryResult, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/sector-library${queryString(query)}`, BrowseLibraryResultSchema, context.token);
}

export async function sectorPackAction(sectorId: string) {
  const context = await requireSession();
  return gatewayRequest(`/v1/sector-library/sectors/${encodeURIComponent(sectorId)}/pack`, SectorPackViewSchema, context.token);
}

/** Copies chosen entries into a project as its own indicators. */
export async function adoptLibraryAction(input: { projectId: string; items: Array<{ libraryId: string; logframeItemId?: string }> }): Promise<Result<AdoptResult, AppError>> {
  const context = await requireSession();
  return gatewayRequest("/v1/sector-library/adopt", AdoptResultSchema, context.token, { method: "POST", body: input });
}

export async function adoptSkeletonAction(input: { projectId: string; sectorId: string; nodeKeys?: string[] }): Promise<Result<AdoptSkeletonResult, AppError>> {
  const context = await requireSession();
  return gatewayRequest("/v1/sector-library/adopt-logframe", AdoptSkeletonResultSchema, context.token, { method: "POST", body: input });
}

/** Chooses from the library while the project is still a draft in the wizard. */
export async function addLibraryToDraftAction(id: string, operation: { kind: "ADD_FROM_LIBRARY"; ids: string[]; logframeCode?: string | null } | { kind: "ADD_FROM_SKELETON"; sectorId: string; nodeKeys?: string[] }): Promise<Result<SetupDraftView, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/project-setup/drafts/${encodeURIComponent(id)}/library`, SetupDraftViewSchema, context.token, { method: "POST", body: operation });
}

export async function libraryUpdatesAction(projectId: string) {
  const context = await requireSession();
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/library-updates`, LibraryUpdatesSchema, context.token);
}

export async function applyLibraryUpdateAction(indicatorId: string, fields: string[]) {
  const context = await requireSession();
  return gatewayRequest(`/v1/indicators/${encodeURIComponent(indicatorId)}/library-update`, ApplyUpdateResultSchema, context.token, { method: "POST", body: { fields } });
}

export async function libraryReviewProgressAction() {
  const context = await requireSession();
  return gatewayRequest("/v1/sector-library/review/progress", ReviewProgressSchema, context.token);
}

export async function exportReviewSheetAction(sectors: string[]) {
  const context = await requireSession();
  return gatewayRequest(`/v1/sector-library/review/sheet${sectors.length ? `?sectors=${encodeURIComponent(sectors.join(","))}` : ""}`, ReviewSheetSchema, context.token);
}

export async function importReviewSheetAction(input: { text: string; reviewer: string; apply: boolean }) {
  const context = await requireSession();
  return gatewayRequest("/v1/sector-library/review/sheet", ReviewImportSchema, context.token, { method: "POST", body: input });
}

export async function recordReviewAction(input: { entryIds: string[]; status: "UNREVIEWED" | "IN_REVIEW" | "REVIEWED"; reviewer: string; note?: string }) {
  const context = await requireSession();
  return gatewayRequest("/v1/sector-library/review", RecordedSchema, context.token, { method: "POST", body: input });
}

export async function setLibraryEntryHiddenAction(entryId: string, hidden: boolean) {
  const context = await requireSession();
  return gatewayRequest(`/v1/sector-library/entries/${encodeURIComponent(entryId)}/hidden`, HiddenSchema, context.token, { method: "PUT", body: { hidden } });
}
