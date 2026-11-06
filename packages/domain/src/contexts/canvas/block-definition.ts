/**
 * The contract every block honours (Phase 45). One folder or file per block exports one `BlockDefinition`; the canvas,
 * the editor, the composer and the linter only ever talk to this interface, never to a block by name. Adding a block is
 * adding a definition and a line in `blocks/registry.ts`.
 */
import type { SlotDef } from "./binding.js";

export const BLOCK_FAMILIES = ["TEXT", "NUMBERS", "CHARTS", "MAPS", "TABLES", "AI", "MEDIA", "CONTAINERS", "CONTROLS"] as const;
export type BlockFamily = (typeof BLOCK_FAMILIES)[number];

export interface BlockProblem { message: string }
export type LintSeverity = "BLOCKER" | "WARN" | "TIP";

/** A Design-check rule a block owns. The profile (SNAPSHOT, DONOR_REPORT…) decides which rules run, never what is drawn. */
export interface BlockLintRule<P> {
  id: string;
  severity: LintSeverity;
  /** Plain-language message; `null` = passes. */
  check: (props: P) => string | null;
}

export interface BlockSize { w: number; h: number }
export interface BlockSizes { min: BlockSize; max: BlockSize; default: BlockSize }

/**
 * What a block resolves to. A block with nothing to show says so plainly ("empty"), a block that cannot be drawn gives the
 * reason ("unavailable"); neither ever shows a placeholder figure.
 */
export type BlockModel<M> =
  | { state: "ready"; model: M; notes: string[] }
  /** `authoring`: waiting for a person's words or a choice (not for records), so a screen words it as a prompt and not as "not yet reported". */
  | { state: "empty"; reason: string; authoring?: true }
  | { state: "unavailable"; reason: string };

export interface BlockDefinition<P, M = unknown, D = unknown> {
  kind: string;
  family: BlockFamily;
  /** Key in the typed message catalogue (four languages); never the English text itself. */
  labelKey: string;
  /** True when a new block cannot be valid until the person chooses something (an indicator, a question); its defaults then fail `validate` with a plain sentence. */
  requiresSetup?: boolean;
  /** True for a picture (chart, map, image): a public profile asks for a written description. Rules read this, never the kind's name. */
  needsAlt?: boolean;
  /** True for a headline block (hero, banner): a snapshot tells one story, so it counts how many there are. */
  headline?: boolean;
  /** What `resolve` is given as data: the project's facts (infographic-style blocks), the viewer's own list of projects, or nothing. The resolver asks the block; it never names one. */
  reads?: "FACTS" | "VIEWER_PROJECTS";
  defaults(): P;
  validate(props: P): BlockProblem[];
  slots: ReadonlyArray<SlotDef>;
  sizes: BlockSizes;
  lint: ReadonlyArray<BlockLintRule<P>>;
  /** Pure: props + the data already read for this block -> what any renderer draws. No clock, no network. */
  resolve(props: P, data: D): BlockModel<M>;
}

export const defineBlock = <P, M, D>(def: BlockDefinition<P, M, D>): BlockDefinition<P, M, D> => def;
