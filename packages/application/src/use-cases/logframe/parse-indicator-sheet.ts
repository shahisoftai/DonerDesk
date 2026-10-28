import type { ParsedIndicatorSheetRow, Result } from "@donordesk/domain";
import { DomainError, parseIndicatorSheetTable } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { ISheetReader } from "../../ports/infrastructure.js";
import type { ParseIndicatorSheetInput } from "@donordesk/contracts";

export type ParsedIndicatorRow = ParsedIndicatorSheetRow;

export class ParseIndicatorSheetHandler {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly sheets: ISheetReader,
  ) {}

  async handle(ctx: AuthenticatedContext, input: ParseIndicatorSheetInput): Promise<Result<{ rows: ParsedIndicatorRow[]; warnings: string[] }, DomainError>> {
    const periodResult = await this.periods.findById(input.reportingPeriodId, ctx.tenant.tenantId);
    if (!periodResult.ok) return periodResult;
    if (!periodResult.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", input.reportingPeriodId) };

    const indicatorsResult = await this.indicators.findByProject(periodResult.value.projectId, ctx.tenant.tenantId);
    if (!indicatorsResult.ok) return indicatorsResult;

    const sheetResult = await this.sheets.readSheet({ tenantId: ctx.tenant.tenantId.toString(), sheetUrl: input.sheetUrl });
    if (!sheetResult.ok) return sheetResult;

    const { headers, rows } = sheetResult.value;
    if (headers.length === 0) return { ok: false, error: DomainError.validation("The spreadsheet has no header row") };

    // One header rule for a Google Sheet and an uploaded workbook (domain `parseIndicatorSheetTable`).
    return { ok: true, value: parseIndicatorSheetTable(headers, rows, indicatorsResult.value) };
  }
}

/**
 * Reads an uploaded workbook's table (Phase 34.2) with the same rule as a Google Sheet, matching rows to the project's indicators.
 * Nothing is saved: the screen previews it and applies it to the grid, where the same checks as typing apply.
 */
export class ParseIndicatorWorkbookHandler {
  constructor(private readonly periods: IReportingPeriodRepository, private readonly indicators: IIndicatorRepository) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string, table: ReadonlyArray<ReadonlyArray<string>>): Promise<Result<{ rows: ParsedIndicatorRow[]; warnings: string[] }, DomainError>> {
    const period = await this.periods.findById(reportingPeriodId, ctx.tenant.tenantId);
    if (!period.ok) return period;
    if (!period.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", reportingPeriodId) };
    const indicators = await this.indicators.findByProject(period.value.projectId, ctx.tenant.tenantId);
    if (!indicators.ok) return indicators;
    const [headers, ...rows] = table;
    if (!headers || headers.every((h) => !h.trim())) return { ok: false, error: DomainError.validation("The file has no header row") };
    return { ok: true, value: parseIndicatorSheetTable(headers, rows, indicators.value) };
  }
}
