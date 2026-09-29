import type { Result, TenantId, DomainError } from "@donordesk/domain";

/**
 * Feature 22 (DonorDesk Academy): tears down everything a demo project owns.
 * Scoped deliberately to demo projects only — general project deletion is
 * still deferred (see `Features/18-Project-Creation-Wizard.md` §5.9); this
 * port never touches a real (non-demo) project's data.
 */
export interface IDemoProjectRepository {
  deleteDemoProjectData(tenantId: TenantId, projectId: string): Promise<Result<void, DomainError>>;
}
