import type { Result } from "@donordesk/domain";
import { DomainError, Indicator, parseIndicatorText, type IndicatorType } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ILogframeRepository, IIndicatorRepository } from "../../ports/logframe.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { ImportIndicatorsTextInput } from "@donordesk/contracts";

const MAX_IMPORT_ROWS = 1000;

export interface ImportedIndicator {
  id: string;
  logframeItemId: string;
  code: string;
  name: string;
  type: IndicatorType;
  baseline: string;
  target: string;
  unit?: string;
}

export interface ImportIndicatorsResult {
  created: number;
  skipped: number;
  warnings: string[];
  items: ImportedIndicator[];
}

/**
 * Parses indicator content (from an upload or template) into structured rows
 * and persists them as real Indicator records. Each indicator is attached to
 * the logframe item whose Code matches the indicator's Code; rows that cannot
 * be matched, or whose code already exists in the project, are skipped with a
 * warning instead of failing the whole import.
 */
export class ImportIndicatorsHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly logframe: ILogframeRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(
    ctx: AuthenticatedContext,
    input: ImportIndicatorsTextInput,
  ): Promise<Result<ImportIndicatorsResult, DomainError>> {
    const { rows, warnings, structured } = parseIndicatorText(input.text);
    if (rows.length === 0 || !structured) {
      return {
        ok: false,
        error: DomainError.validation(
          "No indicators could be parsed. Expected columns for Code, Name, Type, Baseline, and Target.",
        ),
      };
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return {
        ok: false,
        error: DomainError.validation(
          `Too many indicators (${rows.length}). Imports are limited to ${MAX_IMPORT_ROWS} rows; split the file and import in batches.`,
        ),
      };
    }

    const items = await this.logframe.findByProject(input.projectId, ctx.tenant.tenantId);
    if (!items.ok) return items;
    const itemByCode = new Map<string, string>();
    for (const item of items.value) {
      if (!item.code) continue;
      itemByCode.set(item.code.trim().toLowerCase(), item.id);
    }

    const existing = await this.indicators.findByProject(input.projectId, ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    const existingCodes = new Set(
      existing.value
        .map((i) => i.code)
        .filter((c): c is string => Boolean(c))
        .map((c) => c.trim().toLowerCase()),
    );

    const created: ImportedIndicator[] = [];
    let skipped = 0;
    const importWarnings: string[] = [...warnings];

    for (const row of rows) {
      const codeKey = row.code.trim().toLowerCase();
      if (existingCodes.has(codeKey)) {
        skipped++;
        continue;
      }
      const logframeItemId = itemByCode.get(codeKey);
      if (!logframeItemId) {
        importWarnings.push(`Indicator "${row.code}" does not match any logframe item code in this project; skipped.`);
        skipped++;
        continue;
      }

      const id = this.ids.generate();
      const ind = Indicator.create({
        id,
        tenantId: ctx.tenant.tenantId.toString(),
        projectId: input.projectId,
        logframeItemId,
        code: row.code,
        name: row.name,
        type: row.type,
        baseline: row.baseline,
        target: row.target,
        unit: row.unit,
        meansOfVerification: row.meansOfVerification,
        dataSource: row.dataSource,
        frequency: row.frequency,
        disaggregationRequired: row.disaggregationRequired,
      });
      const saved = await this.indicators.create(ind);
      if (!saved.ok) return saved;

      existingCodes.add(codeKey);
      created.push({
        id,
        logframeItemId,
        code: ind.code,
        name: ind.name,
        type: ind.type,
        baseline: ind.baseline,
        target: ind.target,
        unit: ind.unit,
      });
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "logframe.indicators.imported",
      entityType: "indicator",
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
