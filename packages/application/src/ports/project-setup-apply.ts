/**
 * The narrow handler shapes the setup appliers delegate to (Phase 36.3, interface segregation): each applier sees only the
 * one call it makes, never the container. The existing handlers satisfy these structurally.
 */
import type { DomainError, Result } from "@donordesk/domain";
import type { CreateProjectInput, CreateRiskInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../context.js";

type R<T> = Promise<Result<T, DomainError>>;

export interface SetupProjectCreator {
  handle(ctx: AuthenticatedContext, input: CreateProjectInput): R<{ id: string }>;
}
/** Sets how many days after a period ends its report is due, before the periods are made. */
export interface SetupDeadlineOffsetWriter {
  handle(ctx: AuthenticatedContext, projectId: string, days: number): R<{ days: number }>;
}
export interface SetupLogframeImporter {
  handle(ctx: AuthenticatedContext, input: { projectId: string; text: string; sourceName?: string }): R<{ created: number; skipped: number; warnings: string[] }>;
}
export interface SetupIndicatorImporter {
  handle(ctx: AuthenticatedContext, input: { projectId: string; text: string; sourceName?: string }): R<{ created: number; skipped: number; warnings: string[] }>;
}
export interface SetupPeriodCreator {
  handle(ctx: AuthenticatedContext, projectId: string, options?: { limit?: number }): R<{ created: unknown[]; failed: Array<{ error: string }> }>;
}
/** Whether the new project's folders are still being made; reporting periods cannot be created until they are. */
export interface SetupWorkspaceProbe {
  stillPreparing(ctx: AuthenticatedContext, projectId: string): Promise<boolean>;
}

export interface SetupWorkPlanImporter {
  handle(ctx: AuthenticatedContext, projectId: string, input: { apply: boolean; text: string; sourceName?: string }): R<{ created: number; skipped: number; warnings: string[]; problems: string[] }>;
}
export interface SetupPlaceImporter {
  handle(ctx: AuthenticatedContext, input: { text: string; apply: boolean }): R<{ create: unknown[]; skipped: unknown[]; problems: Array<{ row: number; message: string }>; applied: boolean }>;
}
export interface SetupRiskWriter {
  list(ctx: AuthenticatedContext, projectId: string): R<Array<{ title: string }>>;
  create(ctx: AuthenticatedContext, projectId: string, input: CreateRiskInput): R<{ id: string }>;
}
export interface SetupFundingWriter {
  sources(ctx: AuthenticatedContext): R<Array<{ id: string; name: string; archived?: boolean }>>;
  createSource(ctx: AuthenticatedContext, name: string): R<{ id: string }>;
  existing(ctx: AuthenticatedContext, projectId: string): R<Array<{ fundingSourceId: string; amountText: string; currency: string }>>;
  add(ctx: AuthenticatedContext, projectId: string, input: { fundingSourceId: string; date: string; amount: string; currency: string; note?: string }): R<{ id: string }>;
  /** The project's start day: an allocation the document states is dated there. */
  projectStart(ctx: AuthenticatedContext, projectId: string): R<string | null>;
}
