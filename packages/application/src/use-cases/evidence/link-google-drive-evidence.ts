import type { Result } from "@donordesk/domain";
import { DomainError, EvidenceFile, EvidenceUploaded } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IEvidenceStorageResolver } from "../../ports/infrastructure.js";
import type { IIdGenerator, IAuditLogger, IEventBus } from "../../ports/core.js";
import type { LinkEvidenceInput } from "@donordesk/contracts";

/**
 * Links an existing Google Drive file as evidence without copying bytes. The
 * file stays in the tenant's Drive; the resolver grants DonorDesk read access
 * and records driveFileId + web link. Returns the evidence id and link.
 */
export class LinkGoogleDriveEvidenceHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly repo: IEvidenceRepository,
    private readonly storageResolver: IEvidenceStorageResolver,
    private readonly events: IEventBus,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, cmd: LinkEvidenceInput): Promise<Result<{ id: string; fileUrl: string }, DomainError>> {
    const id = this.ids.generate();
    const tenantId = ctx.tenant.tenantId.toString();

    const storage = await this.storageResolver.resolve(ctx.tenant.tenantId);
    const location = await storage.save({
      tenantId,
      projectId: cmd.projectId,
      evidenceId: id,
      fileName: cmd.fileName,
      fileType: cmd.fileType,
      fileSize: 0,
      driveFileId: cmd.driveFileId,
      driveWebLink: cmd.driveWebLink,
    });
    if (!location.ok) return location;
    if (location.value.provider !== "GOOGLE_DRIVE") {
      return { ok: false, error: DomainError.invariant("Drive linking requires the tenant to use Google Drive storage") };
    }

    const ev = EvidenceFile.create({
      id,
      tenantId,
      projectId: cmd.projectId,
      fileName: cmd.fileName,
      title: cmd.title,
      fileUrl: location.value.fileUrl,
      fileType: cmd.fileType,
      fileSize: location.value.fileSize,
      evidenceType: cmd.evidenceType,
      storageProvider: "GOOGLE_DRIVE",
      driveFileId: cmd.driveFileId,
      driveWebLink: location.value.driveWebLink,
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
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "evidence.linked",
      entityType: "evidence",
      entityId: id,
      projectId: cmd.projectId,
      newValue: cmd.fileName,
    });

    await this.events.publish([new EvidenceUploaded(ctx.tenant.tenantId, id, cmd.projectId, ctx.tenant.userId)]);

    return { ok: true, value: { id, fileUrl: location.value.fileUrl } };
  }
}
