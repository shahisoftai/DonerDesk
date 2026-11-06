/**
 * Where a block's figures come from (Phase 45). One vocabulary replaces the dashboards' per-kind query fields and the
 * infographics' `BigNumberSource` / `StoryFacts`. A binding never holds data: it names a question the data sheet answers
 * (`DATASET`, `REPORT`), the project a block reads (`PROJECT`; the question itself stays in the block's settings, so it is
 * written once), or a figure a person typed and must source (`MANUAL`), or text a model proposed and a person has
 * not yet accepted (`AI_DRAFT`). Every figure still goes through `resolveDataset`, so the honesty rules (a gap is never 0,
 * a rate is never summed, units never share an axis) hold for every block.
 */
import type { DatasetQuery } from "../reporting/dataset-query.js";
import type { ReportQuery } from "../reporting/report-query.js";

export type Binding =
  | { type: "PROJECT"; slot: string; projectId: string }
  | { type: "DATASET"; slot: string; projectId: string; query: DatasetQuery }
  | { type: "REPORT"; slot: string; projectId: string; query: ReportQuery }
  | { type: "MANUAL"; slot: string; value: string; sourceNote?: string | undefined }
  | { type: "AI_DRAFT"; slot: string; text: string; acceptedAt?: string | undefined };

export const BINDING_TYPES = ["PROJECT", "DATASET", "REPORT", "MANUAL", "AI_DRAFT"] as const;
export type BindingType = (typeof BINDING_TYPES)[number];

/** What a block can be given in one named place: which binding types, how many, and (for a dataset) which data shapes. */
export interface SlotDef {
  slot: string;
  accepts: ReadonlyArray<BindingType>;
  min: number;
  max: number;
  /** The filters (dimensions) this slot honours; a filter outside the list never changes the block. */
  honours: ReadonlyArray<"PERIOD" | "PROJECT" | "PLACE" | "SECTOR" | "STATUS" | "DRAFTS">;
}

export interface BindingProblem { slot: string; message: string }

/** Checks a block's bindings against its slots. Pure; the same function runs in the editor and on save. */
export function bindingProblems(slots: ReadonlyArray<SlotDef>, bindings: ReadonlyArray<Binding>): BindingProblem[] {
  const out: BindingProblem[] = [];
  const known = new Set(slots.map((s) => s.slot));
  for (const b of bindings) if (!known.has(b.slot)) out.push({ slot: b.slot, message: `This block has no place called "${b.slot}".` });
  for (const s of slots) {
    const mine = bindings.filter((b) => b.slot === s.slot);
    if (mine.length < s.min) out.push({ slot: s.slot, message: s.min === 1 ? "This needs something to show." : `This needs at least ${s.min}.` });
    if (mine.length > s.max) out.push({ slot: s.slot, message: `This takes at most ${s.max}.` });
    for (const b of mine) {
      if (!s.accepts.includes(b.type)) out.push({ slot: s.slot, message: "This place does not take that kind of source." });
      if (b.type === "MANUAL" && b.value.trim().length === 0) out.push({ slot: s.slot, message: "A typed figure cannot be empty." });
    }
  }
  return out;
}

/** A typed figure with no named source is allowed in a draft; donor profiles ask for it (the Design check). */
export const manualWithoutSource = (bindings: ReadonlyArray<Binding>): Binding[] =>
  bindings.filter((b) => b.type === "MANUAL" && !(b.sourceNote ?? "").trim());

/** An AI proposal is shown, never published, until a person accepted it. */
export const unacceptedDrafts = (bindings: ReadonlyArray<Binding>): Binding[] =>
  bindings.filter((b) => b.type === "AI_DRAFT" && !b.acceptedAt);

/** The slot every data-reading block declares: which project it reads, and which filters then change it. */
export const projectSlot = (honours: SlotDef["honours"]): SlotDef => ({ slot: "project", accepts: ["PROJECT"], min: 1, max: 1, honours });

/** The project a block reads, from its binding; undefined when it has none (a text block, or a block that reads the viewer's whole portfolio). */
export const projectOf = (bindings: ReadonlyArray<Binding>): string | undefined => bindings.find((b): b is Extract<Binding, { type: "PROJECT" }> => b.type === "PROJECT")?.projectId;
