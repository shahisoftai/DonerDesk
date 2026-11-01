/**
 * The deterministic shortcut (Phase 36.2 follow-up): a document that IS a logframe or work-plan sheet is read with the
 * existing parsers, not the model. Cheaper, exact, and the result goes through the same grounding as everything else —
 * each item's quote is its own sheet line, verbatim. A document that is not clearly a sheet (no header row naming the
 * columns) returns null and the model extractor runs as usual.
 */
import { FIELD_LIMITS, fit } from "./fit-text.js";
import { parseLogframeMatrix } from "./logframe-matrix.js";
import { parseLogframeText, parseWorkPlanText, type LogframeNodeDef, type PlannedActivityDef, type Proposed, type SourceBlock } from "@donordesk/domain";

export type SheetReader = (blocks: ReadonlyArray<SourceBlock>) => Record<string, unknown> | null;

/** A sheet row is quoted whole (its dates sit in its last cell), up to the contract's quote limit. */
const QUOTE_LIMIT = 1000;
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

/**
 * A Gantt chart (document-prep turns its "x" marks into `[scheduled 2023-07-22 to 2023-07-28 (July Wk -4)]`), read by its own
 * header row (Phase 37.2): the "Activities" column is the title and the "Code" column the row's code, wherever they sit, so a
 * deliverable column ("Project Organogram") is never read as the title. A task heading ("Task- 7 Conduct Trainings") is not
 * an activity: it becomes the `group` of the rows under it, which is how they find their result. A numbered row the chart
 * does not schedule is listed with no dates (the person sees it; apply leaves it out and says so), never dropped silently.
 */
const SCHEDULE = /\[scheduled (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2}) \(/;
const TASK_HEADING = /^(task|tache|tarea|component|composante|componente)\b\s*[-:.]?\s*\d+/i;
const ROW_CODE = /^\d+(?:\.\d+)*$/;
const GANTT_HEADER_SCAN = 40;

interface GanttColumns {
  code: number | null;
  title: number;
}

function ganttColumns(lines: ReadonlyArray<string>): GanttColumns | null {
  for (const line of lines.slice(0, GANTT_HEADER_SCAN)) {
    const row = line.split("\t").map((c) => c.trim().toLowerCase());
    const title = row.findIndex((c) => /^(activit(y|ies)|activit(e|é)s?|actividad(es)?|task description|description)$/.test(c));
    if (title < 0) continue;
    const code = row.findIndex((c, i) => i !== title && /\b(code|no\.?|#|ref)\b/.test(c));
    return { code: code >= 0 ? code : null, title };
  }
  return null;
}

const quoteOf = (line: string): string => line.replace(/\t+/g, " ").trim().slice(0, QUOTE_LIMIT);

const readGanttWorkPlan: SheetReader = (blocks) => {
  const lines = allLines(blocks);
  if (lines.filter((l) => SCHEDULE.test(l)).length < 3) return null;
  const columns = ganttColumns(lines) ?? { code: 0, title: 1 };
  const plan: Proposed<PlannedActivityDef>[] = [];
  let group: string | null = null;
  for (const block of blocks) {
    for (const line of block.text.split("\n")) {
      const cells = line.split("\t");
      const code = columns.code === null ? "" : (cells[columns.code] ?? "").trim();
      const title = (cells[columns.title] ?? "").trim();
      const scheduled = SCHEDULE.exec(line);
      if (title.length < 3) continue;
      if (TASK_HEADING.test(code) || (!code && !scheduled && TASK_HEADING.test(title))) {
        group = `${code} ${title}`.trim();
        if (!scheduled) continue;
      } else if (!scheduled && !ROW_CODE.test(code)) {
        continue;
      }
      const value: PlannedActivityDef = {
        title: fit(title, FIELD_LIMITS.title), logframeCode: null, start: scheduled?.[1] ?? null, end: scheduled?.[2] ?? null, location: null, lead: null,
        group: fit(group, FIELD_LIMITS.title), planCode: fit(code || null, FIELD_LIMITS.code),
      };
      plan.push(proposed(value, { line: quoteOf(line), block }));
    }
  }
  return plan.filter((p) => p.value!.start).length >= 3 ? { plan } : null;
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

/** A logframe matrix (Phase 37.2): its rows' levels and intervention logic are the results chain. */
const readMatrixLogframe: SheetReader = (blocks) => {
  const rows = parseLogframeMatrix(blocks);
  return rows ? { logframe: rows.map((r) => r.node) } : null;
};

export const logframeSheetReader: SheetReader = perDocument((blocks) => readLogframe(blocks) ?? readMatrixLogframe(blocks));
export const workPlanSheetReader: SheetReader = perDocument((blocks) => readWorkPlan(blocks) ?? readGanttWorkPlan(blocks));
