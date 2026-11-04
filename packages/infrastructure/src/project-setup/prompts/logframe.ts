import { oneOf, text } from "../proposed-item.js";
import { parseLists, valueKey } from "../list-area.js";
import { mergeLists } from "../extractor-shared.js";
import type { AreaExtractionSpec } from "../area-spec.js";
import { applyStructure, majorityStructure, tidyResultsChain, type LogframeNodeDef, type Proposed, type SetupLogLevel } from "@donordesk/domain";
import type { AreaRefinement } from "../area-spec.js";

const LEVELS: readonly SetupLogLevel[] = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];

/** Vocabulary the documents use for the four levels; one table, read before the strict level check. */
const LEVEL_ALIASES: Readonly<Record<string, SetupLogLevel>> = {
  IMPACT: "GOAL", OBJECTIVE: "GOAL", "OVERALL OBJECTIVE": "GOAL",
  "SPECIFIC OBJECTIVE": "OUTCOME", RESULT: "OUTCOME", "INTERMEDIATE RESULT": "OUTCOME", PURPOSE: "OUTCOME",
  "SUB-RESULT": "OUTPUT", DELIVERABLE: "OUTPUT",
};

const level = (x: unknown): SetupLogLevel | null => {
  const word = text(x)?.toUpperCase() ?? "";
  return LEVEL_ALIASES[word] ?? oneOf(word, LEVELS);
};

/** A title that only names a level ("Goal", "Outputs", "Specific objective 2") is a heading, not a result. */
const HEADING_ONLY = /^(the\s+)?(goal|goals|impact|overall objective|general objective|objectives?|specific objectives?|outcomes?|outputs?|results?|expected results?|activities|activity|purpose|deliverables?)(\s*[\divx.:-]+)?\s*:?$/i;

export const isHeadingOnly = (title: string): boolean => HEADING_ONLY.test(title.trim());

const read = (raw: Record<string, unknown>): LogframeNodeDef | null => {
  const lv = level(raw.level);
  const title = text(raw.title);
  if (!lv || !title || isHeadingOnly(title)) return null;
  const code = text(raw.code);
  return { level: lv, code, title, description: text(raw.description), parentCode: text(raw.parentCode), ...(code ? { codeSource: "DOCUMENT" as const } : {}) };
};

/** More items than this are not re-structured (the answer would not fit one small call); the first read's order stands. */
const REFINE_MAX_ITEMS = 150;

const itemsOf = (fields: Readonly<Record<string, unknown>>): Proposed<LogframeNodeDef>[] =>
  (Array.isArray(fields.logframe) ? fields.logframe : []) as Proposed<LogframeNodeDef>[];

/** One structure answer as a decision per item index; anything malformed is no decision for that item. */
function decisionsOf(answer: unknown, count: number): ({ level: SetupLogLevel | null; parent: number | null } | undefined)[] {
  const out: ({ level: SetupLogLevel | null; parent: number | null } | undefined)[] = Array.from({ length: count }, () => undefined);
  const list = answer && typeof answer === "object" ? (answer as { items?: unknown }).items : undefined;
  if (!Array.isArray(list)) return out;
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const { i, level: lv, parent } = raw as Record<string, unknown>;
    if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= count) continue;
    out[i] = { level: level(lv), parent: typeof parent === "number" && Number.isInteger(parent) ? parent : null };
  }
  return out;
}

/** Pass B (Phase 37.3): the levels and parents of the statements found, decided over those statements only, by majority. */
export const LOGFRAME_STRUCTURE: AreaRefinement = {
  promptVersion: "structure-v1",
  votes: 3,
  prompt: (fields) => {
    const items = itemsOf(fields);
    if (items.length < 2 || items.length > REFINE_MAX_ITEMS) return null;
    return [
      "These results-chain statements were read from one project's documents, in document order. Decide each one's level and its parent.",
      'Answer: {"items": [{"i": 0, "level": "GOAL|OUTCOME|OUTPUT|ACTIVITY", "parent": <i of the parent, or null>}]} with one entry per statement.',
      "Rules: exactly one GOAL (the overall aim), with parent null. An OUTCOME's parent is the GOAL. An OUTPUT's parent is the OUTCOME it delivers. An ACTIVITY's parent is the OUTPUT it produces.",
      "A parent is always one level above its child and is chosen by meaning and by the document's numbering and order; when nothing says which, use the nearest earlier statement one level up.",
      "Keep the level a statement was read with unless it is plainly wrong (a deliverable read as an outcome, a task read as an output).",
      "",
      ...items.map((item, i) => `${i}. [${item.value?.level ?? "?"}]${item.value?.code ? ` ${item.value.code}` : ""} ${item.value?.title ?? ""}`.slice(0, 260)),
    ].join("\n");
  },
  apply: (fields, answers) => {
    const items = itemsOf(fields);
    const votes = answers.map((a) => decisionsOf(a, items.length));
    const decided = majorityStructure(votes, items.length);
    return { ...fields, logframe: applyStructure(items, decided) };
  },
};

