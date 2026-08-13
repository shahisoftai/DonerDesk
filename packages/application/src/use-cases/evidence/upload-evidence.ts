import type { Result } from "@donordesk/domain";
import { DomainError, EvidenceFile, EvidenceUploaded } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IStorage } from "../../ports/infrastructure.js";
import type { IIdGenerator, IAuditLogger, IEventBus } from "../../ports/core.js";
import type { CreateEvidenceInput } from "@donordesk/contracts";

export interface UploadEvidenceCommand extends CreateEvidenceInput {
  buffer: Buffer;
  originalFileName: string;
}

export class UploadEvidenceHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly repo: IEvidenceRepository,
    private readonly storage: IStorage,
    private readonly events: IEventBus,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, cmd: UploadEvidenceCommand): Promise<Result<{ id: string; fileUrl: string }, DomainError>> {
    const id = this.ids.generate();
    const ext = cmd.fileName.split(".").pop()?.toLowerCase() ?? cmd.fileType;
    const storageKey = `${ctx.tenant.tenantId.toString()}/evidence/${id}.${ext}`;
    const stored = await this.storage.put({
      key: storageKey,
      body: cmd.buffer,
      contentType: cmd.fileType,
    });

    const ev = EvidenceFile.create({
      id,
      tenantId: ctx.tenant.tenantId.toString(),
      projectId: cmd.projectId,
      fileName: cmd.fileName,
      title: cmd.title,
      fileUrl: stored.url,
      fileType: cmd.fileType,
      fileSize: cmd.fileSize,
      evidenceType: cmd.evidenceType,
      reportingPeriodId: cmd.reportingPeriodId,
      activityId: cmd.activityId,
      indicatorId: cmd.indicatorId,
      location: cmd.location,
      activityDate: cmd.activityDate ? new Date(cmd.activityDate) : undefined,
      uploadedById: ctx.tenant.userId,
      confidentialityLevel: cmd.confidentialityLevel,
      notes: cmd.notes,
    });

    const saved = await this.repo.create(ev);
    if (!saved.ok) {
      await this.storage.remove(storageKey);
      return saved;
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "evidence.uploaded",
      entityType: "evidence",
      entityId: id,
      projectId: cmd.projectId,
      newValue: cmd.fileName,
    });

    // Trigger downstream work via a domain event. The outbox event bus maps
    // this to the evidence.suggest_tags job; processing is off the request path.
    await this.events.publish([new EvidenceUploaded(ctx.tenant.tenantId, id, cmd.projectId, ctx.tenant.userId)]);

    return { ok: true, value: { id, fileUrl: stored.url } };
  }
}
