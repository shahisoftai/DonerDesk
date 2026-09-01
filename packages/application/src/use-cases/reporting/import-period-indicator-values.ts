import type { Result } from "@donordesk/domain";
import { DomainError, IndicatorUpdate, parsePeriodValueRows } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";

/**
 * Increment 5 — Excel/CSV → structured period indicator values.
 *
 * Two human-controlled steps over the existing IndicatorUpdate model:
 *   preview — parse + validate rows against the project's indicators (no write)
 *   confirm — persist only the user-approved rows (upsert by indicator+period)
 * Unmappable rows are reported and never silently dropped or guessed.
 */

export interface PeriodValuePreviewRow {
  rowIndex: number;
  indicatorCode: string;
  indicatorId?: string;
  periodAchievement?: string;
  cumulativeAchievement?: string;
  status: "ready" | "error";
  error?: string;
  will: "create" | "update" | "unknown";
}

export interface PeriodValuePreview {
  totalRows: number;
  readyRows: number;
  errorRows: number;
  rows: PeriodValuePreviewRow[];
}

export interface PeriodValueImportInput {
  projectId: string;
  reportingPeriodId: string;
  rows: string[][];
}

export interface ConfirmedPeriodValue {
  indicatorCode: string;
  periodAchievement?: string;
  cumulativeAchievement?: string;
}

export interface PeriodValueImportResult {
  created: number;
  updated: number;
  errors: string[];
}

export class ImportPeriodIndicatorValuesHandler {
  constructor(
    private readonly ids: IIdGenerator,
    private readonly indicators: IIndicatorRepository,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly audit: IAuditLogger,
  ) {}

  private async indicatorByCode(projectId: string, tenantId: string): Promise<Map<string, string>> {
    const r = await this.indicators.findByProject(projectId, tenantId as never);
    if (!r.ok) return new Map();
    return new Map(
      r.value
        .map((i) => ({ code: i.code, id: i.id }))
        .filter((x) => x.code)
        .map((x) => [x.code.trim().toLowerCase(), x.id]),
    );
  }

  async preview(ctx: AuthenticatedContext, input: PeriodValueImportInput): Promise<Result<PeriodValuePreview, DomainError>> {
    const parsed = parsePeriodValueRows(input.rows);
    const byCode = await this.indicatorByCode(input.projectId, ctx.tenant.tenantId.toString());

    const rows: PeriodValuePreviewRow[] = [];
    for (const row of parsed.rows) {
      const entry: PeriodValuePreviewRow = {
        rowIndex: row.rowIndex,
        indicatorCode: row.indicatorCode,
        periodAchievement: row.periodAchievement,
        cumulativeAchievement: row.cumulativeAchievement,
        status: "ready",
        will: "unknown",
      };
      if (!row.valid) {
        entry.status = "error";
        entry.error = row.error;
      } else {
        const indicatorId = byCode.get(row.indicatorCode.trim().toLowerCase());
        if (!indicatorId) {
          entry.status = "error";
          entry.error = `Indicator "${row.indicatorCode}" does not exist in this project.`;
          entry.will = "unknown";
        } else {
          entry.indicatorId = indicatorId;
          const existing = await this.updates.findByIndicatorAndPeriod(indicatorId, input.reportingPeriodId, ctx.tenant.tenantId);
          entry.will = existing.ok && existing.value ? "update" : "create";
        }
      }
      rows.push(entry);
    }

    return {
      ok: true,
      value: {
        totalRows: rows.length,
        readyRows: rows.filter((r) => r.status === "ready").length,
        errorRows: rows.filter((r) => r.status === "error").length,
        rows,
      },
    };
  }

  async confirm(ctx: AuthenticatedContext, input: { projectId: string; reportingPeriodId: string; items: ConfirmedPeriodValue[] }): Promise<Result<PeriodValueImportResult, DomainError>> {
    const byCode = await this.indicatorByCode(input.projectId, ctx.tenant.tenantId.toString());
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const item of input.items) {
      const indicatorId = byCode.get(item.indicatorCode.trim().toLowerCase());
      if (!indicatorId) {
        errors.push(`Indicator "${item.indicatorCode}" does not exist in this project.`);
        continue;
      }
      const existing = await this.updates.findByIndicatorAndPeriod(indicatorId, input.reportingPeriodId, ctx.tenant.tenantId);
      if (!existing.ok) return existing;
      if (existing.value) {
        try {
          existing.value.edit({ periodAchievement: item.periodAchievement, cumulativeAchievement: item.cumulativeAchievement });
          existing.value.submit();
        } catch (error) {
          // Verified data cannot be silently overwritten (data-integrity guard).
          errors.push(
            `Indicator "${item.indicatorCode}" is verified and cannot be auto-updated; review it in the indicator data grid first.`,
          );
          continue;
        }
        const saved = await this.updates.update(existing.value);
        if (!saved.ok) return saved;
        updated++;
      } else {
        const u = IndicatorUpdate.create({
          id: this.ids.generate(),
          tenantId: ctx.tenant.tenantId.toString(),
          indicatorId,
          reportingPeriodId: input.reportingPeriodId,
          periodAchievement: item.periodAchievement ?? "",
          cumulativeAchievement: item.cumulativeAchievement ?? "",
          createdById: ctx.tenant.userId,
        });
        u.submit();
        const saved = await this.updates.create(u);
        if (!saved.ok) return saved;
        created++;
      }
    }

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting.period_values.imported",
      entityType: "reporting_period",
      entityId: input.reportingPeriodId,
      projectId: input.projectId,
      newValue: JSON.stringify({ created, updated, errors: errors.length }),
    });

    return { ok: true, value: { created, updated, errors } };
  }
}
