import {
  DomainError,
  PORTFOLIO_PROJECT_ID,
  canApplyDesignAction,
  configFromTemplate,
  knownTemplates,
  provenanceFooter,
  templateById,
  validateConfig,
  type InfographicConfig,
  type Result,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IStorage } from "../../ports/infrastructure.js";
import {
  EXPORT_FILE,
  type IInfographicRenderer,
  type IInfographicRepository,
  type IInfographicUserTemplateRepository,
  type InfographicExportRecord,
  type InfographicRecord,
} from "../../ports/infographics.js";
import type { InfographicRenderService, RenderMapInput } from "./infographic-render.js";
import type { CreateInfographicInput, ExportInfographicInput, UpdateInfographicInput } from "@donordesk/contracts";
import type { InfographicExportFormat } from "../../ports/infographics.js";

const CONFIG_LIMIT = 200_000;

const parseConfig = (configJson: string): Result<InfographicConfig, DomainError> => {
  try {
    return { ok: true, value: JSON.parse(configJson) as InfographicConfig };
  } catch {
    return { ok: false, error: DomainError.validation("The saved design is not readable") };
  }
};

/** Creates a saved design: from a template's defaults, or from a client-supplied config (validated). */
export class CreateInfographicHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly repo: IInfographicRepository,
    private readonly audits: IAuditLogger,
    private readonly clock: IClock,
    private readonly userTemplates?: IInfographicUserTemplateRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: CreateInfographicInput & { userTemplateId?: string; parentId?: string }): Promise<Result<InfographicRecord & { config: InfographicConfig }, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    let supplied = input.config ? (JSON.parse(JSON.stringify(input.config)) as InfographicConfig) : undefined;
    if (input.userTemplateId && this.userTemplates) {
      const saved = await this.userTemplates.findById(input.userTemplateId, tenantId);
      if (!saved.ok) return saved;
      if (!saved.value) return { ok: false, error: DomainError.notFound("Template", input.userTemplateId) };
      supplied = JSON.parse(saved.value.configJson) as InfographicConfig;
      if (input.title?.trim()) supplied.title = input.title.trim();
    }
    const base: InfographicConfig | undefined = supplied ?? configFromTemplate(input.templateId, input.title);
    if (!base || base.templateId !== input.templateId) return { ok: false, error: DomainError.validation("Choose one of the offered templates") };
    if (input.title?.trim() && !supplied) base.title = input.title.trim();
    const validated = validateConfig(base, knownTemplates());
    if (!validated.ok) return validated;
    // A portfolio page belongs to the organization, a project page to its project: the two never mix.
    const portfolioPage = projectId === PORTFOLIO_PROJECT_ID;
    if (portfolioPage !== (validated.value.scope === "PORTFOLIO")) {
      return { ok: false, error: DomainError.validation(portfolioPage ? "Choose a portfolio template for a portfolio infographic" : "A portfolio template belongs on the portfolio page, not in a project") };
    }

    const now = this.clock.now();
    const record: InfographicRecord = {
      id: this.ids.generate(),
      tenantId: tenantId.toString(),
      projectId,
      title: validated.value.title ?? templateById(validated.value.templateId)?.label ?? "Infographic",
      templateId: validated.value.templateId,
      templateVersion: validated.value.templateVersion,
      configJson: JSON.stringify(validated.value),
      createdById: ctx.tenant.userId,
      updatedById: ctx.tenant.userId,
      createdAt: now,
      updatedAt: now,
      status: "DRAFT",
      selfApproved: false,
      ...(input.parentId ? { parentId: input.parentId } : {}),
    };
    if (record.configJson.length > CONFIG_LIMIT) return { ok: false, error: DomainError.validation("This design is too large to save") };
    const saved = await this.repo.create(record);
    if (!saved.ok) return saved;
    await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: "infographic.create", entityType: "Infographic", entityId: saved.value.id, projectId });
    return { ok: true, value: { ...saved.value, config: validated.value } };
  }
}

