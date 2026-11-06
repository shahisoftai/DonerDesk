import type { Result } from "@donordesk/domain";
import {
  DomainError,
  Permissions,
  describeLogframeChange,
  diffLogframeSnapshots,
  parseSnapshot,
  type LogframeChange,
  type Role,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ILogframeVersionRepository } from "../../ports/logframe.js";
import type { LogframeVersioner } from "../../services/logframe-versioning.js";

export interface LogframeVersionView {
  version: number;
  summary: string;
  createdAt: Date;
  createdById: string;
  approvedAt: Date | null;
  approvedById: string | null;
}

/** The history of a project's results framework, newest first. */
export class ListLogframeVersionsHandler {
  constructor(private readonly versions: ILogframeVersionRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ items: LogframeVersionView[] }, DomainError>> {
    const found = await this.versions.list(projectId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    return {
      ok: true,
      value: {
        items: found.value.map((v) => ({
          version: v.version,
          summary: v.summary,
          createdAt: v.createdAt,
          createdById: v.createdById,
          approvedAt: v.approvedAt ?? null,
          approvedById: v.approvedById ?? null,
        })),
      },
    };
  }
}

export interface LogframeChangesView {
  from: number | null;
  to: number;
  changes: Array<LogframeChange & { text: string }>;
}

/** What changed between two versions of the framework (`from` omitted = the version before `to`). */
export class GetLogframeChangesHandler {
  constructor(private readonly versions: ILogframeVersionRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string, to: number, from?: number): Promise<Result<LogframeChangesView, DomainError>> {
    const after = await this.versions.findByNumber(projectId, to, ctx.tenant.tenantId);
    if (!after.ok) return after;
    if (!after.value) return { ok: false, error: DomainError.notFound("LogframeVersion", String(to)) };
    const fromNumber = from ?? (to > 1 ? to - 1 : null);
    let before = null;
    if (fromNumber !== null) {
      const found = await this.versions.findByNumber(projectId, fromNumber, ctx.tenant.tenantId);
      if (!found.ok) return found;
      if (!found.value) return { ok: false, error: DomainError.notFound("LogframeVersion", String(fromNumber)) };
      before = parseSnapshot(found.value.snapshotJson);
    }
    const snapshot = parseSnapshot(after.value.snapshotJson);
    if (!snapshot) return { ok: false, error: DomainError.invariant("This version of the framework could not be read.") };
    const changes = diffLogframeSnapshots(before, snapshot).map((c) => ({ ...c, text: describeLogframeChange(c) }));
    return { ok: true, value: { from: fromNumber, to, changes } };
  }
}

/** A person signs a version off as the agreed framework (for example the one the donor approved). */
export class ApproveLogframeVersionHandler {
  constructor(
    private readonly versions: ILogframeVersionRepository,
    private readonly versioner: LogframeVersioner,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<{ version: number }, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "project.edit");
    // Approve what the framework is now: make sure the latest version is current, then sign that one off.
    const captured = await this.versioner.capture(ctx, projectId);
    if (!captured.ok) return captured;
    const latest = await this.versions.latest(projectId, ctx.tenant.tenantId);
    if (!latest.ok) return latest;
    if (!latest.value) return { ok: false, error: DomainError.validation("There is nothing in the results framework to approve yet.") };
    const approved = await this.versions.approve(latest.value.id, ctx.tenant.userId, new Date());
    if (!approved.ok) return approved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.version.approved",
      entityType: "project",
      entityId: projectId,
      projectId,
      newValue: JSON.stringify({ version: latest.value.version }),
    });
    return { ok: true, value: { version: latest.value.version } };
  }
}
