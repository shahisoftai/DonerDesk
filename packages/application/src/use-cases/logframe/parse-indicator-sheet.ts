import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { ISheetReader } from "../../ports/infrastructure.js";
import type { ParseIndicatorSheetInput } from "@donordesk/contracts";

export interface ParsedIndicatorRow {
  indicatorId: string | null;
  code: string;
  name: string | null;
  periodAchievement: string;
  cumulativeAchievement: string;
  comments: string;
  dataSource: string;
  matched: boolean;
}

function normalize(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalize);
  const wanted = candidates.map(normalize);
  return normalized.findIndex((h) => wanted.includes(h));
}

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

    const codeCol = findColumn(headers, ["code", "indicatorcode", "indicator"]);
    const periodCol = findColumn(headers, ["periodachievement", "achievement", "periodvalue", "actual", "value", "period"]);
    const cumulativeCol = findColumn(headers, ["cumulativeachievement", "cumulative", "cumulativevalue"]);
    const commentsCol = findColumn(headers, ["comments", "notes", "remarks"]);
    const dataSourceCol = findColumn(headers, ["datasource", "source", "data source"]);

    const warnings: string[] = [];
    if (codeCol === -1) warnings.push("No indicator-code column found (expected a header such as \"Code\" or \"Indicator code\").");
    if (periodCol === -1) warnings.push("No period-achievement column found (expected a header such as \"Period achievement\" or \"Achievement\").");

    const byCode = new Map(indicatorsResult.value.map((i) => [i.code.trim().toLowerCase(), i]));
    const parsedRows: ParsedIndicatorRow[] = [];

    for (const row of rows) {
      const rawCode = codeCol >= 0 ? (row[codeCol] ?? "").trim() : "";
      if (!rawCode) continue;
      const key = rawCode.toLowerCase();
      const indicator = byCode.get(key);
      parsedRows.push({
        indicatorId: indicator?.id ?? null,
        code: rawCode,
        name: indicator?.name ?? null,
        periodAchievement: periodCol >= 0 ? (row[periodCol] ?? "").trim() : "",
        cumulativeAchievement: cumulativeCol >= 0 ? (row[cumulativeCol] ?? "").trim() : "",
        comments: commentsCol >= 0 ? (row[commentsCol] ?? "").trim() : "",
        dataSource: dataSourceCol >= 0 ? (row[dataSourceCol] ?? "").trim() : "",
        matched: Boolean(indicator),
      });
      if (!indicator) warnings.push(`Indicator code "${rawCode}" does not exist in this project's logframe.`);
    }

    return {
      ok: true,
      value: {
        rows: parsedRows,
        warnings,
      },
    };
  }
}
