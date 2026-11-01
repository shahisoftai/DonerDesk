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
  index: number;
}

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
    .filter(([k]) => !["quote", "block", "confidence", "codeSource", "level", "parentCode", "logframeCode"].includes(k))
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
      };
    });
    return { field, rows };
  }
  const list = (proposal[field as keyof ProposalData] ?? []) as ProposalData[keyof ProposalData];
  const items = Array.isArray(list) ? list : [];
  const rows = items.map((item, index): ReviewRow => {
    const path = `${field}.${index}`;
    const title = titleOf(item.value);
    return {
      path, label: title ?? `${FIELD_HEADINGS[field] ?? field} ${index + 1}`, summary: summarise(item.value),
      quote: item.sourceQuote, status: item.status, confidence: item.confidence, problems: problemsAt(problems, path), isFact: false,
      field, untitled: title === null, index,
      ...(levelOf(item.value) ? { level: levelOf(item.value)! } : {}),
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
