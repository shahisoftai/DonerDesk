/**
 * The Infographic Studio's use cases beyond create/update/export (Phase 32): the live preview and
 * Design check, uploaded images, the brand kit, saved layouts, review and approval, public share
 * links, variants and story suggestions. Each is small and goes through the same render service
 * the export uses, so the preview and the published file can never disagree.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  DomainError,
  PORTFOLIO_PROJECT_ID,
  INFOGRAPHIC_TEMPLATES,
  INFOGRAPHIC_TEMPLATE_ORDER,
  checkDesignApprover,
  isShareLinkLive,
  periodSheetLabel,
  knownTemplates,
  nextStatus,
  shareLinkExpiry,
  signOffRoles,
  suggestHeadlines,
  buildAiTextPrompt,
  groundAiText,
  redactForLlm,
  type AiTextProposal,
  suggestKeyMessages,
  suggestTemplates,
  templateById,
  validateBrandKit,
  validateConfig,
  type DesignAction,
  type DesignCheckResult,
  type InfographicConfig,
  type OrganizationBrandKit,
  type Result,
  type TenantId as TenantIdType,
  type Suggestion,
  type TemplateSuggestion,
} from "@donordesk/domain";
import type { InfographicReviewActionInput, PreviewInfographicInput, SaveInfographicTemplateInput, UploadInfographicAssetInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IStorage } from "../../ports/infrastructure.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IProjectMemberRepository } from "../../ports/project-members.js";
import type { IPersonNotifier } from "../../ports/reminders.js";
import type {
  IBrandKitRepository,
  IImageNormalizer,
  IInfographicAssetRepository,
  IInfographicRenderer,
  IInfographicRepository,
  IInfographicShareRepository,
  IInfographicUserTemplateRepository,
  InfographicAssetRecord,
  InfographicPage,
  InfographicRecord,
  InfographicShareLinkRecord,
  InfographicUserTemplateRecord,
} from "../../ports/infographics.js";
import type { ILLMProvider } from "../../ports/infrastructure.js";
import { assetIdsOf, storyFactsOf, type InfographicRenderService } from "./infographic-render.js";
import type { CreateInfographicHandler } from "./infographics.js";
import type { GetProjectInfographicDataHandler } from "./infographic-data.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";

const parse = (json: string): Result<InfographicConfig, DomainError> => {
  try {
    return { ok: true, value: JSON.parse(json) as InfographicConfig };
  } catch {
    return { ok: false, error: DomainError.validation("The saved design is not readable") };
  }
};

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

// ---------------------------------------------------------------- preview

export interface InfographicPreview {
  pages: InfographicPage[];
  check: DesignCheckResult;
  altText: string;
  footer: string;
}

/**
 * The live preview: the design (saved, or the unsaved draft the Studio sends) drawn by the same composer
 * that makes the export, as SVG pages, with the Design check beside it. Nothing is stored.
 */
export class PreviewInfographicHandler {
  constructor(
    private readonly repo: IInfographicRepository,
    private readonly render: InfographicRenderService,
    private readonly renderer: IInfographicRenderer,
  ) {}

  async handle(ctx: AuthenticatedContext, infographicId: string, input: PreviewInfographicInput): Promise<Result<InfographicPreview, DomainError>> {
    const found = await this.repo.findById(infographicId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Infographic", infographicId) };
    const saved = parse(found.value.configJson);
    if (!saved.ok) return saved;
    // An unsaved draft may change everything except which template family the design belongs to.
    const draft: InfographicConfig = input.config ? { ...(JSON.parse(JSON.stringify(input.config)) as InfographicConfig), templateId: saved.value.templateId, templateVersion: saved.value.templateVersion } : saved.value;
    const validated = validateConfig(draft, knownTemplates());
    if (!validated.ok) return validated;
    const built = await this.render.build(ctx, found.value.projectId, validated.value, { ...(input.mapPoints ? { mapPoints: input.mapPoints } : {}), ...(input.mapShapes ? { mapShapes: input.mapShapes } : {}), preview: true });
    if (!built.ok) return built;
    const pages = await this.renderer.renderSvgPages(built.value.input);
    if (!pages.ok) return pages;
    const { provenanceFooter } = await import("@donordesk/domain");
    return { ok: true, value: { pages: pages.value, check: built.value.check, altText: built.value.altText, footer: provenanceFooter(built.value.provenance, validated.value.language) } };
  }
}

// ---------------------------------------------------------------- suggestions

export interface InfographicSuggestions {
  headlines: Suggestion[];
  messages: Suggestion[];
  templates: Array<TemplateSuggestion & { label: string }>;
}

/** Headlines, key messages and starting templates drawn from the project's own records (never a model). */
export class GetInfographicSuggestionsHandler {
  constructor(private readonly data: GetProjectInfographicDataHandler, private readonly sheet: GetProjectDataSheetHandler) {}

