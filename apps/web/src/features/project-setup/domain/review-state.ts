/**
 * The review screen's rules (Phase 36.4), pure: which items an area shows, how each reads in one line, and what
 * the counts say. Reads the server's proposal view; never decides what is applied (the server does). No React,
 * no clock.
 */
import { z } from "zod";
import { ProjectSetupProposalSchema, SetupProblemSchema } from "@donordesk/contracts";

export type ProposalData = z.infer<typeof ProjectSetupProposalSchema>;
export type SetupProblemView = z.infer<typeof SetupProblemSchema>;

export interface ReviewRow {
  /** Proposal path of the item ("logframe.0", "facts.name"): the key the edit call uses. */
  path: string;
  /** The item's own name for people: the title, name, or the field's label for a fact. */
  label: string;
  /** One readable line: the value, or "Not stated". */
  summary: string;
  quote: string | null;
  status: string;
  confidence: string;
  /** Problems that name this item. */
  problems: SetupProblemView[];
  /** Facts are single items with a fixed place; lists can be removed item by item. */
  isFact: boolean;
  /** The proposal field the row belongs to ("facts", "logframe", ...), so a screen can name it in its own language. */
  field: string;
  /** For a fact: which one ("name", "startDate", ...). */
  factKey?: string;
  /** A results item's level (GOAL, OUTCOME, OUTPUT, ACTIVITY), so a screen can show where it sits. */
  level?: string;
  /** A list item with no title of its own: the screen names it by its field and position. */
  untitled: boolean;
  /** For an item that hangs from a result (indicator, planned activity, budget line): where it is placed now. */
  link?: RowLink;
  /** The work-plan heading the row sits under, when the plan names one. */
  group?: string;
  /** Other readings the documents give for this fact, each with its words. */
  alternatives?: Array<{ summary: string; quote: string }>;
  /** Where the quote sits, so "Show in the document" can open the passage. */
  sourceRef?: { documentId: string; block: number };
  /** For a budget row: a detailed row or a stated total (a category has none). */
  budgetKind?: "DETAIL" | "TOTAL";
  /** For a result: its code and the code it sits under, so the screen can move it. */
  code?: string;
  parentCode?: string | null;
  index: number;
}

export interface RowLink {
  /** The result's code, or null when the item is not placed yet. */
  code: string | null;
  /** The result's title, when it is among the proposed results. */
  title: string | null;
  /** DOCUMENT, SUGGESTED (matched by wording) or PERSON (chosen in the review). */
  source: "DOCUMENT" | "SUGGESTED" | "PERSON";
}

/** A result a person may place an item under: code, level and title, in tree order. */
export interface ResultOption {
  code: string;
  level: string;
  title: string;
  parentCode?: string | null;
}

/** The fields whose items hang from a result; mirrors the domain's LINKABLE_FIELDS. */
export const LINKED_FIELDS: readonly string[] = ["indicators", "plan", "budget"];

export interface AreaRows {
  field: string;
  rows: ReviewRow[];
}

export interface ReviewCounts {
  total: number;
  accepted: number;
  rejected: number;
  notStated: number;
  pending: number;
}

const NOT_STATED = "Not stated";

/** Field key → the heading shown above its items. */
export const FIELD_HEADINGS: Readonly<Record<string, string>> = {
  facts: "Project facts",
  logframe: "Results",
  indicators: "Indicators",
  periods: "Reporting periods",
  plan: "Planned activities",
  places: "Places",
  funding: "Funding",
  budget: "Budget lines",
  risks: "Problems and risks",
};

/** Facts are read as a fixed list, in this order. */
export const FACT_LABELS: Readonly<Record<string, string>> = {
  name: "Project name", code: "Project code", donor: "Donor", countries: "Countries", sectors: "Sectors",
  startDate: "Start date", endDate: "End date", currency: "Currency", summary: "Summary",
};

const LABEL_KEYS = ["title", "name", "sourceName", "category", "kind"] as const;

function primitive(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() === "" ? null : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    const parts = v.map(primitive).filter((x): x is string => x !== null);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  return null;
}

/** One line for a proposed value: its readable fields joined; a value with nothing readable is "Not stated". */
export function summarise(value: unknown): string {
  if (value === null || value === undefined) return NOT_STATED;
  const direct = primitive(value);
  if (direct !== null) return direct;
  if (typeof value !== "object") return NOT_STATED;
  const parts = Object.entries(value as Record<string, unknown>)
    .filter(([k]) => !["quote", "block", "confidence", "codeSource", "level", "parentCode", "logframeCode", "linkSource", "group", "planCode", "kind", "ref"].includes(k))
    .map(([k, v]) => {
      const text = primitive(v);
      return text === null ? null : k === "code" ? `[${text}]` : text;
    })
    .filter((x): x is string => x !== null);
  return parts.length > 0 ? parts.join(" · ") : NOT_STATED;
}

function levelOf(value: unknown): string | null {
  const level = value && typeof value === "object" ? (value as Record<string, unknown>).level : null;
  return typeof level === "string" ? level : null;
}

