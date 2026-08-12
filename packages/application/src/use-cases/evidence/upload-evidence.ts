import type { Result } from "@donordesk/domain";
import { DomainError, EvidenceFile } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository, IDocumentParser } from "../../ports/evidence.js";
import type { IStorage } from "../../ports/infrastructure.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { IJobQueue } from "../../ports/infrastructure.js";
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
    private readonly parser: IDocumentParser,
    private readonly jobs: IJobQueue,
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

    // Best-effort text extraction (off the request path could be improved by moving to a queue, but inline keeps Phase 1 simple).
    try {
      const parsed = await this.parser.parse({ buffer: cmd.buffer, fileType: cmd.fileType, fileName: cmd.fileName });
      await this.jobs.enqueue("evidence.suggest_tags", { evidenceId: id, text: parsed.text });
    } catch {
      // swallow — evidence still uploaded; tagging can be retried.
    }

    return { ok: true, value: { id, fileUrl: stored.url } };
  }
}