  async handle(ctx: AuthenticatedContext, projectId: string, opts: { language?: string; rounding?: "NONE" | "HUNDREDS" | "THOUSANDS" } = {}): Promise<Result<InfographicSuggestions, DomainError>> {
    const [data, sheet] = [await this.data.handle(ctx, projectId), await this.sheet.handle(ctx, projectId)];
    if (!data.ok) return data;
    if (!sheet.ok) return sheet;
    const facts = storyFactsOf(data.value, sheet.value);
    return {
      ok: true,
      value: {
        headlines: suggestHeadlines(facts, opts.language, opts.rounding),
        messages: suggestKeyMessages(facts, opts.language, opts.rounding),
        templates: suggestTemplates(facts).map((s) => ({ ...s, label: templateById(s.templateId)?.label ?? s.templateId })),
      },
    };
  }
}

// ---------------------------------------------------------------- templates

export interface InfographicTemplateListing {
  builtIn: Array<{ id: string; label: string; description: string; family: string; scope: "PROJECT" | "PORTFOLIO"; format?: string; profile?: string; themeId?: string; sectionKinds: string[] }>;
  mine: Array<{ id: string; name: string; description?: string; baseTemplateId: string; createdAt: Date }>;
}

export class ListInfographicTemplatesHandler {
  constructor(private readonly userTemplates: IInfographicUserTemplateRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<InfographicTemplateListing, DomainError>> {
    const mine = await this.userTemplates.list(ctx.tenant.tenantId);
    if (!mine.ok) return mine;
    return {
      ok: true,
      value: {
        builtIn: INFOGRAPHIC_TEMPLATE_ORDER.map((id) => {
          const t = INFOGRAPHIC_TEMPLATES[id];
          return { id: t.id, label: t.label, description: t.description, family: t.family, scope: t.scope ?? "PROJECT", ...(t.format ? { format: t.format } : {}), ...(t.profile ? { profile: t.profile } : {}), ...(t.themeId ? { themeId: t.themeId } : {}), sectionKinds: t.sections.map((s) => s.kind) };
        }),
        mine: mine.value.map((t) => ({ id: t.id, name: t.name, ...(t.description ? { description: t.description } : {}), baseTemplateId: t.baseTemplateId, createdAt: t.createdAt })),
      },
    };
  }
}

/** Saves a design's layout as the organization's own template: its sections and settings, never its data or filters. */
export class SaveInfographicTemplateHandler {
  constructor(
    private readonly repo: IInfographicRepository,
    private readonly userTemplates: IInfographicUserTemplateRepository,
    private readonly ids: IIdGenerator,
    private readonly audits: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, input: SaveInfographicTemplateInput): Promise<Result<InfographicUserTemplateRecord, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const found = await this.repo.findById(input.infographicId, tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Infographic", input.infographicId) };
    const config = parse(found.value.configJson);
    if (!config.ok) return config;
    // A layout is portable: it carries no title, period range, location filter, waivers or uploaded images of this project.
    const portable: InfographicConfig = JSON.parse(JSON.stringify(config.value));
    delete portable.title;
    delete portable.periodFromId;
    delete portable.periodToId;
    delete portable.locationKeys;
    delete portable.waivers;
    delete portable.coverAssetId;
    delete portable.donorLogoAssetIds;
    portable.sections = portable.sections.map((section) => {
      const { assetId: _assetId, consentConfirmed: _consent, indicatorIds: _ind, locationKeys: _loc, ...rest } = section;
      void _assetId; void _consent; void _ind; void _loc;
      const out = { ...rest };
      if (out.chart) out.chart = { ...out.chart, indicatorIds: [] };
      return out;
    });
    const checked = validateConfig({ ...portable, sections: portable.sections.map((s) => (s.kind === "CHART" ? { ...s, chart: s.chart && { ...s.chart, indicatorIds: s.chart.indicatorIds } } : s)) }, knownTemplates());
    // A chart without its indicators does not validate on its own; a layout keeps the chart's shape and asks for the indicators when it is used.
    const config2 = checked.ok ? checked.value : portable;
    const now = this.clock.now();
    const record: InfographicUserTemplateRecord = {
      id: this.ids.generate(),
      tenantId: tenantId.toString(),
      name: input.name.trim(),
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      baseTemplateId: config.value.templateId,
      configJson: JSON.stringify(config2),
      createdById: ctx.tenant.userId,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await this.userTemplates.create(record);
    if (!saved.ok) return saved;
    await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: "infographic.template.save", entityType: "InfographicUserTemplate", entityId: record.id });
    return saved;
  }
}

export class DeleteInfographicTemplateHandler {
  constructor(private readonly userTemplates: IInfographicUserTemplateRepository, private readonly audits: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, templateId: string): Promise<Result<{ deleted: true }, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const found = await this.userTemplates.findById(templateId, tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Template", templateId) };
    const removed = await this.userTemplates.remove(templateId, tenantId);
    if (!removed.ok) return removed;
    await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: "infographic.template.delete", entityType: "InfographicUserTemplate", entityId: templateId });
    return { ok: true, value: { deleted: true } };
  }
}

