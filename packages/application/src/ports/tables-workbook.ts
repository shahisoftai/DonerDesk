export interface WorkbookTable { name: string; columns: string[]; rows: Array<Array<string | number | null>> }

/** Writes tables as one spreadsheet file. The writer owns the file format; the handler owns who may ask and what is recorded. */
export interface ITablesWorkbookWriter {
  write(tables: ReadonlyArray<WorkbookTable>): Promise<Buffer>;
}
