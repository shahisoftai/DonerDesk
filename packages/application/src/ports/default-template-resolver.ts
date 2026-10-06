import type { DefaultTemplateSource, Result, TenantId } from "@donordesk/domain";

export interface ResolvedDefaultTemplate {
  templateId?: string;
  templateName?: string;
  /** REVIEWED, or NEEDS_REVIEW etc. for a profile default that is not approved yet. */
  status?: string;
  source: DefaultTemplateSource;
}

/** The template a new period of this type starts from, so the form, the closing plan and the created period cannot disagree. */
export interface IDefaultTemplateResolver {
  resolve(tenantId: TenantId, projectId: string, reportType: string): Promise<Result<ResolvedDefaultTemplate>>;
  /** The same answer for several types, loading the project's templates once. */
  resolveAll(tenantId: TenantId, projectId: string, reportTypes: ReadonlyArray<string>): Promise<Result<Record<string, ResolvedDefaultTemplate>>>;
}