// ---------------------------------------------------------------- assets

export const MAX_ASSET_BYTES = 6_000_000;

/** Uploads an image or logo: re-encoded (size bounded, metadata removed), stored, listed. Never taken from evidence. */
export class UploadInfographicAssetHandler {
  constructor(
    private readonly assets: IInfographicAssetRepository,
    private readonly images: IImageNormalizer,
    private readonly storage: IStorage,
    private readonly ids: IIdGenerator,
    private readonly audits: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, input: UploadInfographicAssetInput): Promise<Result<InfographicAssetRecord, DomainError>> {
    let bytes: Buffer;
    try {
      bytes = Buffer.from(input.dataBase64.replace(/^data:[^,]*,/, ""), "base64");
    } catch {
      return { ok: false, error: DomainError.validation("The image could not be read") };
    }
    if (bytes.length === 0 || bytes.length > MAX_ASSET_BYTES) return { ok: false, error: DomainError.validation("Choose a picture under 6 MB") };
    const normalized = await this.images.normalize(bytes, { maxEdge: input.kind === "LOGO" ? 800 : 2000 });
    if (!normalized.ok) return normalized;
    const id = this.ids.generate();
    const tenantId = ctx.tenant.tenantId;
    const ext = normalized.value.contentType === "image/png" ? "png" : "jpg";
    const storageKey = `infographic-assets/${tenantId.toString()}/${id}.${ext}`;
    await this.storage.put({ key: storageKey, body: normalized.value.bytes, contentType: normalized.value.contentType });
    const record: InfographicAssetRecord = {
      id,
      tenantId: tenantId.toString(),
      kind: input.kind,
      name: input.name.trim(),
      contentType: normalized.value.contentType,
      storageKey,
      width: normalized.value.width,
      height: normalized.value.height,
      sizeBytes: normalized.value.bytes.length,
      ...(input.credit?.trim() ? { credit: input.credit.trim() } : {}),
      createdById: ctx.tenant.userId,
      createdAt: this.clock.now(),
    };
    const saved = await this.assets.create(record);
    if (!saved.ok) return saved;
    await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: "infographic.asset.upload", entityType: "InfographicAsset", entityId: id, newValue: JSON.stringify({ kind: input.kind, name: record.name, sizeBytes: record.sizeBytes }) });
    return saved;
  }
}

export class ListInfographicAssetsHandler {
  constructor(private readonly assets: IInfographicAssetRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<InfographicAssetRecord[], DomainError>> {
    const rows = await this.assets.list(ctx.tenant.tenantId);
    return rows.ok ? { ok: true, value: rows.value.filter((r) => !r.archivedAt) } : rows;
  }
}

export class GetInfographicAssetFileHandler {
  constructor(private readonly assets: IInfographicAssetRepository, private readonly storage: IStorage) {}

