import type { Result, DomainError } from "@donordesk/domain";
import type { CreateDonorTemplateInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IDriveFileContentReader } from "../../ports/infrastructure.js";
import type { IDocumentParser } from "../../ports/evidence.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { UploadTemplateHandler } from "../templates/upload-template.js";

export type DriveImportKind = "template" | "logframe" | "data";

export type DriveImportResult =
  | { kind: "template"; id: string; templateName: string }
  | { kind: "logframe" | "data"; text: string; name: string };

const REPORT_TYPES: ReadonlySet<string> = new Set([
  "MONTHLY", "QUARTERLY", "ANNUAL", "FINAL", "ACTIVITY", "SITUATION", "CUSTOM",
]);

/**
 * Reads a file already stored in the tenant's Google Drive and imports it into
 * the app: donor templates are parsed into reviewed sections and persisted as a
 * new template; logframe/data files are parsed to text for review in the UI
 * (mirroring the existing file-import UX, which does not auto-create items).
 */
export class ImportDriveFileHandler {
  constructor(
    private readonly reader: IDriveFileContentReader,
    private readonly parser: IDocumentParser,
    private readonly uploadTemplate: UploadTemplateHandler,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    projectId: string,
    input: {
      driveFileId: string;
      kind: DriveImportKind;
      templateName?: string;
      donorName?: string;
      reportType?: string;
      language?: string;
    },
  ): Promise<Result<DriveImportResult, DomainError>> {
    const read = await this.reader.read(ctx.tenant.tenantId, input.driveFileId);
    if (!read.ok) return read;

    const parsed = await this.parser.parse({
      buffer: read.value.bytes,
      fileName: read.value.name,
      fileType: read.value.mimeType,
    });

    if (input.kind === "template") {
      const templateName =
        input.templateName?.trim() || read.value.name.replace(/\.[^.]+$/, "").trim() || "Imported template";
      const reportType: CreateDonorTemplateInput["reportType"] =
        input.reportType && REPORT_TYPES.has(input.reportType)
          ? (input.reportType as CreateDonorTemplateInput["reportType"])
          : "CUSTOM";
      const created = await this.uploadTemplate.handle(ctx, {
        projectId,
        templateName,
        donorName: input.donorName?.trim() || "Google Drive",
        reportType,
        language: input.language || "en",
        requiredAnnexes: [],
        sections: [],
        extractedRawText: parsed.text || read.value.name,
      });
      if (!created.ok) return created;
      await this.audit.record({
        tenantId: ctx.tenant.tenantId,
        actorId: ctx.tenant.userId,
        eventType: "drive.imported",
        entityType: "donor_template",
        entityId: created.value.id,
        projectId,
        newValue: JSON.stringify({ driveFileId: input.driveFileId, templateName }),
      });
      return { ok: true, value: { kind: "template", id: created.value.id, templateName } };
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "drive.imported",
      entityType: input.kind,
      entityId: input.driveFileId,
      projectId,
      newValue: read.value.name,
    });
    return { ok: true, value: { kind: input.kind, text: parsed.text, name: read.value.name } };
  }
}
