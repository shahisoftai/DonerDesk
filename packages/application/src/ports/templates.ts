import type { Result, TenantId } from "@donordesk/domain";
import type { DonorTemplate, TemplateSection } from "@donordesk/domain";

export interface IDonorTemplateRepository {
  create(t: DonorTemplate): Promise<Result<DonorTemplate>>;
  update(t: DonorTemplate): Promise<Result<DonorTemplate>>;
  findById(id: string, tenantId: TenantId): Promise<Result<DonorTemplate | null>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<DonorTemplate[]>>;
}

export interface ITemplateExtractionService {
  extractSections(input: {
    rawText: string;
    language: string;
    existingSections?: TemplateSection[];
  }): Promise<{ sections: TemplateSection[]; summary: string }>;
}