  async handle(ctx: AuthenticatedContext, assetId: string): Promise<Result<{ bytes: Buffer; contentType: string }, DomainError>> {
    const found = await this.assets.findById(assetId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value || found.value.archivedAt) return { ok: false, error: DomainError.notFound("Image", assetId) };
    return { ok: true, value: { bytes: await this.storage.read(found.value.storageKey), contentType: found.value.contentType } };
  }
}

/** Removes an image from the library. A design that still uses it keeps working: it shows the image as missing and the Design check says so. */
export class RemoveInfographicAssetHandler {
  constructor(private readonly assets: IInfographicAssetRepository, private readonly audits: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, assetId: string): Promise<Result<{ removed: true }, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const found = await this.assets.findById(assetId, tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Image", assetId) };
    const archived = await this.assets.archive(assetId, tenantId, this.clock.now());
    if (!archived.ok) return archived;
    await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: "infographic.asset.remove", entityType: "InfographicAsset", entityId: assetId });
    return { ok: true, value: { removed: true } };
  }
}

// ---------------------------------------------------------------- brand kit

export class GetBrandKitHandler {
  constructor(private readonly kits: IBrandKitRepository) {}
  async handle(ctx: AuthenticatedContext): Promise<Result<OrganizationBrandKit | null, DomainError>> {
    return this.kits.get(ctx.tenant.tenantId);
  }
}

export class SaveBrandKitHandler {
  constructor(private readonly kits: IBrandKitRepository, private readonly assets: IInfographicAssetRepository, private readonly ids: IIdGenerator, private readonly audits: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: OrganizationBrandKit): Promise<Result<OrganizationBrandKit, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const validated = validateBrandKit(input);
    if (!validated.ok) return validated;
    const named = [...(validated.value.logoAssetId ? [validated.value.logoAssetId] : []), ...(validated.value.partnerLogoAssetIds ?? [])];
    if (named.length > 0) {
      const found = await this.assets.findByIds(named, tenantId);
      if (!found.ok) return found;
      if (found.value.filter((a) => !a.archivedAt).length !== new Set(named).size) return { ok: false, error: DomainError.validation("A logo you chose is no longer in the library") };
    }
    const saved = await this.kits.save(tenantId, validated.value, ctx.tenant.userId, this.ids.generate());
    if (!saved.ok) return saved;
    await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: "infographic.brand.save", entityType: "InfographicBrandKit", entityId: tenantId.toString() });
    return { ok: true, value: validated.value };
  }
}

// ---------------------------------------------------------------- review and approval

/** Tells the right people when a design changes hands (never fails the change; nobody is told about their own action). */
export class InfographicNotifier {
  constructor(
    private readonly notify: IPersonNotifier,
    private readonly projects: IProjectRepository,
    private readonly members: IProjectMemberRepository,
    private readonly users?: { listByTenant(tenantId: TenantIdType): Promise<Result<Array<{ id: { toString(): string }; role: string; status: string }>>> },
  ) {}

  async approvers(ctx: AuthenticatedContext, projectId: string): Promise<string[]> {
    // A portfolio page belongs to the organization: its approvers are the organization's administrators.
    if (projectId === PORTFOLIO_PROJECT_ID) {
      const all = this.users ? await this.users.listByTenant(ctx.tenant.tenantId) : undefined;
      return all && all.ok ? all.value.filter((u) => u.role === "ADMIN" && u.status === "ACTIVE").map((u) => u.id.toString()) : [];
    }
    const [project, members] = [await this.projects.findById(projectId, ctx.tenant.tenantId), await this.members.findByProject(projectId, ctx.tenant.tenantId)];
    if (!project.ok || !members.ok || !project.value) return [];
    return signOffRoles({
      projectManagerId: project.value.projectManagerId,
      meOfficerId: project.value.meOfficerId,
      reportingOfficerId: project.value.reportingOfficerId,
      members: members.value.map((m) => ({ userId: m.userId, role: m.role, status: m.status })),
    }).approverIds;
  }

  async tell(ctx: AuthenticatedContext, recipients: string[], title: string, message: string, infographicId: string): Promise<void> {
    for (const recipientId of [...new Set(recipients)].filter((id) => id && id !== ctx.tenant.userId)) {
      try {
        await this.notify.send({ tenantId: ctx.tenant.tenantId, recipientId, type: "ASSIGNMENT", urgent: false, title, message, relatedEntityType: "infographic", relatedEntityId: infographicId });
      } catch {
        // Telling someone never fails the change that caused it.
      }
    }
  }
}

