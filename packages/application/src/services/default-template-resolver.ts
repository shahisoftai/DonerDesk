import { pickDefaultTemplate } from "@donordesk/domain";
import type { Result, TenantId } from "@donordesk/domain";
import type { IDonorTemplateRepository } from "../ports/templates.js";
import type { IReportingProfileRepository } from "../ports/setup.js";
import type { IDefaultTemplateResolver, ResolvedDefaultTemplate } from "../ports/default-template-resolver.js";

/** Loads the project's templates and profile and asks the domain which one applies. */
export class DefaultTemplateResolver implements IDefaultTemplateResolver {
  constructor(
    private readonly templates: IDonorTemplateRepository,
    private readonly profiles: IReportingProfileRepository,
  ) {}

  async resolve(tenantId: TenantId, projectId: string, reportType: string): Promise<Result<ResolvedDefaultTemplate>> {
    const all = await this.resolveAll(tenantId, projectId, [reportType]);
    if (!all.ok) return all;
    return { ok: true, value: all.value[reportType] ?? { source: "NONE" } };
  }

  async resolveAll(tenantId: TenantId, projectId: string, reportTypes: ReadonlyArray<string>): Promise<Result<Record<string, ResolvedDefaultTemplate>>> {
    const profile = await this.profiles.findByProject(projectId, tenantId);
    if (!profile.ok) return profile;
    const templates = await this.templates.findByProject(projectId, tenantId);
    if (!templates.ok) return templates;
    const candidates = templates.value.map((t) => ({ id: t.id, reportType: t.reportType, status: t.status, updatedAt: t.updatedAt }));
    const out: Record<string, ResolvedDefaultTemplate> = {};
    for (const reportType of reportTypes) {
      const picked = pickDefaultTemplate({ reportType, profileDefaultId: profile.value?.defaultTemplateId, candidates });
      const template = picked.templateId ? templates.value.find((t) => t.id === picked.templateId) : undefined;
      out[reportType] = { source: picked.source, ...(template ? { templateId: template.id, templateName: template.templateName, status: template.status } : {}) };
    }
    return { ok: true, value: out };
  }
}
