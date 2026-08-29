/**
 * Prisma implementation of `IReportArtifactRepository`.
 *
 * Persists AI Reporter 2 typed artifacts in two normalised tables:
 *   - ReportArtifact (one row per artifact)
 *   - ReportArtifactRow (one row per row of TABLE/LIST artifacts)
 *
 * `payloadJson` stores the kind-specific payload (table columns, chart series,
 * etc.); `cellsJson` + `sourceRefsJson` on each row give the read API a
 * shaped structure for rendering. RLS is enforced by the database.
 */
import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import { type Result, DomainError, type TenantId, type SourceReference } from "@donordesk/domain";
import type {
  GeneratedArtifact,
  IReportArtifactRepository,
  ReportArtifactRecord,
  ReportArtifactRowData,
} from "@donordesk/application";

function jsonString(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseRows(json: string): ReportArtifactRowData[] {
  try {
    const raw = JSON.parse(json) as Array<{ ordinal?: unknown; cells?: unknown; sourceRefs?: unknown }>;
    return raw.map((row, idx) => ({
      ordinal: typeof row.ordinal === "number" ? row.ordinal : idx,
      cells: Array.isArray(row.cells) ? (row.cells as Array<string | number | null>) : [],
      sourceReferences: Array.isArray(row.sourceRefs) ? (row.sourceRefs as SourceReference[]) : [],
    }));
  } catch {
    return [];
  }
}

function parseRefs(json: string): SourceReference[] {
  try {
    const raw = JSON.parse(json) as SourceReference[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function rowsToCellJson(rows: ReadonlyArray<ReportArtifactRowData>): string {
  return JSON.stringify(
    rows.map((r) => ({
      ordinal: r.ordinal,
      cells: r.cells,
      sourceRefs: r.sourceReferences,
    })),
  );
}

export class PrismaReportArtifactRepository implements IReportArtifactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async replaceForSection(input: {
    tenantId: TenantId;
    sectionId: string;
    revisionId: string | null;
    artifacts: ReadonlyArray<GeneratedArtifact>;
  }): Promise<Result<void, DomainError>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.reportArtifactRow.deleteMany({
          where: { tenantId: String(input.tenantId), artifact: { sectionId: input.sectionId } },
        });
        await tx.reportArtifact.deleteMany({
          where: { tenantId: String(input.tenantId), sectionId: input.sectionId },
        });

        if (input.artifacts.length === 0) return;

        for (const art of input.artifacts) {
          const artifactId = randomUUID();
          const rowRecords: ReportArtifactRowData[] =
            art.kind === "TABLE"
              ? (art.payload.rows as Array<{ cells: Array<string | number | null>; sourceReferences: SourceReference[] }>).map((r, idx) => ({
                  ordinal: idx,
                  cells: r.cells,
                  sourceReferences: r.sourceReferences,
                }))
              : art.kind === "LIST"
                ? (art.payload.items as Array<{ sourceReferences: SourceReference[]; text?: string }>).map((it, idx) => ({
                    ordinal: idx,
                    cells: [it.text ?? ""],
                    sourceReferences: it.sourceReferences,
                  }))
                : [];

          await tx.reportArtifact.create({
            data: {
              id: artifactId,
              tenantId: String(input.tenantId),
              sectionId: input.sectionId,
              revisionId: input.revisionId,
              kind: art.kind,
              ordinal: art.ordinal,
              caption: art.caption ?? null,
              payloadJson: jsonString(art.payload),
              sourceRefsJson: jsonString(art.sourceReferences),
            },
          });

          if (rowRecords.length > 0) {
            await tx.reportArtifactRow.createMany({
              data: rowRecords.map((row) => ({
                id: randomUUID(),
                tenantId: String(input.tenantId),
                artifactId,
                ordinal: row.ordinal,
                cellsJson: jsonString(row.cells),
                sourceRefsJson: jsonString(row.sourceReferences),
              })),
            });
          }
        }
      });
      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: DomainError.invariant(
          `ReportArtifactRepository.replaceForSection failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      };
    }
  }

  async findBySection(
    sectionId: string,
    tenantId: TenantId,
  ): Promise<Result<ReportArtifactRecord[], DomainError>> {
    try {
      const artifacts = await this.prisma.reportArtifact.findMany({
        where: { tenantId: String(tenantId), sectionId },
        orderBy: { ordinal: "asc" },
        include: { rows: { orderBy: { ordinal: "asc" } } },
      });
      return {
        ok: true,
        value: artifacts.map((a) => this.toRecord(a)),
      };
    } catch (error) {
      return {
        ok: false,
        error: DomainError.invariant(
          `ReportArtifactRepository.findBySection failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      };
    }
  }

  async findByRevision(
    revisionId: string,
    tenantId: TenantId,
  ): Promise<Result<ReportArtifactRecord[], DomainError>> {
    try {
      const artifacts = await this.prisma.reportArtifact.findMany({
        where: { tenantId: String(tenantId), revisionId },
        orderBy: { ordinal: "asc" },
        include: { rows: { orderBy: { ordinal: "asc" } } },
      });
      return {
        ok: true,
        value: artifacts.map((a) => this.toRecord(a)),
      };
    } catch (error) {
      return {
        ok: false,
        error: DomainError.invariant(
          `ReportArtifactRepository.findByRevision failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      };
    }
  }

  private toRecord(a: {
    id: string;
    tenantId: string;
    sectionId: string;
    revisionId: string | null;
    kind: string;
    ordinal: number;
    caption: string | null;
    payloadJson: string;
    sourceRefsJson: string;
    createdAt: Date;
    rows?: Array<{ ordinal: number; cellsJson: string; sourceRefsJson: string }>;
  }): ReportArtifactRecord {
    const rows = (a.rows ?? []).map((r) => ({
      ordinal: r.ordinal,
      cells: (() => {
        try {
          const parsed = JSON.parse(r.cellsJson) as Array<string | number | null>;
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
      sourceReferences: parseRefs(r.sourceRefsJson),
    }));
    return {
      id: a.id,
      tenantId: a.tenantId as unknown as TenantId,
      sectionId: a.sectionId,
      revisionId: a.revisionId,
      kind: a.kind as ReportArtifactRecord["kind"],
      ordinal: a.ordinal,
      caption: a.caption,
      payload: (() => {
        try {
          return JSON.parse(a.payloadJson) as unknown;
        } catch {
          return null;
        }
      })(),
      sourceReferences: parseRefs(a.sourceRefsJson),
      rows,
      createdAt: a.createdAt,
    };
  }
}