/** Request a review, approve or send back. One table decides which moves exist; the approver may not be the person who asked unless nobody else can approve. */
export class InfographicReviewHandler {
  constructor(private readonly repo: IInfographicRepository, private readonly notifier: InfographicNotifier, private readonly audits: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, infographicId: string, input: InfographicReviewActionInput): Promise<Result<InfographicRecord, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const found = await this.repo.findById(infographicId, tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Infographic", infographicId) };
    const design = found.value;
    const action: DesignAction = input.action;
    const next = nextStatus(design.status, action);
    if (!next) return { ok: false, error: DomainError.conflict(`A design that is ${design.status === "IN_REVIEW" ? "in review" : design.status.toLowerCase()} cannot be ${action === "REQUEST_REVIEW" ? "sent for review" : action === "APPROVE" ? "approved" : "sent back"}.`, { status: design.status }) };
    const now = this.clock.now();
    const approvers = await this.notifier.approvers(ctx, design.projectId);
    const updated: InfographicRecord = { ...design, status: next, updatedAt: now };
    let event = "infographic.review";
    if (action === "REQUEST_REVIEW") {
      updated.reviewRequestedById = ctx.tenant.userId;
      updated.reviewRequestedAt = now;
      event = "infographic.review.request";
    } else if (action === "APPROVE") {
      const rule = checkDesignApprover({ approverId: ctx.tenant.userId, ...(design.reviewRequestedById ? { requestedById: design.reviewRequestedById } : {}), otherApproversExist: approvers.some((id) => id !== ctx.tenant.userId) });
      if (!rule.allowed) return { ok: false, error: DomainError.conflict(rule.reason ?? "Another person must approve this design.") };
      updated.approvedById = ctx.tenant.userId;
      updated.approvedAt = now;
      updated.selfApproved = rule.self;
      event = rule.self ? "infographic.approve.self" : "infographic.approve";
    } else {
      delete updated.approvedById;
      delete updated.approvedAt;
      updated.selfApproved = false;
      event = "infographic.review.return";
    }
    const saved = await this.repo.update(updated);
    if (!saved.ok) return saved;
    await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: event, entityType: "Infographic", entityId: infographicId, projectId: design.projectId, ...(input.note ? { systemNote: input.note } : {}) });
    if (action === "REQUEST_REVIEW") await this.notifier.tell(ctx, approvers, "An infographic is waiting for your review", `“${design.title}” has been sent for review. Open it to approve it or send it back.`, infographicId);
    else await this.notifier.tell(ctx, [design.createdById, ...(design.reviewRequestedById ? [design.reviewRequestedById] : [])], action === "APPROVE" ? "Your infographic was approved" : "Your infographic was sent back", `“${design.title}”${input.note ? `: ${input.note}` : ""}`, infographicId);
    return saved;
  }
}

// ---------------------------------------------------------------- share links

export interface CreatedShareLink {
  link: InfographicShareLinkRecord;
  /** Shown once; only its hash is stored. */
  token: string;
}

export class CreateInfographicShareLinkHandler {
  constructor(private readonly repo: IInfographicRepository, private readonly shares: IInfographicShareRepository, private readonly ids: IIdGenerator, private readonly audits: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, infographicId: string, input: { exportId: string; days?: number }): Promise<Result<CreatedShareLink, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const exportRow = await this.repo.findExportById(input.exportId, tenantId);
    if (!exportRow.ok) return exportRow;
    if (!exportRow.value || exportRow.value.infographicId !== infographicId) return { ok: false, error: DomainError.notFound("Infographic export", input.exportId) };
    const now = this.clock.now();
    const token = randomBytes(32).toString("base64url");
    const record: InfographicShareLinkRecord = {
      id: this.ids.generate(),
      tenantId: tenantId.toString(),
      infographicId,
      exportId: input.exportId,
      tokenHash: sha256(token),
      expiresAt: shareLinkExpiry(now, input.days),
      viewCount: 0,
      createdById: ctx.tenant.userId,
      createdAt: now,
    };
    const saved = await this.shares.create(record);
    if (!saved.ok) return saved;
    await this.audits.record({ tenantId, actorId: ctx.tenant.userId, eventType: "infographic.share.create", entityType: "InfographicShareLink", entityId: record.id, projectId: exportRow.value.projectId, newValue: JSON.stringify({ exportId: input.exportId, expiresAt: record.expiresAt.toISOString() }) });
    return { ok: true, value: { link: saved.value, token } };
  }
}

