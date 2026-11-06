/**
 * What kind of document (or workbook sheet) a setup file is (Phase 37.1): a narrative proposal, a logframe matrix, a Gantt
 * work plan, a budget, an indicator table (PITT / M&E plan) or something else. Each extraction area reads only the kinds it
 * owns, so a Gantt chart's task headings never compete with the proposal for the results chain, and a budget's rows never
 * become results. One table of signals (`DOCUMENT_SIGNALS`, English, French and Spanish words); deterministic, no model.
 * A person can overrule the reading in the wizard; `OTHER` is read by every area, so an unrecognised file is never ignored.
 * Pure.
 */

export const SETUP_DOCUMENT_KINDS = ["PROPOSAL", "LOGFRAME_MATRIX", "WORK_PLAN_GANTT", "BUDGET", "INDICATOR_TABLE", "OTHER"] as const;

export type SetupDocumentKind = (typeof SETUP_DOCUMENT_KINDS)[number];

interface KindSignals {
  /** Header words: a header row that names one word from every group scores `headerScore`. */
  headerGroups: ReadonlyArray<ReadonlyArray<string>>;
  headerScore: number;
  /** Words anywhere in the text; each distinct one found scores 1. */
  words: ReadonlyArray<string>;
}

/** The one table of signals per kind; PROPOSAL and OTHER are decided by shape, not by words. */
export const DOCUMENT_SIGNALS: Readonly<Record<Exclude<SetupDocumentKind, "PROPOSAL" | "OTHER">, KindSignals>> = {
  WORK_PLAN_GANTT: {
    headerGroups: [["activity", "activities", "activite", "activites", "actividad", "actividades", "task", "tache"], ["start", "startdate", "debut", "inicio", "wk", "week", "semaine", "semana", "month", "mois", "mes"]],
    headerScore: 4,
    words: ["work plan", "workplan", "gantt", "plan de travail", "plan de trabajo", "chronogramme", "cronograma", "timeline"],
  },
  BUDGET: {
    headerGroups: [["budget", "cost", "costs", "amount", "total", "cout", "couts", "montant", "costo", "monto", "presupuesto"], ["category", "line", "item", "description", "rubrique", "categorie", "partida", "rubro", "months", "total", "unit"]],
    headerScore: 2,
    words: ["summary budget", "direct costs", "indirect costs", "personnel", "fringe", "travel", "equipment", "supplies", "budget", "couts directs", "costos directos", "grand total", "total project cost"],
  },
  LOGFRAME_MATRIX: {
    headerGroups: [["level", "results", "result", "intervention logic", "logique d'intervention", "logica de intervencion", "narrative summary", "objectives", "hierarchy"], ["indicator", "indicators", "indicateur", "indicateurs", "indicador", "indicadores", "ovi"], ["assumptions", "hypotheses", "supuestos", "means of verification", "sources of verification", "moyens de verification", "fuentes de verificacion", "baseline", "target"]],
    headerScore: 5,
    words: ["logframe", "logical framework", "cadre logique", "marco logico", "results framework", "overall objective", "specific objective", "objectif general", "objectif specifique", "objetivo general", "objetivo especifico"],
  },
  INDICATOR_TABLE: {
    headerGroups: [["indicator", "indicators", "indicateur", "indicador"], ["baseline", "base", "reference", "linea de base", "valeur de reference"], ["target", "targets", "cible", "meta", "metas"]],
    headerScore: 4,
    words: ["performance indicator", "indicator tracking", "pitt", "m&e plan", "monitoring and evaluation plan", "pmp", "disaggregation", "frequency", "data source"],
  },
};

const HEADER_SCAN_LINES = 40;

const fold = (text: string): string => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const cellsOf = (line: string): string[] => line.split("\t").map((c) => fold(c).replace(/[^a-z&' ]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);

function headerMatches(lines: ReadonlyArray<string>, groups: KindSignals["headerGroups"]): boolean {
  return lines.slice(0, HEADER_SCAN_LINES).some((line) => {
    const cells = cellsOf(line);
    if (cells.length < groups.length) return false;
    return groups.every((group) => group.some((word) => cells.some((cell) => cell === word || cell.split(" ").includes(word) || cell.startsWith(`${word} `))));
  });
}

/** Lines that are table rows (two or more tab-separated cells with text). */
const tableShare = (lines: ReadonlyArray<string>): number => {
  const filled = lines.filter((l) => l.trim());
  if (filled.length === 0) return 0;
  return filled.filter((l) => l.split("\t").filter((c) => c.trim()).length >= 2).length / filled.length;
};

const SCHEDULED_ROW = /\[scheduled \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/;

export interface DocumentKindReading {
  kind: SetupDocumentKind;
  /** The score each kind reached; the screen can say why a file was read as it was. */
  scores: Readonly<Record<SetupDocumentKind, number>>;
}

/**
 * Reads one document's (or one sheet's) text and decides its kind. A Gantt chart already turned into dated rows by the
 * document preparation is a work plan whatever its words; mostly prose is a proposal; the highest signal score wins
 * otherwise, and a tie or no signal at all is OTHER (read by every area).
 */
export function classifyDocument(text: string): DocumentKindReading {
  const lines = text.split(/\r?\n/);
  const folded = fold(text);
  const scores: Record<SetupDocumentKind, number> = { PROPOSAL: 0, LOGFRAME_MATRIX: 0, WORK_PLAN_GANTT: 0, BUDGET: 0, INDICATOR_TABLE: 0, OTHER: 0 };
  for (const [kind, signals] of Object.entries(DOCUMENT_SIGNALS) as [keyof typeof DOCUMENT_SIGNALS, KindSignals][]) {
    if (headerMatches(lines, signals.headerGroups)) scores[kind] += signals.headerScore;
    scores[kind] += signals.words.filter((w) => folded.includes(w)).length;
  }
  const scheduled = lines.filter((l) => SCHEDULED_ROW.test(l)).length;
  if (scheduled >= 3) scores.WORK_PLAN_GANTT += 10 + Math.min(scheduled, 20);
  const tables = tableShare(lines);
  const prose = lines.filter((l) => l.trim().length >= 120 && !l.includes("\t")).length;
  if (tables < 0.3 && prose >= 3) scores.PROPOSAL += 6 + Math.min(prose, 20);

  const ranked = (Object.entries(scores) as [SetupDocumentKind, number][]).filter(([k]) => k !== "OTHER").sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  const kind: SetupDocumentKind = !best || best[1] < 3 || (second && second[1] === best[1]) ? "OTHER" : best[0];
  return { kind, scores };
}

/** A workbook's text as its sheets (`# Sheet name` lines start each one); any other document is one section. */
export function splitSheets(text: string): { title: string | null; text: string }[] {
  if (!/^# /.test(text)) return [{ title: null, text }];
  const sections: { title: string | null; text: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^# /.test(line)) sections.push({ title: line.slice(2).trim(), text: `${line}\n` });
    else sections[sections.length - 1]!.text += `${line}\n`;
  }
  return sections.map((s) => ({ ...s, text: s.text.replace(/\n+$/, "") }));
}
