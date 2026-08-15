import type { Result, DomainError, TenantId } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type {
  IProjectReadinessService,
  ProjectReadiness,
  ProjectReadinessSnapshot,
} from "../../ports/projects.js";

export interface ProjectSetupView {
  readiness: ProjectReadiness;
  snapshot: ProjectReadinessSnapshot;
  provisionStatus: string;
  acknowledged: boolean;
}

export class GetProjectSetupHandler {
  constructor(private readonly readiness: IProjectReadinessService) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<ProjectSetupView, DomainError>> {
    const tenantId: TenantId = ctx.tenant.tenantId;
    const [readiness, snapshot] = await Promise.all([
      this.readiness.compute(projectId, tenantId),
      this.readiness.snapshot(projectId, tenantId),
    ]);
    if (!readiness.ok) return readiness;
    if (!snapshot.ok) return snapshot;
    return {
      ok: true,
      value: {
        readiness: readiness.value,
        snapshot: snapshot.value,
        provisionStatus: snapshot.value.workspace.provisionStatus,
        acknowledged: Boolean(snapshot.value.acknowledgedAt),
      },
    };
  }
}