export class ListInfographicShareLinksHandler {
  constructor(private readonly shares: IInfographicShareRepository) {}
  async handle(ctx: AuthenticatedContext, infographicId: string): Promise<Result<Array<Omit<InfographicShareLinkRecord, "tokenHash"> & { live: boolean }>, DomainError>> {
    const rows = await this.shares.listByInfographic(infographicId, ctx.tenant.tenantId);
    if (!rows.ok) return rows;
    const now = new Date();
    return { ok: true, value: rows.value.map(({ tokenHash: _hash, ...rest }) => ({ ...rest, live: isShareLinkLive(rest, now) })) };
  }
}

export class RevokeInfographicShareLinkHandler {
  constructor(private readonly shares: IInfographicShareRepository, private readonly audits: IAuditLogger, private readonly clock: IClock) {}
  async handle(ctx: AuthenticatedContext, linkId: string): Promise<Result<{ revoked: true }, DomainError>> {
    const revoked = await this.shares.revoke(linkId, ctx.tenant.tenantId, this.clock.now());
    if (!revoked.ok) return revoked;
    await this.audits.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "infographic.share.revoke", entityType: "InfographicShareLink", entityId: linkId });
    return { ok: true, value: { revoked: true } };
  }
}

export interface PublicShare {
  bytes: Buffer;
  contentType: string;
  format: string;
  fileName: string;
  title: string;
  altText?: string;
  expiresAt: Date;
}

/**
 * What a visitor with a link gets. The token is looked up by its hash on the admin connection (the visitor has
 * no session); the file is that one published export and nothing else. Expired, revoked and unknown links all
 * read as "not found", so a link cannot be probed.
 */
export class ResolveInfographicShareHandler {
  constructor(private readonly shares: IInfographicShareRepository, private readonly repo: IInfographicRepository, private readonly storage: IStorage, private readonly clock: IClock) {}

  async handle(token: string, opts: { countView?: boolean } = {}): Promise<Result<PublicShare, DomainError>> {
    const notFound = { ok: false as const, error: DomainError.notFound("Link", "this link") };
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return notFound;
    const link = await this.shares.findByTokenHash(sha256(token));
    if (!link.ok || !link.value || !isShareLinkLive(link.value, this.clock.now())) return notFound;
    const tenantId = (await import("@donordesk/domain")).TenantId.create(link.value.tenantId);
    const exportRow = await this.repo.findExportById(link.value.exportId, tenantId);
    if (!exportRow.ok || !exportRow.value) return notFound;
    const design = await this.repo.findById(exportRow.value.infographicId, tenantId);
    const bytes = await this.storage.read(exportRow.value.storageKey);
    if (opts.countView) await this.shares.recordView(link.value.id);
    const { EXPORT_FILE } = await import("../../ports/infographics.js");
    const file = EXPORT_FILE[exportRow.value.format];
    return {
      ok: true,
      value: {
        bytes,
        contentType: file.contentType,
        format: exportRow.value.format,
        fileName: `infographic.${file.extension}`,
        title: design.ok && design.value ? design.value.title : "Infographic",
        ...(exportRow.value.altText ? { altText: exportRow.value.altText } : {}),
        expiresAt: link.value.expiresAt,
      },
    };
  }
}

// ---------------------------------------------------------------- variants

const MAX_VARIANTS = 24;

/**
 * Makes one design per location or per period from an existing one, so a set of pages for every district or every
 * quarter is a click, not a rebuild. Variants are drafts: each is reviewed and published on its own, and the
 * original is never changed.
 */
export class GenerateInfographicVariantsHandler {
  constructor(
    private readonly repo: IInfographicRepository,
    private readonly create: CreateInfographicHandler,
    private readonly data: GetProjectInfographicDataHandler,
  ) {}

