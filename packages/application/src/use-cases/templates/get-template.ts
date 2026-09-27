import type { Result, DomainError, TemplateVersionSnapshot } from "@donordesk/domain";
import { DomainError as DE } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDonorTemplateRepository, IDonorTemplateVersionReader, ITemplateFileStore, TemplateVersionSummary } from "../../ports/templates.js";
import { toDonorTemplateView, type DonorTemplateView } from "../../services/donor-template-view.js";
import { loadTemplate } from "./load-template.js";

export class GetTemplateHandler {
  constructor(private readonly templates: IDonorTemplateRepository, private readonly versions: IDonorTemplateVersionReader) {}

  async handle(
    ctx: AuthenticatedContext,
    templateId: string,
  ): Promise<Result<DonorTemplateView & { versions: TemplateVersionSummary[]; extractedRawText?: string }, DomainError>> {
    const loaded = await loadTemplate(this.templates, templateId, ctx.tenant.tenantId);
    if (!loaded.ok) return loaded;
    const versions = await this.versions.listVersions(templateId, ctx.tenant.tenantId);
    if (!versions.ok) return versions;
    return { ok: true, value: { ...toDonorTemplateView(loaded.value), versions: versions.value, extractedRawText: loaded.value.extractedRawText } };
  }
}

export class GetTemplateVersionHandler {
  constructor(private readonly versions: IDonorTemplateVersionReader) {}

  async handle(ctx: AuthenticatedContext, templateId: string, version: number): Promise<Result<TemplateVersionSnapshot, DomainError>> {
    const r = await this.versions.findVersion(templateId, version, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DE.notFound("DonorTemplateVersion", `${templateId}@${version}`) };
    return { ok: true, value: r.value };
  }
}

/** Streams the original uploaded file back to an authorised user. */
export class GetTemplateOriginalFileHandler {
  constructor(private readonly templates: IDonorTemplateRepository, private readonly files: ITemplateFileStore) {}

  async handle(ctx: AuthenticatedContext, templateId: string): Promise<Result<{ buffer: Buffer; fileName: string; mimeType: string }, DomainError>> {
    const loaded = await loadTemplate(this.templates, templateId, ctx.tenant.tenantId);
    if (!loaded.ok) return loaded;
    const key = loaded.value.originalFileUrl;
    if (!key) return { ok: false, error: DE.notFound("DonorTemplateOriginalFile", templateId) };
    const file = await this.files.open(key, ctx.tenant.tenantId);
    if (!file.ok) return file;
    return { ok: true, value: { buffer: file.value.buffer, fileName: file.value.fileName, mimeType: file.value.mimeType } };
  }
}
