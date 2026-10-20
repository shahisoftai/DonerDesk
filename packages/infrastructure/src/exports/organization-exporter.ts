import { PassThrough, type Readable } from "node:stream";
import { Prisma, type PrismaClient } from "@prisma/client";
import { ZipArchive } from "archiver";
import { DomainError } from "@donordesk/domain";
import type { IOrganizationExporter, OrganizationExport } from "@donordesk/application";

/**
 * Tenant tables that are NOT in the organisation export, each with the reason. Every other tenant-scoped table is
 * exported, so a table added tomorrow is included by default and is only left out by a decision recorded here;
 * `organization-export.test.mjs` fails when a model is neither exported nor listed, and when an exported column looks
 * like a secret.
 */
export const ORG_EXPORT_EXCLUDED: Readonly<Record<string, string>> = {
  PasswordResetToken: "sign-in secret",
  ScimCredential: "sign-in secret",
  IdempotencyRecord: "internal request bookkeeping",
  RequestIdempotency: "internal request bookkeeping",
  ReminderLedgerEntry: "internal reminder bookkeeping",
  JobOutbox: "internal job bookkeeping",
  LlmRun: "internal AI ledger (counts and diagnostics, not the organisation's records)",
  EvidenceChunk: "derived from the evidence files, which are exported",
  EvidenceEmbedding: "derived search vectors",
  LessonPattern: "derived analytics",
  ProjectRiskTrend: "derived analytics",
  ConnectorRun: "internal integration log",
  MultiRegionBookmark: "internal routing record",
  BillingEventInbox: "payment-provider webhook log",
  TrialIdentity: "anti-abuse record",
  UsageCounter: "internal metering",
};

/** Columns left out of an exported table: a person's password hash and an invitation's secret link token. */
export const ORG_EXPORT_OMITTED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  User: ["passwordHash"],
  Invitation: ["token"],
};

const PAGE = 500;
const active = new Set<string>();

export function exportedModels(): Array<{ name: string; delegate: string; hasId: boolean; fields: string[] }> {
  return Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === "tenantId") && !(m.name in ORG_EXPORT_EXCLUDED))
    .map((m) => ({
      name: m.name,
      delegate: m.name.charAt(0).toLowerCase() + m.name.slice(1),
      hasId: m.fields.some((f) => f.name === "id"),
      fields: m.fields.filter((f) => f.kind === "scalar" || f.kind === "enum").map((f) => f.name).filter((n) => !(ORG_EXPORT_OMITTED_FIELDS[m.name] ?? []).includes(n)),
    }));
}

const json = (value: unknown): string => JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

/**
 * The whole organisation as one ZIP: every record as newline-delimited JSON (one file per table), a manifest, and —
 * when asked — the evidence files themselves. A machine-readable copy of what the organisation put into DonorDesk,
 * not a report. Reads through the caller's tenant-scoped client, so row-level security bounds it to one organisation.
 */
export class OrganizationExporter implements IOrganizationExporter {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: { read(key: string): Promise<Buffer> },
    private readonly maxFileBytes = Number(process.env.ORG_EXPORT_MAX_FILE_BYTES ?? 1024 * 1024 * 1024),
  ) {}

  async export(tenantId: string, options: { includeFiles: boolean }): Promise<OrganizationExport> {
    if (active.has(tenantId)) throw DomainError.conflict("An export of this organisation is already being prepared. Try again in a few minutes.");
    active.add(tenantId);
    const archive = new ZipArchive({ zlib: { level: 6 } });
    const out = new PassThrough();
    archive.pipe(out);
    archive.on("error", (error: Error) => out.destroy(error));
    out.on("close", () => active.delete(tenantId));
    void this.fill(archive, tenantId, options).catch((error: unknown) => {
      out.destroy(error instanceof Error ? error : new Error(String(error)));
    });
    return { stream: out as Readable, fileName: `donordesk-export-${new Date().toISOString().slice(0, 10)}.zip` };
  }

  private async fill(archive: ZipArchive, tenantId: string, options: { includeFiles: boolean }): Promise<void> {
    const counts: Record<string, number> = {};
    const evidence: Array<{ id: string; fileName: string; storageKey: string | null; storageProvider: string | null }> = [];
    for (const model of exportedModels()) {
      const delegate = (this.prisma as unknown as Record<string, { findMany(args: unknown): Promise<Array<Record<string, unknown>>> }>)[model.delegate];
      if (!delegate) continue;
      const select = Object.fromEntries(model.fields.map((f) => [f, true]));
      const lines: string[] = [];
      let cursor: string | undefined;
      for (;;) {
        const rows = await delegate.findMany({
          where: { tenantId },
          select,
          take: PAGE,
          ...(model.hasId ? { orderBy: { id: "asc" }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) } : {}),
        });
        for (const row of rows) {
          lines.push(json(row));
          if (model.name === "EvidenceFile") {
            evidence.push({ id: String(row.id), fileName: String(row.fileName), storageKey: (row.storageKey as string | null) ?? null, storageProvider: (row.storageProvider as string | null) ?? null });
          }
        }
        if (!model.hasId || rows.length < PAGE) break;
        cursor = String(rows[rows.length - 1]?.id);
      }
      counts[model.name] = lines.length;
      if (lines.length > 0) archive.append(lines.join("\n") + "\n", { name: `data/${model.name}.ndjson` });
    }

    const filesIncluded: string[] = [];
    const filesSkipped: Array<{ id: string; fileName: string; reason: string }> = [];
    let bytes = 0;
    for (const file of evidence) {
      if (!options.includeFiles) { filesSkipped.push({ id: file.id, fileName: file.fileName, reason: "files were not requested" }); continue; }
      if (!file.storageKey || file.storageProvider === "GOOGLE_DRIVE") { filesSkipped.push({ id: file.id, fileName: file.fileName, reason: "kept in Google Drive, not in DonorDesk" }); continue; }
      try {
        const buffer = await this.storage.read(file.storageKey);
        if (bytes + buffer.length > this.maxFileBytes) { filesSkipped.push({ id: file.id, fileName: file.fileName, reason: "over the size limit of this download; request files in smaller groups" }); continue; }
        bytes += buffer.length;
        archive.append(buffer, { name: `files/${file.id}/${file.fileName.replace(/[\\/]/g, "_")}` });
        filesIncluded.push(file.id);
      } catch {
        filesSkipped.push({ id: file.id, fileName: file.fileName, reason: "the file could not be read" });
      }
    }

    archive.append(json({
      exportedAt: new Date().toISOString(),
      format: "donordesk-organization-export/1",
      tables: counts,
      files: { included: filesIncluded.length, skipped: filesSkipped },
      notes: [
        "Each file in data/ holds one record per line (JSON). Dates are ISO 8601 in UTC.",
        "Password hashes and invitation tokens are never exported.",
        "Left out because they are internal bookkeeping or derived from what is here: " + Object.keys(ORG_EXPORT_EXCLUDED).join(", ") + ".",
      ],
    }), { name: "manifest.json" });
    await archive.finalize();
  }
}