  async handle(ctx: AuthenticatedContext, infographicId: string, input: { by: "LOCATION" | "PERIOD" | "LATEST_PERIOD" }): Promise<Result<InfographicRecord[], DomainError>> {
    const found = await this.repo.findById(infographicId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DomainError.notFound("Infographic", infographicId) };
    const config = parse(found.value.configJson);
    if (!config.ok) return config;
    if (found.value.projectId === PORTFOLIO_PROJECT_ID) return { ok: false, error: DomainError.validation("A portfolio page cannot be split by location or period") };
    const data = await this.data.handle(ctx, found.value.projectId);
    if (!data.ok) return data;
    const base = { ...config.value };
    const jobs: Array<{ title: string; patch: Partial<InfographicConfig> }> = [];
    if (input.by === "LOCATION") {
      const keys = new Map<string, string>();
      for (const row of data.value.activities.rows) keys.set(row.key, row.location);
      for (const row of data.value.reach.registeredByLocation) keys.set(row.key, row.location);
      for (const indicator of data.value.indicators) if (indicator.location.kind !== "PROJECT_WIDE") for (const row of indicator.location.rows) keys.set(row.key, row.location);
      for (const [key, name] of [...keys.entries()].slice(0, MAX_VARIANTS)) jobs.push({ title: `${found.value.title} – ${name}`, patch: { locationKeys: [key] } });
    } else if (input.by === "PERIOD") {
      for (const period of data.value.periods.slice(-MAX_VARIANTS)) jobs.push({ title: `${found.value.title} – ${period.label}`, patch: { periodFromId: period.id, periodToId: period.id } });
    } else {
      const latest = data.value.periods[data.value.periods.length - 1];
      if (!latest) return { ok: false, error: DomainError.validation("This project has no reporting periods yet") };
      jobs.push({ title: `${found.value.title} – ${latest.label}`, patch: { periodToId: latest.id } });
    }
    if (jobs.length === 0) return { ok: false, error: DomainError.validation("There is nothing to split by yet: no locations or periods are recorded") };
    const out: InfographicRecord[] = [];
    for (const job of jobs) {
      const created = await this.create.handle(ctx, found.value.projectId, {
        templateId: base.templateId as never,
        title: job.title,
        config: { ...base, ...job.patch, title: job.title, waivers: undefined } as never,
        parentId: infographicId,
      });
      if (!created.ok) return created;
      out.push(created.value);
    }
    return { ok: true, value: out };
  }
}

export { assetIdsOf };

// ---------------------------------------------------------------- auto-refresh at period approval

/**
 * When a report for a period is approved, every design of the project that asked for it gets a fresh draft for that period: the
 * same layout, the data up to that period, linked to the original, left as a draft for a person to review and publish. Nothing is
 * published, the original is not changed, and a period is never prepared twice. Never fails the approval that triggered it.
 */
export class AutoRefreshInfographicsHandler {
  constructor(
    private readonly repo: IInfographicRepository,
    private readonly create: CreateInfographicHandler,
    private readonly periods: IReportingPeriodRepository,
    private readonly notifier: InfographicNotifier,
    private readonly audits: IAuditLogger,
  ) {}

  async afterApproval(ctx: AuthenticatedContext, report: { projectId: string; reportingPeriodId: string }): Promise<number> {
    try {
      const period = await this.periods.findById(report.reportingPeriodId, ctx.tenant.tenantId);
      if (!period.ok || !period.value) return 0;
      const label = periodSheetLabel(isoDay(period.value.duration.start), isoDay(period.value.duration.end));
      const designs = await this.repo.findByProject(report.projectId, ctx.tenant.tenantId);
      if (!designs.ok) return 0;
      let made = 0;
      for (const design of designs.value) {
        if (design.parentId) continue;
        const config = parse(design.configJson);
        if (!config.ok || !config.value.autoRefresh) continue;
        // One draft per design per period: a repeated approval (or a re-approval after a return) does not pile up copies.
        const already = designs.value.some((d) => d.parentId === design.id && (parse(d.configJson) as { ok: boolean; value?: InfographicConfig }).value?.periodToId === report.reportingPeriodId);
        if (already) continue;
        const copy = await this.create.handle(ctx, report.projectId, {
          templateId: config.value.templateId as never,
          title: `${design.title} – ${label}`.slice(0, 120),
          config: { ...config.value, title: `${design.title} – ${label}`.slice(0, 120), periodToId: report.reportingPeriodId, autoRefresh: undefined, waivers: undefined } as never,
          parentId: design.id,
        });
        if (!copy.ok) continue;
        made += 1;
        await this.audits.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "infographic.auto_refresh", entityType: "Infographic", entityId: copy.value.id, projectId: report.projectId, systemNote: `from ${design.id} for period ${report.reportingPeriodId}` });
        await this.notifier.tell(ctx, [design.createdById, design.updatedById], "A new infographic draft is ready", `“${copy.value.title}” was prepared because the report for ${label} was approved. Open it to check and publish it.`, copy.value.id);
      }
      return made;
    } catch {
      return 0;
    }
  }
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------- model-written text

