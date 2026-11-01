/**
 * The indicator table shortcut (Phase 37.2): a PITT, an M&E plan or a logframe matrix with indicator columns is read by its
 * own header row — Indicator, Code, Baseline, Target, Unit, Frequency, Means of verification, Result — row by row, with the
 * row itself as the quote. Figures are copied as written (a missing cell is Not stated, never 0); the result column gives the
 * link only when it holds a code, otherwise the link is left to `linkProposal`. Headers are matched in English, French and
 * Spanish. The model still reads the documents the table does not come from (indicators named in the narrative).
 */
import { FIELD_LIMITS, fit } from "./fit-text.js";
import type { IndicatorDef, Proposed, SourceBlock } from "@donordesk/domain";
import type { PartialSheetRead, PartialSheetReader } from "./budget-sheet-reader.js";
import { parseLogframeMatrix } from "./logframe-matrix.js";

type Column = "title" | "code" | "baseline" | "target" | "unit" | "frequency" | "verification" | "result" | "disaggregation";

/** Header words per column, folded (no accents, lower case); the first column a header matches wins. */
const HEADERS: Readonly<Record<Column, readonly string[]>> = {
  title: ["indicator", "indicators", "indicator name", "indicator title", "performance indicator", "indicateur", "indicateurs", "indicador", "indicadores", "ovi"],
  code: ["indicator code", "code", "no", "no.", "ref", "#", "id", "code indicateur", "codigo"],
  baseline: ["baseline", "baseline value", "base line", "valeur de reference", "situation de reference", "reference", "linea de base", "linea base"],
  target: ["target", "targets", "end target", "lop target", "life of project target", "final target", "cible", "valeur cible", "meta", "metas"],
  unit: ["unit", "unit of measure", "unite", "unidad"],
  frequency: ["frequency", "reporting frequency", "frequence", "periodicite", "frecuencia"],
  verification: ["means of verification", "sources of verification", "data source", "source", "moyens de verification", "sources de verification", "fuentes de verificacion", "medios de verificacion"],
  result: ["result", "result code", "logframe code", "output", "outcome", "level", "resultat", "resultado"],
  disaggregation: ["disaggregation", "disaggregated by", "desagregation", "desagregacion"],
};

const QUOTE_LIMIT = 1000;
const HEADER_SCAN = 15;
const CODE_LIKE = /^[A-Za-z]{0,4}[-. ]?\d+(?:[.-]\d+)*[a-z]?$/;

const fold = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[:*]/g, "").replace(/\s+/g, " ").trim();

function columnsOf(line: string): Partial<Record<Column, number>> | null {
  const cells = line.split("\t").map(fold);
  const found: Partial<Record<Column, number>> = {};
  const taken = new Set<number>();
  for (const column of Object.keys(HEADERS) as Column[]) {
    const at = cells.findIndex((cell, i) => !taken.has(i) && HEADERS[column].includes(cell));
    if (at >= 0) {
      found[column] = at;
      taken.add(at);
    }
  }
  return found.title !== undefined && (found.baseline !== undefined || found.target !== undefined) ? found : null;
}

const cell = (cells: ReadonlyArray<string>, at: number | undefined): string | null => {
  if (at === undefined) return null;
  const t = (cells[at] ?? "").trim();
  return t === "" || /^(n\/?a|-|–|tbd|tbc)$/i.test(t) ? null : t;
};

function readDocument(blocks: ReadonlyArray<SourceBlock>): Proposed<IndicatorDef>[] {
  const lines = blocks.flatMap((block) => block.text.split("\n").map((line) => ({ line, block })));
  const headerAt = lines.slice(0, HEADER_SCAN * 10).findIndex(({ line }) => columnsOf(line) !== null);
  if (headerAt < 0) return [];
  const columns = columnsOf(lines[headerAt]!.line)!;
  const out: Proposed<IndicatorDef>[] = [];
  for (const { line, block } of lines.slice(headerAt + 1)) {
    if (/^# /.test(line)) break;
    const cells = line.split("\t");
    const title = cell(cells, columns.title);
    if (!title || title.length < 6 || !/[a-z]/i.test(title)) continue;
    const baseline = cell(cells, columns.baseline);
    const target = cell(cells, columns.target);
    const unit = cell(cells, columns.unit);
    const result = cell(cells, columns.result);
    const code = cell(cells, columns.code);
    const disaggregation = cell(cells, columns.disaggregation);
    const value: IndicatorDef = {
      code: fit(code, FIELD_LIMITS.code), title: fit(title, FIELD_LIMITS.title), logframeCode: result && CODE_LIKE.test(result) ? fit(result, FIELD_LIMITS.code) : null,
      type: /%|percent|pourcent|porcentaje/i.test(`${unit ?? ""} ${title} ${target ?? ""}`) ? "PERCENTAGE" : null,
      unit: fit(unit, FIELD_LIMITS.unit), baseline: fit(baseline, FIELD_LIMITS.figure), target: fit(target, FIELD_LIMITS.figure), targetSchedule: null, frequency: fit(cell(cells, columns.frequency), FIELD_LIMITS.frequency), direction: null,
      disaggregation: disaggregation ? disaggregation.split(/[,;/]| and /).map((d) => d.trim()).filter(Boolean).slice(0, 10) : null,
      meansOfVerification: fit(cell(cells, columns.verification), FIELD_LIMITS.verification),
      ...(code ? { codeSource: "DOCUMENT" as const } : {}),
    };
    out.push({
      value, sourceQuote: line.replace(/\t+/g, " ").trim().slice(0, QUOTE_LIMIT),
      sourceRef: { documentId: block.documentId, block: block.index, ...(block.page !== undefined ? { page: block.page } : {}) },
      confidence: "HIGH", status: "PROPOSED",
    });
  }
  return out;
}

/** Indicators from every document that holds an indicator table; the narrative documents are left to the model. */
export const readIndicatorSheet: PartialSheetReader = (blocks): PartialSheetRead | null => {
  const byDocument = new Map<string, SourceBlock[]>();
  for (const block of blocks) byDocument.set(block.documentId, [...(byDocument.get(block.documentId) ?? []), block]);
  const indicators: Proposed<IndicatorDef>[] = [];
  const documentIds: string[] = [];
  for (const [id, documentBlocks] of byDocument) {
    // A logframe matrix ties each indicator to the result on its row; any other table is read by its own headers.
    const matrix = parseLogframeMatrix(documentBlocks);
    const read = matrix ? matrix.flatMap((row) => row.indicators) : readDocument(documentBlocks);
    if (read.length >= 2) {
      indicators.push(...read);
      documentIds.push(id);
    }
  }
  return indicators.length > 0 ? { fields: { indicators }, documentIds, combine: "APPEND" } : null;
};