export const LOGFRAME_SPEC: AreaExtractionSpec = {
  area: "LOGFRAME",
  heavy: true,
  promptVersion: "setup-logframe-v6",
  sectionTitles: ["goals and objectives", "goal", "objective", "objectives", "specific objective", "expected results", "expected outcomes", "results framework", "logical framework", "logframe", "theory of change", "outcomes", "outputs", "statement of purpose", "project description", "program description", "description of the action", "intervention logic", "cadre logique", "resultats attendus", "objectif", "marco logico", "resultados esperados", "objetivo", "resultado"],
  // A Gantt chart is the work plan and a budget is money: their rows are not results (Phase 37.1).
  readsFrom: ["PROPOSAL", "LOGFRAME_MATRIX", "INDICATOR_TABLE"],
  // A block of a Gantt chart that was not recognised as one still carries "[scheduled <dates>]" rows.
  skipBlock: (block) => /\[scheduled \d{4}-\d{2}-\d{2}/.test(block.text),
  recallPass: true,
  refine: LOGFRAME_STRUCTURE,
  keywords: ["goal", "impact", "objective", "outcome", "output", "result", "activity", "activities", "logframe", "logical framework", "results framework"],
  instructions: [
    "Extract the results hierarchy (logframe). Answer:",
    '{"logframe": [{"level": "GOAL|OUTCOME|OUTPUT|ACTIVITY", "code": "...", "title": "...", "description": "...", "parentCode": "...", "quote": "...", "block": N, "confidence": "..."}]}',
    "Impact/overall objective is GOAL; specific objective/result/purpose is OUTCOME; an output under it is OUTPUT; a planned action is ACTIVITY.",
    "parentCode is the code of the item one level up, only when the document's numbering or layout shows it; otherwise null.",
    "If the document has no logframe table, build the hierarchy from its own structure: the stated goal is the GOAL; each numbered or named objective or result area under it is an OUTCOME; the deliverables or components that deliver it are OUTPUTs; the actions it lists are ACTIVITYs. Give every item a level.",
    "There is one GOAL. Each objective (statements under a heading such as \"Objectives\", or sections headed \"Objective 1\", \"Objective 2\") is an OUTCOME of its own: list every one, before the items that belong to it, even when the document gives it no code (use null).",
    "Only the project's own results are items. Objectives of a response plan, cluster, sector strategy, allocation or fund (HRP or strategic objectives such as \"SO1\", \"Cluster objectives\", \"HRP objectives\", \"Contribution to cluster/sector objectives\") are context the project contributes to: never list them.",
    "Template text that was never filled in (\"To be completed after identification of priority interventions\", \"[insert …]\", \"Not Selected\", a bare label such as \"Activity 1.1.1\" with no description) is not an item: skip it. When the results table is empty or unfilled, build the chain from the narrative description of the work (summary, justification, implementation).",
    "A heading that only names a level (\"Goal\", \"Objectives\", \"Outputs\", \"Activities\") is not an item: list the statement under it instead.",
    "Use the narrative description of the work for structure. Milestone, payment-schedule, pricing and budget tables are not results: do not list their rows or invent a parentCode from their numbering.",
    "parentCode is only the code of another item you list in this answer; if that parent has no code or is not listed, use null.",
    "List items in the document's order. Do not repeat an item.",
  ].join("\n"),
  parse: parseLists({ logframe: read }),
  merge: (a, b) => {
    const merged = mergeLists(valueKey("level", "code", "title"), "logframe")(a, b);
    const items = (Array.isArray(merged.logframe) ? merged.logframe : []) as { value: LogframeNodeDef }[];
    const codes = new Set(items.map((i) => i.value.code).filter((c): c is string => !!c));
    // A parent the document names but the answer does not list is no parent: the item then sits under the nearest item above it.
    const cleared = items.map((i) => (i.value.parentCode && !codes.has(i.value.parentCode) ? { ...i, value: { ...i.value, parentCode: null } } : i));
    // A statement read twice in other words is kept once, and the chain is put in tree order.
    return { ...merged, logframe: tidyResultsChain(cleared as unknown as Proposed<LogframeNodeDef>[]) };
  },
};