/** Replaces a design's title and composition. Published exports are never touched. */
export class UpdateInfographicHandler {
  constructor(private readonly repo: IInfographicRepository, private readonly audits: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, infographicId: string, input: UpdateInfographicInput): Promise<Result<InfographicRecord & { config: InfographicConfig }, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const existing = await this.repo.findById(infographicId, tenantId);
    if (!existing.ok) return existing;
    if (!existing.value) return { ok: false, error: DomainError.notFound("Infographic", infographicId) };
    const current = parseConfig(existing.value.configJson);
    if (!current.ok) return current;
    // The wire config is re-typed through JSON (the domain validator re-checks every field anyway).
    const merged: InfographicConfig = JSON.parse(
      JSON.stringify({ ...current.value, ...input.config, templateId: current.value.templateId, sections: input.config.sections }),
    );
    if (input.title?.trim()) merged.title = input.title.trim();
    const validated = validateConfig(merged, knownTemplates());
    if (!validated.ok) return validated;

    // An edit that changes what the design says returns an approved or in-review design to DRAFT: what was approved is no longer what is on screen.
    const newJson = JSON.stringify(validated.value);
    const changed = newJson !== JSON.stringify(current.value);
    const status = changed && canApplyDesignAction(existing.value.status, "EDIT") ? "DRAFT" : existing.value.status;
    const reset = changed && existing.value.status !== "DRAFT";
    const updated: InfographicRecord = {
      ...existing.value,
      title: validated.value.title ?? existing.value.title,
      configJson: newJson,
      updatedById: ctx.tenant.userId,
      updatedAt: this.clock.now(),
      status,
      ...(reset ? { selfApproved: false } : {}),
    };
    if (reset) {
      delete (updated as { approvedById?: string }).approvedById;
      delete (updated as { approvedAt?: Date }).approvedAt;
      delete (updated as { reviewRequestedById?: string }).reviewRequestedById;
      delete (updated as { reviewRequestedAt?: Date }).reviewRequestedAt;
    }
    const saved = await this.repo.update(updated);
    if (!saved.ok) return saved;
    await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: "infographic.update", entityType: "Infographic", entityId: infographicId, projectId: existing.value.projectId, ...(reset ? { systemNote: `returned to draft from ${existing.value.status}` } : {}) });
    return { ok: true, value: { ...saved.value, config: validated.value } };
  }
}

/** The project's saved designs, newest change first, with how many exports each has. */
export class ListProjectInfographicsHandler {
  constructor(private readonly repo: IInfographicRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<Array<InfographicRecord & { exportCount: number }>, DomainError>> {
    const designs = await this.repo.findByProject(projectId, ctx.tenant.tenantId);
    if (!designs.ok) return designs;
    const out: Array<InfographicRecord & { exportCount: number }> = [];
    for (const design of designs.value) {
      const exports = await this.repo.findExportsByInfographic(design.id, ctx.tenant.tenantId);
      if (!exports.ok) return exports;
      out.push({ ...design, exportCount: exports.value.length });
    }
    return { ok: true, value: out };
  }
}

/** One saved design. */
export class GetInfographicHandler {
  constructor(private readonly repo: IInfographicRepository) {}

  async handle(ctx: AuthenticatedContext, infographicId: string): Promise<Result<InfographicRecord & { config: InfographicConfig }, DomainError>> {
    const found = await this.repo.findById(infographicId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Infographic", infographicId) };
    const config = parseConfig(found.value.configJson);
    if (!config.ok) return config;
    return { ok: true, value: { ...found.value, config: config.value } };
  }
}

/**
 * Deleting a design that has published exports needs an explicit confirm (the caller passes
 * `confirm: true` after the UI asked); deleting a draft is immediate. The design goes, the
 * published export rows and their files stay.
 */
export class DeleteInfographicHandler {
  constructor(private readonly repo: IInfographicRepository, private readonly audits: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, infographicId: string, opts?: { confirm?: boolean }): Promise<Result<{ deleted: true }, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const existing = await this.repo.findById(infographicId, tenantId);
    if (!existing.ok) return existing;
    if (!existing.value) return { ok: false, error: DomainError.notFound("Infographic", infographicId) };
    const exports = await this.repo.findExportsByInfographic(infographicId, tenantId);
    if (!exports.ok) return exports;
    if (exports.value.length > 0 && !opts?.confirm) {
      return { ok: false, error: DomainError.conflict(`This design has ${exports.value.length} published export${exports.value.length === 1 ? "" : "s"}. Confirm to delete the design; the published exports stay.`, { exportCount: exports.value.length }) };
    }
    const removed = await this.repo.remove(infographicId, tenantId);
    if (!removed.ok) return removed;
    await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: "infographic.delete", entityType: "Infographic", entityId: infographicId, projectId: existing.value.projectId, systemNote: `exports kept: ${exports.value.length}` });
    return { ok: true, value: { deleted: true } };
  }
}

