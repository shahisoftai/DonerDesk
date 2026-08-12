import type { Result, TenantId } from "@donordesk/domain";
import type { ActivityUpdate } from "@donordesk/domain";

export interface IActivityUpdateRepository {
  create(a: ActivityUpdate): Promise<Result<ActivityUpdate>>;
  update(a: ActivityUpdate): Promise<Result<ActivityUpdate>>;
  findById(id: string, tenantId: TenantId): Promise<Result<ActivityUpdate | null>>;
  findByReportingPeriod(reportingPeriodId: string, tenantId: TenantId): Promise<Result<ActivityUpdate[]>>;
  findByProject(projectId: string, tenantId: TenantId): Promise<Result<ActivityUpdate[]>>;
}

export interface IActivityPolisher {
  polish(input: {
    roughSummary: string;
    achievements: string;
    challenges: string;
    lessonsLearned: string;
  }): Promise<{ narrative: string; model: string }>;
}
