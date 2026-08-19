import type { Result } from "@donordesk/domain";
import { DomainError, EvidenceFile, parseEvidenceText, type EvidenceType, type ConfidentialityLevel } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IEvidenceRepository } from "../../ports/evidence.js";
import type { IActivityUpdateRepository } from "../../ports/activities.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { ImportEvidenceTextInput } from "@donordesk/contracts";

const MAX_IMPORT_ROWS = 1000;

export interface ImportedEvidence {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  evidenceType: EvidenceType;
}

export interface ImportEvidenceResult {
  created: number;
  skipped: number;
  warnings: string[];
  items: ImportedEvidence[];
}

const EXTENSION_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  mp4: "video/mp4",
  zip: "application/zip",
};

const GOOGLE_DRIVE_LINK = /^https?:\/\/(drive\.google\.com|docs\.google\.com|drive\.googleusercontent\.com)(\/|\?|$)/i;

function isGoogleDriveLink(value: string): boolean {
  return GOOGLE_DRIVE_LINK.test(value.trim());
}

function inferFileType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return EXTENSION_MIME[ext] ?? "application/octet-stream";
}

/**
 * Parses evidence metadata (from an upload or template) and persists each row
 * as an EvidenceFile record. The system is link-first, so every imported row
 * must carry a Google Drive share link — no byte copy or storage quota is
 * consumed. Optional Activity Title and Indicator Code columns link the
 * evidence to existing records when a match is found.
 */
export class ImportEvidenceHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly evidence: IEvidenceRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    input: ImportEvidenceTextInput,
  ): Promise<Result<ImportEvidenceResult, DomainError>> {
    const { rows, warnings, structured } = parseEvidenceText(input.text);
    if (rows.length === 0 || !structured) {
      return {
        ok: false,
        error: DomainError.validation(
          "No evidence rows could be parsed. Expected columns for Title, File Name, and Evidence Type.",
        ),
      };
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return {
        ok: false,
        error: DomainError.validation(
          `Too many evidence rows (${rows.length}). Imports are limited to ${MAX_IMPORT_ROWS} rows; split the file and import in batches.`,
        ),
      };
    }

    const activitiesResult = await this.activities.findByProject(input.projectId, ctx.tenant.tenantId);
    if (!activitiesResult.ok) return activitiesResult;
    const activityByTitle = new Map<string, string>();
    for (const a of activitiesResult.value) {
      activityByTitle.set(a.activityTitle.trim().toLowerCase(), a.id);
    }

    const indicatorResult = await this.indicators.findByProject(input.projectId, ctx.tenant.tenantId);
    if (!indicatorResult.ok) return indicatorResult;
    const indicatorByCode = new Map<string, string>();
    for (const ind of indicatorResult.value) {
      indicatorByCode.set(ind.code.trim().toLowerCase(), ind.id);
    }

    const created: ImportedEvidence[] = [];
    let skipped = 0;
    const importWarnings: string[] = [...warnings];

    for (const row of rows) {
      if (!row.driveWebLink || !isGoogleDriveLink(row.driveWebLink)) {
        importWarnings.push(
          `Evidence "${row.title}": missing a valid Google Drive Web Link; skipped (link-first storage requires a Drive share link per row).`,
        );
        skipped++;
        continue;
      }

      const activityId = row.activityTitle ? activityByTitle.get(row.activityTitle.trim().toLowerCase()) : undefined;
      if (row.activityTitle && !activityId) {
        importWarnings.push(`Evidence "${row.title}": activity "${row.activityTitle}" was not found; left unlinked.`);
      }
      const indicatorId = row.indicatorCode ? indicatorByCode.get(row.indicatorCode.trim().toLowerCase()) : undefined;
      if (row.indicatorCode && !indicatorId) {
        importWarnings.push(`Evidence "${row.title}": indicator code "${row.indicatorCode}" was not found; left unlinked.`);
      }

      const id = this.ids.generate();
      const file = EvidenceFile.create({
        id,
        tenantId: ctx.tenant.tenantId.toString(),
        projectId: input.projectId,
        fileName: row.fileName,
        title: row.title,
        fileUrl: row.driveWebLink,
        fileType: inferFileType(row.fileName),
        fileSize: 0,
        evidenceType: row.evidenceType,
        storageProvider: "GOOGLE_DRIVE",
        driveWebLink: row.driveWebLink,
        reportingPeriodId: undefined,
        activityId,
        indicatorId,
        location: row.location,
        activityDate: row.activityDate ? new Date(row.activityDate) : undefined,
        uploadedById: ctx.tenant.userId,
        confidentialityLevel: row.confidentialityLevel as ConfidentialityLevel,
        notes: row.notes,
      });
      const saved = await this.evidence.create(file);
      if (!saved.ok) return saved;

      created.push({
        id,
        title: file.title,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        evidenceType: file.evidenceType,
      });
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "evidence.bulk.imported",
      entityType: "evidence",
      entityId: input.projectId,
      projectId: input.projectId,
      newValue: JSON.stringify({ created: created.length, skipped, sourceName: input.sourceName }),
    });

    return {
      ok: true,
      value: {
        created: created.length,
        skipped,
        warnings: importWarnings,
        items: created,
      },
    };
  }
}
