import type { Result, SnapshotIndicator, TenantId } from "@donordesk/domain";
import { parseSnapshot } from "@donordesk/domain";
import type { ILogframeVersionRepository } from "../ports/logframe.js";
import type { IFrameworkApprovalReader } from "../ports/framework-approval-reader.js";

/** Reads the latest signed-off version of a project's framework (versions are listed newest first). */
export class FrameworkApprovalReader implements IFrameworkApprovalReader {
  constructor(private readonly versions: ILogframeVersionRepository) {}

  async approvedIndicator(projectId: string, indicatorId: string, tenantId: TenantId): Promise<Result<SnapshotIndicator | null>> {
    const listed = await this.versions.list(projectId, tenantId);
    if (!listed.ok) return listed;
    const approved = listed.value.find((v) => v.approvedAt);
    const snapshot = approved ? parseSnapshot(approved.snapshotJson) : null;
    return { ok: true, value: snapshot?.indicators.find((i) => i.id === indicatorId) ?? null };
  }
}
