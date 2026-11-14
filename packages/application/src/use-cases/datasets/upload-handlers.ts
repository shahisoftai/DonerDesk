import { createHash } from "node:crypto";
import {
  DomainError, KITS, MAX_FILE_BYTES, PREVIEW_ROWS, bestKit, detectHeaderRow, describeSteps, matchKit, planRefresh, problemsSheet, tableFromWorkbook,
  type CheckConfig, type ColumnDef, type Finding, type RefreshMode, type Result, type TidyStep,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDatasetRowStore, IWorkbookReader } from "../../ports/datasets.js";
import { can, fail, loadDataset, ok, ownsUpload, placeRegistry, uploadKey, type DatasetDeps } from "./dataset-shared.js";
import { placeIssues, runPipeline, withKit } from "./pipeline.js";

/**
 * Bringing a table in (§4.2 screens 1–6). Nothing is saved by these handlers except the uploaded file itself (kept under the person's
 * own upload folder so the next step can read it again); the dataset is created by `SaveDatasetHandler`.
 */
export interface UploadPreview {
  fileKey: string;
  fileName: string;
  sheets: Array<{ name: string; rows: number; preview: string[][] }>;
  sheet: string;
  headerRow: number;
}

const XLSX_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export class UploadDatasetFileHandler {
  constructor(private readonly deps: DatasetDeps, private readonly reader: IWorkbookReader) {}

  async handle(ctx: AuthenticatedContext, file: { name: string; bytes: Buffer }): Promise<Result<UploadPreview, DomainError>> {
    if (!can(ctx, "dataset.manage") && !can(ctx, "dataset.contribute")) return fail(DomainError.forbidden("You cannot bring in datasets"));
    if (file.bytes.length === 0) return fail(DomainError.validation("The file is empty."));
    if (file.bytes.length > MAX_FILE_BYTES) return fail(DomainError.validation(`The file is ${(file.bytes.length / 1048576).toFixed(1)} MB; the most a dataset takes is ${MAX_FILE_BYTES / 1048576} MB.`));
    // The type is told from the bytes, never from the name the sender gave: an xlsx is a zip; anything else must read as text.
    const zip = XLSX_MAGIC.every((b, i) => file.bytes[i] === b);
    const name = (file.name.split(/[\\/]/).pop() ?? "upload").slice(0, 200);
    if (!zip && file.bytes.subarray(0, 4096).includes(0)) return fail(DomainError.validation("This is not a spreadsheet: upload an .xlsx or .csv file."));
    const wb = await this.reader.read(file.bytes, zip ? name.replace(/\.[^.]*$/, ".xlsx") : name.replace(/\.[^.]*$/, ".csv"));
    if (!wb.ok) return wb;
    if (wb.value.sheets.length === 0) return fail(DomainError.validation("The file has no sheet with data in it."));
    const id = this.deps.ids.generate();
    const key = uploadKey(ctx, id);
    await this.deps.storage.put({ key, body: file.bytes, contentType: zip ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv" });
    const best = wb.value.sheets.slice().sort((a, b) => b.cells.length - a.cells.length)[0]!;
    return ok({
      fileKey: key, fileName: name,
      sheets: wb.value.sheets.map((s) => ({ name: s.name, rows: s.cells.length, preview: s.cells.slice(0, 8).map((r) => r.slice(0, 12).map((c) => (c === null ? "" : String(c)))) })),
      sheet: best.name, headerRow: detectHeaderRow(best.cells),
    });
  }
}

export interface CheckUploadInput {
  fileKey: string;
  steps: TidyStep[];
  columns?: ColumnDef[] | undefined;
  checks?: CheckConfig[] | undefined;
  kitKey?: string | undefined;
  /** Checking a new upload for an existing dataset: the diff against its current version. */
  datasetId?: string | undefined;
  mode?: RefreshMode | undefined;
  projectCountry?: string | undefined;
}

export interface CheckUploadResult {
  columns: ColumnDef[];
  proposals: Array<{ key: string; reasons: string[]; confidence: number; samples: string[] }>;
  personal: Array<{ header: string; label: string; reason: string }>;
  steps: string[];
  preview: { headers: string[]; rows: string[][] };
  rowCount: number;
  findings: Finding[];
  places: Array<{ value: string; status: string; rows: number }>;
  placesMatched: number;
  kit?: { key: string; title: string; sentence: string; matched: number; total: number; mapping: Record<string, string>; reviewState: string } | undefined;
  kitSuggestion?: { key: string; title: string; sentence: string } | undefined;
  diff?: { summary: string; added: number; changed: number; removed: number; newPeriods: string[] } | undefined;
  problem?: string | undefined;
}

const cellText = (c: unknown): string => (c === null || c === undefined ? "" : String(c));

/** Re-reads the uploaded file with the person's steps and columns, and answers everything the confirm, fix and check screens show. */
export class CheckDatasetUploadHandler {
  constructor(private readonly deps: DatasetDeps, private readonly reader: IWorkbookReader, private readonly rows: IDatasetRowStore) {}

  async handle(ctx: AuthenticatedContext, input: CheckUploadInput): Promise<Result<CheckUploadResult, DomainError>> {
    if (!ownsUpload(ctx, input.fileKey)) return fail(DomainError.notFound("Upload", input.fileKey));
    let bytes: Buffer;
    try { bytes = await this.deps.storage.read(input.fileKey); } catch { return fail(DomainError.validation("The uploaded file is no longer here. Upload it again.")); }
    const wb = await this.reader.read(bytes, input.fileKey);
    if (!wb.ok) return wb;
    const places = await placeRegistry(this.deps.places, ctx);
    const first = runPipeline({ workbook: wb.value, steps: input.steps, columns: input.columns, places, country: input.projectCountry });
    let columns = first.columns, checks = input.checks ?? [];
    let kit: CheckUploadResult["kit"];
    if (input.kitKey && !input.columns?.length) {
      const k = withKit(first.columns, input.kitKey);
      columns = k.columns; checks = [...checks, ...k.checks];
      const match = matchKit(first.columns, KITS.find((x) => x.key === input.kitKey)!);
      const def = KITS.find((x) => x.key === input.kitKey)!;
      kit = { key: def.key, title: def.title, sentence: match.sentence, matched: match.matched, total: def.columns.length, mapping: k.mapping, reviewState: def.reviewState };
    }
    const result = kit || checks.length ? runPipeline({ workbook: wb.value, steps: input.steps, columns, checks, places, country: input.projectCountry }) : first;
    const suggestion = !input.kitKey && !input.columns?.length ? bestKit((k) => matchKit(first.columns, k)) : undefined;

    let diff: CheckUploadResult["diff"];
    if (input.datasetId && !result.problem) {
      const ds = await loadDataset(this.deps, ctx, input.datasetId);
      if (!ds.ok) return ds;
      if (ds.value.currentVersionId) {
        const current = await this.rows.read(ctx.tenant.tenantId, ds.value.currentVersionId);
        if (current.ok) { const d = planRefresh(current.value, result.rows, result.columns, input.mode ?? "REPLACE").diff; diff = { summary: d.summary, added: d.added, changed: d.changed, removed: d.removed, newPeriods: d.newPeriods }; }
      }
    }
    const preview = { headers: result.table.headers, rows: result.table.rows.slice(0, PREVIEW_ROWS).map((r) => r.map(cellText)) };
    return ok({
      columns: result.columns,
      proposals: (first.proposals ?? []).map((p) => ({ key: p.column.key, reasons: p.reasons, confidence: Math.round(p.confidence * 100) / 100, samples: p.samples.map(cellText) })),
      personal: result.personal.map((p) => ({ header: p.header, label: p.label, reason: p.reason })),
      steps: describeSteps(input.steps),
      preview, rowCount: result.rows.length, findings: result.findings,
      places: placeIssues(result.rows, result.columns, result.placeMatches).slice(0, 100),
      placesMatched: [...result.placeMatches.values()].filter((m) => m.status === "RESOLVED").length,
      ...(kit ? { kit } : {}),
      ...(suggestion ? { kitSuggestion: { key: suggestion.kit.key, title: suggestion.kit.title, sentence: suggestion.match.sentence } } : {}),
      ...(diff ? { diff } : {}),
      ...(result.problem ? { problem: result.problem } : {}),
    });
  }
}

/** The person's own sheet back with a Problems column (§3.5), for an upload being checked or a saved version. */
export class DatasetProblemsSheetHandler {
  constructor(private readonly deps: DatasetDeps, private readonly reader: IWorkbookReader) {}
  async handle(ctx: AuthenticatedContext, input: CheckUploadInput & { all?: boolean }): Promise<Result<{ headers: string[]; rows: string[][] }, DomainError>> {
    if (!ownsUpload(ctx, input.fileKey)) return fail(DomainError.notFound("Upload", input.fileKey));
    let bytes: Buffer;
    try { bytes = await this.deps.storage.read(input.fileKey); } catch { return fail(DomainError.validation("The uploaded file is no longer here. Upload it again.")); }
    const wb = await this.reader.read(bytes, input.fileKey);
    if (!wb.ok) return wb;
    const r = runPipeline({ workbook: wb.value, steps: input.steps, columns: input.columns, checks: input.checks ?? [], places: await placeRegistry(this.deps.places, ctx) });
    const sheet = problemsSheet(r.table, r.findings, r.firstFileRow, !input.all);
    return ok({ headers: sheet.headers, rows: sheet.rows.map((row) => row.map(cellText)) });
  }
}

export const fileHash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
export { tableFromWorkbook };
