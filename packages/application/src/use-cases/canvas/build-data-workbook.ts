import { DomainError, ok, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ITablesWorkbookWriter, WorkbookTable } from "../../ports/tables-workbook.js";

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_TABLES = 30;
const MAX_ROWS = 5000;

export interface DataWorkbookDto { bytes: Buffer; fileName: string; contentType: string }

/** A spreadsheet of the tables the person is already looking at (Phase 48.9). Nothing is read from the records here: it only changes the format. */
export class BuildDataWorkbookHandler {
  constructor(private readonly writer: ITablesWorkbookWriter, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, input: { title: string; tables: WorkbookTable[] }): Promise<Result<DataWorkbookDto, DomainError>> {
    if (input.tables.length === 0) return { ok: false, error: DomainError.validation("There are no tables to put in a workbook.") };
    if (input.tables.length > MAX_TABLES) return { ok: false, error: DomainError.validation(`A workbook holds at most ${MAX_TABLES} tables.`) };
    if (input.tables.some((t) => t.rows.length > MAX_ROWS)) return { ok: false, error: DomainError.validation(`A table holds at most ${MAX_ROWS} rows.`) };
    const bytes = await this.writer.write(input.tables);
    // Counts only: never the figures or the names a person typed.
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "canvas.data_exported", entityType: "canvas", entityId: "workbook", newValue: JSON.stringify({ tables: input.tables.length, rows: input.tables.reduce((t, x) => t + x.rows.length, 0) }) });
    const safe = input.title.replace(/[^\p{L}\p{N} _.-]+/gu, "").trim().slice(0, 80) || "visual";
    return ok({ bytes, fileName: `${safe}-data.xlsx`, contentType: XLSX_CONTENT_TYPE });
  }
}
