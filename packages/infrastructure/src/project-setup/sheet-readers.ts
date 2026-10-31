/**
 * The deterministic shortcut (Phase 36.2 follow-up): a document that IS a logframe or work-plan sheet is read with the
 * existing parsers, not the model. Cheaper, exact, and the result goes through the same grounding as everything else —
 * each item's quote is its own sheet line, verbatim. A document that is not clearly a sheet (no header row naming the
 * columns) returns null and the model extractor runs as usual.
 */
import { parseLogframeText, parseWorkPlanText, type LogframeNodeDef, type PlannedActivityDef, type Proposed, type SourceBlock } from "@donordesk/domain";

export type SheetReader = (blocks: ReadonlyArray<SourceBlock>) => Record<string, unknown> | null;

const QUOTE_LIMIT = 400;
const HEADER_SCAN_LINES = 8;

const cells = (line: string): string[] => line.split(/[\t,;]/).map((c) => c.toLowerCase().replace(/[^a-z]/g, ""));

/** True when one of the first lines is a header row that names every one of these column groups. */
function hasHeader(lines: ReadonlyArray<string>, groups: ReadonlyArray<ReadonlyArray<string>>): boolean {
  return lines.slice(0, HEADER_SCAN_LINES).some((line) => {
    const row = cells(line);
    return groups.every((names) => names.some((n) => row.includes(n)));
  });
}

interface Located {
  line: string;
  block: SourceBlock;
}

/** The sheet line (and its block) that holds this text: the quote, so a person can find it in the document. */
function locate(blocks: ReadonlyArray<SourceBlock>, text: string): Located | undefined {
  for (const block of blocks) {
    const line = block.text.split("\n").find((l) => l.includes(text));
    if (line) return { line: line.trim().slice(0, QUOTE_LIMIT), block };
  }
  return undefined;
}

const proposed = <T>(value: T, found: Located): Proposed<T> => ({
  value,
  sourceQuote: found.line,
  sourceRef: { documentId: found.block.documentId, block: found.block.index, ...(found.block.page !== undefined ? { page: found.block.page } : {}) },
  confidence: "HIGH",
  status: "PROPOSED",
});

const allLines = (blocks: ReadonlyArray<SourceBlock>): string[] => blocks.flatMap((b) => b.text.split("\n"));

const readLogframe: SheetReader = (blocks) => {
  const lines = allLines(blocks);
  if (!hasHeader(lines, [["level", "resultlevel", "logframelevel"], ["title", "result", "resultstatement", "statement", "item"]])) return null;
  const parsed = parseLogframeText(lines.join("\n"));
  if (!parsed.structured || parsed.rows.length < 2) return null;
  const logframe = parsed.rows.flatMap((row) => {
    const found = locate(blocks, row.title);
    if (!found) return [];
    const value: LogframeNodeDef = {
      level: row.level, code: row.code ?? null, title: row.title, description: row.description ?? null, parentCode: null,
      ...(row.code ? { codeSource: "DOCUMENT" as const } : {}),
    };
    return [proposed(value, found)];
  });
  return logframe.length >= 2 ? { logframe } : null;
};

const readWorkPlan: SheetReader = (blocks) => {
  const lines = allLines(blocks);
  if (!hasHeader(lines, [["title", "activity", "activitytitle", "plannedactivity"], ["start", "startdate", "starts", "from"]])) return null;
  const parsed = parseWorkPlanText(lines.join("\n"));
  if (parsed.problems.length > 0 || parsed.rows.length === 0) return null;
  const plan = parsed.rows.flatMap((row) => {
    const found = locate(blocks, row.title);
    if (!found) return [];
    const value: PlannedActivityDef = {
      title: row.title, logframeCode: row.logframeCode ?? null, start: row.start,
      // The parser fills a missing end with the start: an end the sheet does not state stays Not stated.
      end: row.end !== row.start ? row.end : null,
      location: row.location ?? null, lead: null,
    };
    return [proposed(value, found)];
  });
  return plan.length > 0 ? { plan } : null;
};

/** A setup may use several documents; a sheet is read from the first one that is a sheet, never from lines mixed across files. */
const perDocument = (read: SheetReader): SheetReader => (blocks) => {
  const byDocument = new Map<string, SourceBlock[]>();
  for (const block of blocks) byDocument.set(block.documentId, [...(byDocument.get(block.documentId) ?? []), block]);
  for (const document of byDocument.values()) {
    const found = read(document);
    if (found) return found;
  }
  return null;
};

export const logframeSheetReader: SheetReader = perDocument(readLogframe);
export const workPlanSheetReader: SheetReader = perDocument(readWorkPlan);