function titleOf(value: unknown): string | null {
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const key of LABEL_KEYS) {
      const text = primitive(o[key]);
      if (text) return text;
    }
  }
  return null;
}

export const LEVEL_ORDER: readonly string[] = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];

/**
 * The results a result at `level` may sit under: higher levels only, never itself, never one of its own parts (that would
 * be a circle; the server refuses it too).
 */
export function parentOptions(options: ReadonlyArray<ResultOption & { parentCode?: string | null }>, code: string, level: string): ResultOption[] {
  const rank = LEVEL_ORDER.indexOf(level);
  const parentOf = new Map(options.map((o) => [o.code, o.parentCode ?? null]));
  const insideSelf = (candidate: string): boolean => {
    for (let at: string | null | undefined = candidate, n = 0; at && n < options.length; n += 1) {
      if (at === code) return true;
      at = parentOf.get(at);
    }
    return false;
  };
  return options.filter((o) => LEVEL_ORDER.indexOf(o.level) < rank && !insideSelf(o.code));
}

/** Every result that is not rejected and has a code, in the order the review lists them. */
export function resultOptions(proposal: ProposalData): ResultOption[] {
  return proposal.logframe.flatMap((n) => (n.status !== "REJECTED" && n.value?.code ? [{ code: n.value.code, level: n.value.level, title: n.value.title ?? n.value.code, parentCode: n.value.parentCode }] : []));
}

function linkOf(proposal: ProposalData, field: string, value: unknown): RowLink | undefined {
  if (!LINKED_FIELDS.includes(field) || !value || typeof value !== "object") return undefined;
  const v = value as { logframeCode?: unknown; linkSource?: unknown };
  const code = typeof v.logframeCode === "string" && v.logframeCode ? v.logframeCode : null;
  const title = code ? proposal.logframe.find((n) => n.value?.code === code)?.value?.title ?? null : null;
  const source = v.linkSource === "SUGGESTED" || v.linkSource === "PERSON" ? v.linkSource : "DOCUMENT";
  return { code, title, source };
}

function groupOf(value: unknown): string | null {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>).group : null;
  return typeof group === "string" && group.trim() ? group : null;
}

interface ItemLike {
  value: unknown;
  sourceRef?: { documentId: string; block: number; page?: number | undefined } | null | undefined;
  alternatives?: Array<{ value: unknown; sourceQuote: string }> | undefined;
}

function extrasOf(item: ItemLike): Pick<ReviewRow, "alternatives" | "sourceRef"> {
  return {
    ...(item.alternatives?.length ? { alternatives: item.alternatives.map((a) => ({ summary: summarise(a.value), quote: a.sourceQuote })) } : {}),
    ...(item.sourceRef ? { sourceRef: { documentId: item.sourceRef.documentId, block: item.sourceRef.block } } : {}),
  };
}

function budgetKindOf(field: string, value: unknown): Pick<ReviewRow, "budgetKind"> {
  const kind = field === "budget" && value && typeof value === "object" ? (value as { kind?: unknown }).kind : undefined;
  return kind === "DETAIL" || kind === "TOTAL" ? { budgetKind: kind } : {};
}

function resultPlaceOf(field: string, value: unknown): Pick<ReviewRow, "code" | "parentCode"> {
  if (field !== "logframe" || !value || typeof value !== "object") return {};
  const v = value as { code?: unknown; parentCode?: unknown };
  return typeof v.code === "string" && v.code ? { code: v.code, parentCode: typeof v.parentCode === "string" ? v.parentCode : null } : {};
}

const problemsAt = (problems: ReadonlyArray<SetupProblemView>, path: string) =>
  problems.filter((p) => p.path === path || p.path.startsWith(`${path}.`));

/** The review rows of one proposal field, in document order; facts come in their fixed order. */
export function rowsForField(proposal: ProposalData, field: string, problems: ReadonlyArray<SetupProblemView>): AreaRows {
  if (field === "facts") {
    const rows = Object.keys(FACT_LABELS).map((key): ReviewRow => {
      const item = proposal.facts[key as keyof ProposalData["facts"]];
      const path = `facts.${key}`;
      return {
        path, label: FACT_LABELS[key]!, summary: summarise(item.value), quote: item.sourceQuote, status: item.status,
        confidence: item.confidence, problems: problemsAt(problems, path), isFact: true,
        field: "facts", factKey: key, untitled: false, index: 0,
        ...extrasOf(item),
      };
    });
    return { field, rows };
  }
  // Every list field holds proposed items; `sources` (the documents) is not a review field and is never asked for here.
  const list = field === "sources" ? [] : (proposal[field as keyof ProposalData] ?? []);
  const items = (Array.isArray(list) ? list : []) as ProposalData["logframe" | "indicators" | "periods" | "plan" | "places" | "funding" | "budget" | "risks"][number][];
  const rows = items.map((item, index): ReviewRow => {
    const path = `${field}.${index}`;
    const title = titleOf(item.value);
    return {
      path, label: title ?? `${FIELD_HEADINGS[field] ?? field} ${index + 1}`, summary: summarise(item.value),
      quote: item.sourceQuote, status: item.status, confidence: item.confidence, problems: problemsAt(problems, path), isFact: false,
      field, untitled: title === null, index,
      ...(levelOf(item.value) ? { level: levelOf(item.value)! } : {}),
      ...(linkOf(proposal, field, item.value) ? { link: linkOf(proposal, field, item.value)! } : {}),
      ...(groupOf(item.value) ? { group: groupOf(item.value)! } : {}),
      ...extrasOf(item),
      ...budgetKindOf(field, item.value),
      ...resultPlaceOf(field, item.value),
    };
  });
  return { field, rows };
}

