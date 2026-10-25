import {
  DomainError,
  buildProvenance,
  configFromTemplate,
  knownTemplates,
  provenanceFooter,
  templateById,
  validateConfig,
  type InfographicConfig,
  type InfographicProvenance,
  type Result,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IStorage } from "../../ports/infrastructure.js";
import type {
  IInfographicRenderer,
  IInfographicRepository,
  IOrganizationBrandReader,
  InfographicExportRecord,
  InfographicRecord,
} from "../../ports/infographics.js";
import type { GetProjectInfographicDataHandler, ProjectInfographicDataDto } from "./infographic-data.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";
import type { CreateInfographicInput, ExportInfographicInput, UpdateInfographicInput } from "@donordesk/contracts";

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
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: CreateInfographicInput): Promise<Result<InfographicRecord & { config: InfographicConfig }, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const supplied = input.config ? (JSON.parse(JSON.stringify(input.config)) as InfographicConfig) : undefined;
    const base: InfographicConfig | undefined = supplied ?? configFromTemplate(input.templateId, input.title);
    if (!base || base.templateId !== input.templateId) return { ok: false, error: DomainError.validation("Choose one of the offered templates") };
    if (input.title?.trim() && !supplied) base.title = input.title.trim();
    const validated = validateConfig(base, knownTemplates());
    if (!validated.ok) return validated;

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

    const updated: InfographicRecord = {
      ...existing.value,
      title: validated.value.title ?? existing.value.title,
      configJson: JSON.stringify(validated.value),
      updatedById: ctx.tenant.userId,
      updatedAt: this.clock.now(),
    };
    const saved = await this.repo.update(updated);
    if (!saved.ok) return saved;
    await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: "infographic.update", entityType: "Infographic", entityId: infographicId, projectId: existing.value.projectId });
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
 */
export class ExportInfographicHandler {
  constructor(
    private readonly repo: IInfographicRepository,
    private readonly data: GetProjectInfographicDataHandler,
    private readonly sheet: GetProjectDataSheetHandler,
    private readonly renderer: IInfographicRenderer,
    private readonly storage: IStorage,
    private readonly brands: IOrganizationBrandReader,
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

    const [dataResult, sheetResult, brand] = [await this.data.handle(ctx, found.value.projectId), await this.sheet.handle(ctx, found.value.projectId), await this.brands.brandFor(tenantId)];
    if (!dataResult.ok) return dataResult;
    if (!sheetResult.ok) return sheetResult;
    if (!brand.ok) return brand;

    const visiblePeriods = visiblePeriodLabels(dataResult.value, validated.value);
    const indicatorIds = indicatorIdsOf(validated.value, dataResult.value);
    const provenance: InfographicProvenance = buildProvenance({
      generatedAt: this.clock.now().toISOString(),
      periodLabels: visiblePeriods,
      indicatorCodes: dataResult.value.indicators.filter((i) => indicatorIds.includes(i.id)).map((i) => i.code),
      unverifiedCount: unverifiedCountOf(validated.value, dataResult.value),
      notYetReportedCount: dataResult.value.indicators.filter((i) => i.location.kind === "PROJECT_WIDE" && !i.projectWideValue).length,
    });

    const renderInput = {
      configJson: JSON.stringify(validated.value),
      dataJson: JSON.stringify(dataResult.value),
      sheetJson: JSON.stringify(sheetResult.value),
      mapPointsJson: JSON.stringify(input.mapPoints ?? []),
      organizationName: brand.value.name,
      ...(brand.value.logoUrl ? { logoUrl: brand.value.logoUrl } : {}),
      provenanceJson: JSON.stringify(provenance),
    };

    const rendered = input.format === "PDF" ? await this.renderer.renderPdf(renderInput) : await this.renderer.renderPng(renderInput);
    if (!rendered.ok) return rendered;

    const exportId = this.ids.generate();
    const storageKey = `infographics/${tenantId.toString()}/${infographicId}/${exportId}.${input.format.toLowerCase()}`;
    await this.storage.put({ key: storageKey, body: rendered.value, contentType: input.format === "PDF" ? "application/pdf" : "image/png" });

    const snapshot: InfographicExportSnapshot = {
      config: validated.value,
      periodIds: periodIdsOf(validated.value, dataResult.value),
      indicatorIds,
      dataGeneratedAt: dataResult.value.provenance.generatedAt,
      templateVersion: validated.value.templateVersion,
    };
    const record: InfographicExportRecord = {
      id: exportId,
      tenantId: tenantId.toString(),
      infographicId,
      projectId: found.value.projectId,
      format: input.format,
      storageKey,
      sizeBytes: rendered.value.length,
      snapshotJson: JSON.stringify(snapshot),
      provenanceJson: JSON.stringify(provenance),
      generatedById: ctx.tenant.userId,
      createdAt: this.clock.now(),
    };
    const saved = await this.repo.addExport(record);
    if (!saved.ok) return saved;
    await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: "infographic.export", entityType: "InfographicExport", entityId: exportId, projectId: found.value.projectId, newValue: JSON.stringify({ format: input.format, footer: provenanceFooter(provenance) }) });
    return { ok: true, value: saved.value };
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
    return { ok: true, value: { bytes, contentType: found.value.format === "PDF" ? "application/pdf" : "image/png", format: found.value.format } };
  }
}

/** The periods a config's period range selects (the read model orders them; absent = all). */
function visiblePeriodLabels(data: ProjectInfographicDataDto, config: InfographicConfig): string[] {
  const fromIndex = config.periodFromId ? data.periodOrder.indexOf(config.periodFromId) : 0;
  const toIndex = config.periodToId ? data.periodOrder.indexOf(config.periodToId) : data.periodOrder.length - 1;
  if (fromIndex < 0 || toIndex < 0) return data.periods.map((p) => p.label);
  return data.periods.slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex) + 1).map((p) => p.label);
}

function periodIdsOf(config: InfographicConfig, data: ProjectInfographicDataDto): string[] {
  const fromIndex = config.periodFromId ? data.periodOrder.indexOf(config.periodFromId) : 0;
  const toIndex = config.periodToId ? data.periodOrder.indexOf(config.periodToId) : data.periodOrder.length - 1;
  if (fromIndex < 0 || toIndex < 0) return [...data.periodOrder];
  return data.periodOrder.slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex) + 1);
}

/** Indicators the design actually names in its visible sections. */
function indicatorIdsOf(config: InfographicConfig, data: ProjectInfographicDataDto): string[] {
  const named = new Set<string>();
  for (const section of config.sections) {
    if (section.hidden) continue;
    for (const id of section.indicatorIds ?? []) named.add(id);
    for (const id of section.chart?.indicatorIds ?? []) named.add(id);
  }
  return data.indicators.filter((indicator) => named.has(indicator.id)).map((indicator) => indicator.id);
}

/** Unverified plotted values: any visible section naming an indicator whose latest figures are unverified. */
function unverifiedCountOf(config: InfographicConfig, data: ProjectInfographicDataDto): number {
  let count = 0;
  for (const indicator of data.indicators) {
    if (indicator.location.kind === "PROJECT_WIDE") continue;
    for (const row of indicator.location.rows) {
      if (!config.locationKeys?.length || config.locationKeys.includes(row.key)) count += row.unverified;
    }
  }
  return count;
}
