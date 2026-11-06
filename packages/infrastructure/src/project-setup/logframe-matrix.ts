/**
 * A logframe matrix read row by row (Phase 37.2): the EU / GCF / USAID layout whose first columns hold the level ("Overall
 * objective", "Specific objective 1", "Output 1.1", "Activities", in English, French or Spanish) and the intervention logic,
 * and whose other columns hold the indicators, baselines, targets, sources of verification and assumptions. One parse feeds
 * two readers — the results chain (`readLogframeMatrix`) and the indicators (`readMatrixIndicators`) — so an indicator is
 * tied to the result on its own row and the two can never disagree. A code the matrix does not give is made here from the
 * tree (G1, OC1, OP1.1) and marked GENERATED; a row the parse cannot place is left to the model. Pure.
 */
import { FIELD_LIMITS, fit } from "./fit-text.js";
import type { IndicatorDef, LogframeNodeDef, Proposed, SetupLogLevel, SourceBlock } from "@donordesk/domain";

const fold = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Level words at the start of a cell, longest first (so "specific objective" wins over "objective"). */
const LEVEL_WORDS: ReadonlyArray<readonly [string, SetupLogLevel]> = ([
  ["overall objective", "GOAL"], ["general objective", "GOAL"], ["impact", "GOAL"], ["goal", "GOAL"], ["objectif global", "GOAL"], ["objectif general", "GOAL"], ["objetivo general", "GOAL"], ["fin", "GOAL"],
  ["specific objective", "OUTCOME"], ["outcome", "OUTCOME"], ["purpose", "OUTCOME"], ["intermediate result", "OUTCOME"], ["objectif specifique", "OUTCOME"], ["effet", "OUTCOME"], ["objetivo especifico", "OUTCOME"], ["proposito", "OUTCOME"],
  ["output", "OUTPUT"], ["expected result", "OUTPUT"], ["result", "OUTPUT"], ["produit", "OUTPUT"], ["resultat", "OUTPUT"], ["producto", "OUTPUT"], ["resultado", "OUTPUT"],
  ["activities", "ACTIVITY"], ["activity", "ACTIVITY"], ["activites", "ACTIVITY"], ["activite", "ACTIVITY"], ["actividades", "ACTIVITY"], ["actividad", "ACTIVITY"],
] as const).slice().sort((a, b) => b[0].length - a[0].length);

const LOGIC_HEADERS = ["intervention logic", "logique d'intervention", "logique d intervention", "logica de intervencion", "narrative summary", "results chain", "results", "result statement", "objectives", "description", "resume narratif", "resumen narrativo"];
const INDICATOR_HEADERS = ["indicator", "indicators", "objectively verifiable indicators", "ovi", "indicateur", "indicateurs", "indicador", "indicadores"];
const BASELINE_HEADERS = ["baseline", "baseline value", "valeur de reference", "situation de reference", "linea de base"];
const TARGET_HEADERS = ["target", "targets", "cible", "valeur cible", "meta", "metas"];
const VERIFICATION_HEADERS = ["means of verification", "sources of verification", "sources and means of verification", "moyens de verification", "sources de verification", "fuentes de verificacion", "medios de verificacion"];

const QUOTE_LIMIT = 1000;
const PREFIX: Readonly<Record<SetupLogLevel, string>> = { GOAL: "G", OUTCOME: "OC", OUTPUT: "OP", ACTIVITY: "A" };
const RANK: Readonly<Record<SetupLogLevel, number>> = { GOAL: 0, OUTCOME: 1, OUTPUT: 2, ACTIVITY: 3 };

interface MatrixColumns { logic: number; level: number | null; indicator: number | null; baseline: number | null; target: number | null; verification: number | null }

function columnsOf(line: string): MatrixColumns | null {
  const cells = line.split("\t").map(fold);
  const find = (words: readonly string[]) => {
    const at = cells.findIndex((c) => words.includes(c));
    return at >= 0 ? at : null;
  };
  const logic = find(LOGIC_HEADERS);
  const indicator = find(INDICATOR_HEADERS);
  if (logic === null || indicator === null) return null;
  // A column before the logic with no header (or "level") holds the level words.
  const level = logic > 0 && (cells[logic - 1] === "" || cells[logic - 1] === "level" || cells[logic - 1] === "niveau" || cells[logic - 1] === "nivel") ? logic - 1 : null;
  return { logic, level, indicator, baseline: find(BASELINE_HEADERS), target: find(TARGET_HEADERS), verification: find(VERIFICATION_HEADERS) };
}

/** The level a cell starts with and what follows it ("Output 1.2: Clinics set up" → OUTPUT, "1.2", "Clinics set up"). */
export function levelCell(raw: string): { level: SetupLogLevel; code: string | null; rest: string } | null {
  const text = raw.trim();
  const folded = fold(text);
  for (const [word, level] of LEVEL_WORDS) {
    if (!folded.startsWith(word)) continue;
    const after = text.slice(word.length).replace(/^s?\b/, "");
    const m = /^\s*(?:\(?([A-Za-z]{0,3}\d+(?:\.\d+)*)\)?)?\s*[:.\-–)]?\s*(.*)$/s.exec(after);
    return { level, code: m?.[1] ?? null, rest: (m?.[2] ?? "").trim() };
  }
  return null;
}