/** What a published export keeps beside its file: the exact inputs used. */
export interface InfographicExportSnapshot {
  config: InfographicConfig;
  periodIds: string[];
  indicatorIds: string[];
  dataGeneratedAt: string;
  templateVersion: number;
}

/**
 * Renders the current design against current records and freezes it: the file goes to storage, the
 * row keeps the snapshot and provenance. Regenerating never alters a previous export.
 *
 * The Design check runs first. A blocker stops the publish unless the author waived it with a
 * reason (stored in the design, kept on the export and audited). A design meant for a donor
 * (profile DONOR_REPORT) must also be approved.
 */
export class ExportInfographicHandler {
  constructor(
    private readonly repo: IInfographicRepository,
    private readonly render: InfographicRenderService,
    private readonly renderer: IInfographicRenderer,
    private readonly storage: IStorage,
    private readonly ids: IIdGenerator,
    private readonly audits: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, infographicId: string, input: ExportInfographicInput): Promise<Result<InfographicExportRecord, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const found = await this.repo.findById(infographicId, tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Infographic", infographicId) };
    const config = parseConfig(found.value.configJson);
    if (!config.ok) return config;
    const validated = validateConfig(config.value, knownTemplates());
    if (!validated.ok) return validated;

    const built = await this.render.build(ctx, found.value.projectId, validated.value, { mapPoints: input.mapPoints ?? [], mapShapes: (input as RenderMapInput).mapShapes ?? [] });
    if (!built.ok) return built;
    const { check, provenance, altText, data } = built.value;

    if (!check.canPublish) {
      const first = check.blockers[0]!;
      return { ok: false, error: DomainError.conflict(`This design cannot be published yet: ${first.message} ${first.fix}`, { blockers: check.blockers.map((b) => ({ ruleId: b.ruleId, message: b.message, fix: b.fix })) }) };
    }
    const needsApproval = validated.value.profile === "DONOR_REPORT";
    if (needsApproval && found.value.status !== "APPROVED") {
      return { ok: false, error: DomainError.conflict("A design for a donor must be approved before it is published. Ask a reviewer to approve it.", { status: found.value.status }) };
    }

    const rendered = await this.renderFormat(input.format, built.value.input, { title: validated.value.title ?? found.value.title, altText, provenance, language: validated.value.language, scale: input.scale });
    if (!rendered.ok) return rendered;

    const file = EXPORT_FILE[input.format];
    const exportId = this.ids.generate();
    const storageKey = `infographics/${tenantId.toString()}/${infographicId}/${exportId}.${file.extension}`;
    await this.storage.put({ key: storageKey, body: rendered.value.bytes, contentType: file.contentType });

    const snapshot: InfographicExportSnapshot = {
      config: validated.value,
      periodIds: built.value.periodIds,
      indicatorIds: built.value.indicatorIds,
      dataGeneratedAt: data.provenance.generatedAt,
      templateVersion: validated.value.templateVersion,
    };
    const waived = check.findings.filter((f) => f.waived).map((f) => ({ ruleId: f.ruleId, note: validated.value.waivers?.find((w) => w.ruleId === f.ruleId)?.note ?? "" }));
    const record: InfographicExportRecord = {
      id: exportId,
      tenantId: tenantId.toString(),
      infographicId,
      projectId: found.value.projectId,
      format: input.format,
      storageKey,
      sizeBytes: rendered.value.bytes.length,
      snapshotJson: JSON.stringify(snapshot),
      provenanceJson: JSON.stringify(provenance),
      generatedById: ctx.tenant.userId,
      createdAt: this.clock.now(),
      pageCount: rendered.value.pages,
      approved: found.value.status === "APPROVED",
      altText,
      ...(waived.length > 0 ? { waivedJson: JSON.stringify(waived) } : {}),
    };
    const saved = await this.repo.addExport(record);
    if (!saved.ok) return saved;
    await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: "infographic.export", entityType: "InfographicExport", entityId: exportId, projectId: found.value.projectId, newValue: JSON.stringify({ format: input.format, footer: provenanceFooter(provenance, validated.value.language) }) });
    for (const w of waived) await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: "infographic.waive", entityType: "InfographicExport", entityId: exportId, projectId: found.value.projectId, newValue: JSON.stringify(w) });
    return { ok: true, value: saved.value };
  }

  private async renderFormat(
    format: InfographicExportFormat,
    renderInput: import("../../ports/infographics.js").InfographicRenderInput,
    meta: { title: string; altText: string; provenance: import("@donordesk/domain").InfographicProvenance; language?: string; scale?: number },
  ): Promise<Result<{ bytes: Buffer; pages: number }, DomainError>> {
    const scale = meta.scale === 1 || meta.scale === 3 ? meta.scale : 2;
    const sourcesNote = provenanceFooter(meta.provenance, meta.language);
    switch (format) {
      case "PNG": {
        const png = await this.renderer.renderPng(renderInput, scale);
        if (!png.ok) return png;
        const pages = await this.renderer.renderSvgPages(renderInput);
        return { ok: true, value: { bytes: png.value, pages: pages.ok ? pages.value.length : 1 } };
      }
      case "PDF": {
        const pdf = await this.renderer.renderPdf(renderInput, { altText: meta.altText });
        if (!pdf.ok) return pdf;
        const pages = await this.renderer.renderSvgPages(renderInput);
        return { ok: true, value: { bytes: pdf.value, pages: pages.ok ? pages.value.length : 1 } };
      }
      case "SVG": {
        const pages = await this.renderer.renderSvgPages(renderInput);
        if (!pages.ok) return pages;
        return { ok: true, value: { bytes: Buffer.from(pages.value[0]!.svg, "utf8"), pages: pages.value.length } };
      }
      case "PPTX": {
        const pptx = await this.renderer.renderPptx(renderInput, { title: meta.title, altText: meta.altText, sourcesNote });
        if (!pptx.ok) return pptx;
        const pages = await this.renderer.renderSvgPages(renderInput);
        return { ok: true, value: { bytes: pptx.value, pages: pages.ok ? pages.value.length : 1 } };
      }
      case "PACK": {
        const pack = await this.renderer.renderPack(renderInput, { title: meta.title, altText: meta.altText, caption: `${meta.title}. ${meta.altText}`.slice(0, 500), sourcesNote });
        if (!pack.ok) return pack;
        const pages = await this.renderer.renderSvgPages(renderInput);
        return { ok: true, value: { bytes: pack.value, pages: pages.ok ? pages.value.length : 1 } };
      }
    }
  }
}

/** The saved exports of one design, newest first. */
export class ListInfographicExportsHandler {
  constructor(private readonly repo: IInfographicRepository) {}

  async handle(ctx: AuthenticatedContext, infographicId: string): Promise<Result<InfographicExportRecord[], DomainError>> {
    return this.repo.findExportsByInfographic(infographicId, ctx.tenant.tenantId);
  }
}

/** Reads a published export's bytes back (the file route streams it). */
export class GetInfographicExportFileHandler {
  constructor(private readonly repo: IInfographicRepository, private readonly storage: IStorage) {}

  async handle(ctx: AuthenticatedContext, infographicId: string, exportId: string): Promise<Result<{ bytes: Buffer; contentType: string; format: string }, DomainError>> {
    const found = await this.repo.findExportById(exportId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value || found.value.infographicId !== infographicId) return { ok: false, error: DomainError.notFound("Infographic export", exportId) };
    const bytes = await this.storage.read(found.value.storageKey);
    const file = EXPORT_FILE[found.value.format] ?? EXPORT_FILE.PNG;
    return { ok: true, value: { bytes, contentType: file.contentType, format: found.value.format } };
  }
}

