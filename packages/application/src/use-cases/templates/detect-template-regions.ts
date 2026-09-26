import type { Result } from "@donordesk/domain";
import { DomainError, DonorTemplateMapping, autoMapRegions, type TemplateRegion } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository, IDonorTemplateStructureParser } from "../../ports/templates.js";
import type { IDonorTemplateMappingRepository } from "../../ports/reporting.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";

/**
 * First step of the donor-template rendering flow: parse the template's
 * uploaded DOCX for structural regions (headings/tables), auto-map each to
 * a DonorDesk report section, and persist a new DRAFT mapping version. Never
 * calls the LLM and never mutates the donor template itself — purely a
 * deterministic detection + scoring pass, always safe to re-run (creates a
 * new version each time rather than overwriting).
 */
export class DetectTemplateRegionsHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly templates: IDonorTemplateRepository,
    private readonly mappings: IDonorTemplateMappingRepository,
    private readonly structureParser: IDonorTemplateStructureParser,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    input: { templateId: string; fileBuffer: Buffer; fileName: string },
  ): Promise<Result<{ mappingId: string; version: number; regions: TemplateRegion[]; autoMappedCount: number; unmappedCount: number; warnings: string[] }, DomainError>> {
    const template = await this.templates.findById(input.templateId, ctx.tenant.tenantId);
    if (!template.ok) return template;
    if (!template.value) return { ok: false, error: DomainError.notFound("DonorTemplate", input.templateId) };

    const { regions } = await this.structureParser.parseStructure({ buffer: input.fileBuffer, fileName: input.fileName });

    const existing = await this.mappings.findByTemplate(input.templateId, ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    const nextVersion = existing.value.reduce((max, m) => Math.max(max, m.version), 0) + 1;

    const { results, warnings } = autoMapRegions(regions, template.value.sections);
    const regionById = new Map(regions.map((r) => [r.id, r]));
    const mappedResults = results.filter((r) => r.templateSectionId !== undefined);

    let mapping: DonorTemplateMapping;
    try {
      mapping = DonorTemplateMapping.create({
        id: this.ids.generate(),
        tenantId: ctx.tenant.tenantId.toString(),
        templateId: input.templateId,
        version: nextVersion,
        regions: mappedResults.map((r) => ({
          regionId: r.regionId,
          templateSectionId: r.templateSectionId!,
          placeholderKey: placeholderKeyFor(r.regionId),
          mappedBy: "AUTO",
          status: "DRAFT",
        })),
        detectedRegions: regions,
      });
    } catch (error) {
      return { ok: false, error: DomainError.validation(error instanceof Error ? error.message : String(error)) };
    }

    const saved = await this.mappings.create(mapping);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "donor_template_mapping.detected",
      entityType: "donor_template_mapping",
      entityId: mapping.id,
      newValue: `templateId=${input.templateId};version=${nextVersion};regionsDetected=${regions.length};autoMapped=${mappedResults.length};warnings=${warnings.length}`,
    });

    return {
      ok: true,
      value: {
        mappingId: mapping.id,
        version: nextVersion,
        regions: regions.filter((r) => regionById.has(r.id)),
        autoMappedCount: mappedResults.length,
        unmappedCount: regions.length - mappedResults.length,
        warnings,
      },
    };
  }
}

/** Deterministic docxtpl placeholder key from a region id: `h-0003` -> `region_h_0003`. Jinja2-safe identifier. */
export function placeholderKeyFor(regionId: string): string {
  return `region_${regionId.replace(/[^a-zA-Z0-9]/g, "_")}`;
}