export type InfographicAiText = { available: false; reason: string } | ({ available: true; model: string } & AiTextProposal);

/**
 * Opt-in headline and key messages written by the organisation's own model from the recorded figures.
 * Redacted before it leaves, parsed strictly, number-grounded after; a sentence with an unknown figure is dropped.
 * Returns "unavailable" (never an error) when AI is off for the organisation, so the fixed-pattern suggestions remain.
 */
export class GetInfographicAiTextHandler {
  constructor(
    private readonly data: GetProjectInfographicDataHandler,
    private readonly sheet: GetProjectDataSheetHandler,
    private readonly llmFor: (tenantId: string) => Promise<ILLMProvider | null>,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, opts: { language?: string } = {}): Promise<Result<InfographicAiText, DomainError>> {
    const [data, sheet] = [await this.data.handle(ctx, projectId), await this.sheet.handle(ctx, projectId)];
    if (!data.ok) return data;
    if (!sheet.ok) return sheet;
    const provider = await this.llmFor(String(ctx.tenant.tenantId));
    if (!provider) return { ok: true, value: { available: false, reason: "AI writing is not switched on for this organisation. The suggestions from your records are still available." } };
    const facts = storyFactsOf(data.value, sheet.value);
    const prompt = buildAiTextPrompt(facts, opts.language);
    try {
      const reply = await provider.complete({ systemPrompt: prompt.system, userPrompt: redactForLlm(prompt.user), jsonMode: true, maxTokens: 1200, temperature: 0.3 });
      const proposal = groundAiText(reply.text, facts);
      if (proposal.headlines.length === 0 && proposal.messages.length === 0) return { ok: true, value: { available: false, reason: "The model's answer did not match your recorded figures, so nothing was kept. Try again or use the suggestions from your records." } };
      return { ok: true, value: { available: true, model: reply.model, ...proposal } };
    } catch {
      return { ok: true, value: { available: false, reason: "The writing service did not answer. The suggestions from your records are still available." } };
    }
  }
}

// ---------------------------------------------------------------- who does what, where (from the plan)

export interface PresenceDraft {
  rows: Array<{ who: string; what: string; where: string[] }>;
  /** How many planned activities had a lead and a place, and so could be used. */
  used: number;
  skipped: number;
}

/**
 * Proposes the rows of a who-does-what-where matrix from the work plan: the activity's lead, its title and its place.
 * An activity with no lead or no place is counted as skipped, never guessed. Cancelled work is left out. The author
 * edits the rows and names the source before publishing.
 */
export class SuggestPresenceRowsHandler {
  constructor(
    private readonly plan: { handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<Array<{ title: string; status: string; ownerUserId?: string; location?: string }>, DomainError>> },
    private readonly people: { handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<Array<{ userId: string; name: string }>, DomainError>> },
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<PresenceDraft, DomainError>> {
    const [plan, people] = [await this.plan.handle(ctx, projectId), await this.people.handle(ctx, projectId)];
    if (!plan.ok) return plan;
    if (!people.ok) return people;
    const nameOf = new Map(people.value.map((p) => [p.userId, p.name] as const));
    const grouped = new Map<string, { who: string; what: string; where: Map<string, string> }>();
    let used = 0;
    let skipped = 0;
    for (const item of plan.value) {
      if (item.status === "CANCELLED") continue;
      const who = item.ownerUserId ? nameOf.get(item.ownerUserId) : undefined;
      const place = item.location?.trim();
      if (!who || !place) {
        skipped += 1;
        continue;
      }
      used += 1;
      const key = `${who}\u0000${item.title.trim().toLowerCase()}`;
      const row = grouped.get(key) ?? { who: who.slice(0, 60), what: item.title.trim().slice(0, 60), where: new Map<string, string>() };
      row.where.set(place.toLowerCase(), place.slice(0, 60));
      grouped.set(key, row);
    }
    const rows = [...grouped.values()]
      .sort((a, b) => b.where.size - a.where.size || a.who.localeCompare(b.who))
      .slice(0, 16)
      .map((r) => ({ who: r.who, what: r.what, where: [...r.where.values()].slice(0, 8) }));
    return { ok: true, value: { rows, used, skipped } };
  }
}
