import type { Result } from "@donordesk/domain";
import { DomainError, LogframeItem, parseLogframeText, levelRank, type LogframeLevel } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILogframeRepository } from "../../ports/logframe.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";

export interface ImportedLogframeItem {
  id: string;
  level: LogframeLevel;
  code?: string;
  title: string;
  description?: string;
  parentId?: string;
}

export interface ImportLogframeResult {
  created: number;
  skipped: number;
  warnings: string[];
  items: ImportedLogframeItem[];
}

/**
 * Parses logframe content (from an upload or Google Drive import) into
 * structured items and persists them as real logframe records, resolving
 * parents by hierarchy level and skipping items whose code already exists in
 * the project.
 */
export class ImportLogframeHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly repo: ILogframeRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    input: { projectId: string; text: string; sourceName?: string },
  ): Promise<Result<ImportLogframeResult, DomainError>> {
    const { rows, warnings, structured } = parseLogframeText(input.text);
    if (rows.length === 0 || !structured) {
      return {
        ok: false,
        error: DomainError.validation(
          "No logframe items could be parsed. Expected columns for Level, Code, Title, and Description.",
        ),
      };
    }

    const existing = await this.repo.findByProject(input.projectId, ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    const existingCodes = new Set(
      existing.value
        .map((i) => i.code)
        .filter((c): c is string => Boolean(c))
        .map((c) => c.trim().toLowerCase()),
    );

    const lastByRank = new Map<number, string>();
    const created: ImportedLogframeItem[] = [];
    let skipped = 0;

    for (const row of rows) {
      const codeKey = row.code ? row.code.trim().toLowerCase() : "";
      if (row.code && existingCodes.has(codeKey)) {
        skipped++;
        continue;
      }

      const rank = levelRank(row.level);
      const parentId = rank > 0 ? lastByRank.get(rank - 1) : undefined;
      const id = this.ids.generate();
      const item = LogframeItem.create({
        id,
        tenantId: ctx.tenant.tenantId.toString(),
        projectId: input.projectId,
        parentId,
        level: row.level,
        code: row.code,
        title: row.title,
        description: row.description,
      });
      const saved = await this.repo.create(item);
      if (!saved.ok) return saved;

      lastByRank.set(rank, id);
      lastByRank.delete(rank + 1);
      lastByRank.delete(rank + 2);
      lastByRank.delete(rank + 3);

      created.push({
        id,
        level: item.level,
        code: item.code,
        title: item.title,
        description: item.description,
        parentId: item.parentId,
      });
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.items.imported",
      entityType: "logframe_item",
      entityId: input.projectId,
      projectId: input.projectId,
      newValue: JSON.stringify({ created: created.length, skipped, sourceName: input.sourceName }),
    });

    return {
      ok: true,
      value: {
        created: created.length,
        skipped,
        warnings,
        items: created,
      },
    };
  }
}