export interface MatrixNode { node: Proposed<LogframeNodeDef>; indicators: Proposed<IndicatorDef>[] }

const cellAt = (cells: ReadonlyArray<string>, at: number | null): string | null => {
  if (at === null) return null;
  const t = (cells[at] ?? "").trim();
  return t === "" || /^(n\/?a|-|–)$/i.test(t) ? null : t;
};

const quoteOf = (line: string): string => line.replace(/\t+/g, " ").trim().slice(0, QUOTE_LIMIT);

const refOf = (block: SourceBlock) => ({ documentId: block.documentId, block: block.index, ...(block.page !== undefined ? { page: block.page } : {}) });

/** The matrix of one document, or null when it is not one (no header naming the logic and the indicators, or fewer than two levels). */
export function parseLogframeMatrix(blocks: ReadonlyArray<SourceBlock>): MatrixNode[] | null {
  const lines = blocks.flatMap((block) => block.text.split("\n").map((line) => ({ line, block })));
  const headerAt = lines.findIndex(({ line }) => columnsOf(line) !== null);
  if (headerAt < 0) return null;
  const columns = columnsOf(lines[headerAt]!.line)!;
  const out: MatrixNode[] = [];
  const counters = new Map<string, number>();
  const lastAt: (LogframeNodeDef | undefined)[] = [];
  let current: MatrixNode | null = null;
  let sectionLevel: SetupLogLevel | null = null;
  for (const { line, block } of lines.slice(headerAt + 1)) {
    if (/^# /.test(line)) break;
    const cells = line.split("\t");
    const levelText = cellAt(cells, columns.level);
    const logic = cellAt(cells, columns.logic);
    const fromLevel = levelText ? levelCell(levelText) : null;
    const fromLogic = !fromLevel && logic ? levelCell(logic) : null;
    const found = fromLevel ?? fromLogic;
    if (found) sectionLevel = found.level;
    const title = fromLevel ? logic ?? (found!.rest || null) : fromLogic ? found!.rest || null : null;
    const startsNode = found !== null && title !== null && title.length >= 3;
    // A row with only a statement under a level heading ("Activities" then one row per activity) is another item of that level.
    const continuation = !found && logic !== null && sectionLevel === "ACTIVITY" && logic.length >= 3;
    if (startsNode || continuation) {
      const level = found?.level ?? sectionLevel!;
      const rank = RANK[level];
      const parent = rank > 0 ? lastAt.slice(0, rank).reverse().find((n) => n !== undefined) ?? null : null;
      let code = found?.code ?? null;
      let codeSource: "DOCUMENT" | "GENERATED" = "DOCUMENT";
      if (!code) {
        const scope = parent?.code ?? "";
        const n = (counters.get(`${level}:${scope}`) ?? 0) + 1;
        counters.set(`${level}:${scope}`, n);
        const numbering = scope && /\d/.test(scope) ? `${scope.replace(/^[A-Za-z]+/, "")}.${n}` : String(n);
        code = `${PREFIX[level]}${numbering}`;
        codeSource = "GENERATED";
      }
      const value: LogframeNodeDef = { level, code: fit(code, FIELD_LIMITS.code), title: fit((title ?? logic)!, FIELD_LIMITS.title), description: null, parentCode: parent?.code ?? null, codeSource };
      lastAt[rank] = value;
      lastAt.length = rank + 1;
      current = { node: { value, sourceQuote: quoteOf(line), sourceRef: refOf(block), confidence: "HIGH", status: "PROPOSED" }, indicators: [] };
      out.push(current);
    }
    const indicator = cellAt(cells, columns.indicator);
    if (current && indicator && indicator.length >= 6 && !levelCell(indicator)) {
      const target = cellAt(cells, columns.target);
      const value: IndicatorDef = {
        code: null, title: fit(indicator, FIELD_LIMITS.title), logframeCode: current.node.value!.code, type: /%|percent|pourcent|porcentaje/i.test(`${indicator} ${target ?? ""}`) ? "PERCENTAGE" : null,
        unit: null, baseline: fit(cellAt(cells, columns.baseline), FIELD_LIMITS.figure), target: fit(target, FIELD_LIMITS.figure), targetSchedule: null, frequency: null, direction: null, disaggregation: null,
        meansOfVerification: fit(cellAt(cells, columns.verification), FIELD_LIMITS.verification), linkSource: "DOCUMENT",
      };
      current.indicators.push({ value, sourceQuote: quoteOf(line), sourceRef: refOf(block), confidence: "HIGH", status: "PROPOSED" });
    }
  }
  return new Set(out.map((n) => n.node.value!.level)).size >= 2 ? out : null;
}