/**
 * What the person has to look at: only items the document (or they) actually state. A fact slot with nothing in it is
 * "Not stated": it is counted apart and is never "to decide".
 */
export function countRows(rows: ReadonlyArray<ReviewRow>): ReviewCounts {
  const stated = rows.filter((r) => r.summary !== NOT_STATED);
  const count = (pred: (r: ReviewRow) => boolean) => stated.filter(pred).length;
  return {
    total: stated.length,
    accepted: count((r) => r.status === "ACCEPTED" || r.status === "EDITED"),
    rejected: count((r) => r.status === "REJECTED"),
    notStated: rows.length - stated.length,
    pending: count((r) => r.status === "PROPOSED"),
  };
}

/** How many items the document (or the person) actually states across an area's fields; empty fact slots are not counted. */
export function statedCount(proposal: ProposalData, fields: readonly string[]): number {
  return fields.reduce((n, field) => n + countRows(rowsForField(proposal, field, []).rows).total, 0);
}

/** The status words for a row: an empty slot is "Not in the document", not something waiting for a decision. */
export function statusKey(row: ReviewRow): "PROPOSED" | "ACCEPTED" | "REJECTED" | "EDITED" | "NOT_IN_DOCUMENT" {
  if (row.summary === NOT_STATED && row.status === "PROPOSED") return "NOT_IN_DOCUMENT";
  return row.status as "PROPOSED" | "ACCEPTED" | "REJECTED" | "EDITED";
}

/** Confidence is a reading of a quote: it is shown only for an item that has one. */
export const showsConfidence = (row: ReviewRow): boolean => row.quote !== null && row.summary !== NOT_STATED;

/** Rows a person may act on: not already rejected, and not an empty fact they have nothing to accept. */
export const canAccept = (row: ReviewRow): boolean => row.status !== "REJECTED" && row.summary !== NOT_STATED;
export const canReject = (row: ReviewRow): boolean => row.status !== "REJECTED";

/** A stated value's words, for a person to write their own version over: the readable text, not the JSON. */
export function editableText(value: unknown): string {
  const text = summarise(value);
  return text === NOT_STATED ? "" : text;
}

/** The first row a person still has to decide, so "next" can move them there. */
export function nextPending(rows: ReadonlyArray<ReviewRow>, after?: string): ReviewRow | undefined {
  const pending = rows.filter((r) => r.status === "PROPOSED" && canAccept(r));
  if (pending.length === 0) return undefined;
  const start = after ? pending.findIndex((r) => r.path === after) + 1 : 0;
  return pending[start] ?? pending[0];
}

export type LeftOutReason = "QUOTE_NOT_FOUND" | "FIGURE_NOT_IN_QUOTE" | "DATE_NOT_IN_QUOTE" | "TEMPLATE_PLACEHOLDER";

export interface LeftOutView {
  field: string;
  text: string;
  reason: LeftOutReason;
}

interface RunLike {
  kind: string;
  area?: string | null | undefined;
  status: string;
  detail: Record<string, string | number | boolean>;
}

const REASONS: readonly LeftOutReason[] = ["QUOTE_NOT_FOUND", "FIGURE_NOT_IN_QUOTE", "DATE_NOT_IN_QUOTE", "TEMPLATE_PLACEHOLDER"];

/**
 * What the last reading of an area left out because its words were not found in the documents, and how many in all (the
 * list is capped; the count is not). Anything malformed is read as nothing left out, never as an error on the screen.
 */
export function leftOutFor(runs: ReadonlyArray<RunLike>, area: string): { items: LeftOutView[]; total: number } {
  const run = [...runs].reverse().find((r) => r.kind === "EXTRACT" && r.area === area && r.status === "FINISHED");
  if (!run) return { items: [], total: 0 };
  const total = typeof run.detail.dropped === "number" ? run.detail.dropped : 0;
  let items: LeftOutView[] = [];
  try {
    const raw = typeof run.detail.leftOut === "string" ? (JSON.parse(run.detail.leftOut) as unknown) : [];
    items = Array.isArray(raw)
      ? raw.flatMap((x) => (x && typeof x === "object" && typeof x.text === "string" && typeof x.field === "string" && REASONS.includes(x.reason) ? [{ field: x.field, text: x.text, reason: x.reason as LeftOutReason }] : []))
      : [];
  } catch {
    items = [];
  }
  return { items, total: Math.max(total, items.length) };
}
