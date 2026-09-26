import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateMappingRepository } from "../../ports/reporting.js";
import type { IDonorTemplateRenderer } from "../../ports/templates.js";
import type { IStorage } from "../../ports/infrastructure.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Approves a reviewed mapping: runs the worker's placeholder-insertion pass
 * ONCE against the original DOCX (produces the reusable "templated" file
 * every future export renders against — never reparsed per export), stores
 * the result, then freezes the mapping via the domain `approve()` gate
 * (which itself requires every mapped region to be REVIEWED).
 *
 * The original file bytes are supplied by the caller (same pattern as
 * `POST /v1/templates/parse-file`) rather than fetched from storage — there
 * is no generic byte-fetch port in this codebase today, and the frontend
 * already holds the file from the detect step in the same review session.
 */
export class ApproveTemplateMappingHandler {
  constructor(
    private readonly mappings: IDonorTemplateMappingRepository,
    private readonly renderer: IDonorTemplateRenderer,
    private readonly storage: IStorage,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    input: { mappingId: string; originalFileBuffer: Buffer },
  ): Promise<Result<{ mappingId: string; templatedFileUrl: string }, DomainError>> {
    const found = await this.mappings.findById(input.mappingId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("DonorTemplateMapping", input.mappingId) };
    const mapping = found.value;

    const regionById = new Map((mapping.detectedRegions as Array<{ id: string; kind: "HEADING" | "TABLE"; order: number }>).map((r) => [r.id, r]));
    const placeholderRegions = mapping.regionsList
      .map((r) => {
        const detected = regionById.get(r.regionId);
        if (!detected) return undefined;
        return { id: detected.id, kind: detected.kind, order: detected.order, placeholderKey: r.placeholderKey };
      })
      .filter((r): r is { id: string; kind: "HEADING" | "TABLE"; order: number; placeholderKey: string } => r !== undefined);

    const inserted = await this.renderer.insertPlaceholders({
      originalDocxBuffer: input.originalFileBuffer,
      regions: placeholderRegions,
    });
    if (!inserted.ok) return { ok: false, error: DomainError.validation(`Placeholder insertion failed: ${inserted.error.message}`) };

    const stored = await this.storage.put({
      key: `donor-template-mappings/${ctx.tenant.tenantId.toString()}/${mapping.id}/templated.docx`,
      body: inserted.value.templatedDocxBuffer,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    // `templatedFileUrl` stores the storage KEY (not a browser-facing URL) —
    // it is an internal handle re-read via `IStorage.read()` at export time,
    // never served directly.
    let approved;
    try {
      approved = mapping.withTemplatedFile(stored.key).approve(ctx.tenant.userId);
    } catch (error) {
      return { ok: false, error: DomainError.validation(error instanceof Error ? error.message : String(error)) };
    }

    const saved = await this.mappings.update(approved);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "donor_template_mapping.approved",
      entityType: "donor_template_mapping",
      entityId: mapping.id,
      newValue: `version=${mapping.version};regionsApproved=${mapping.regionsList.length}`,
    });

    return { ok: true, value: { mappingId: mapping.id, templatedFileUrl: stored.key } };
  }
}
