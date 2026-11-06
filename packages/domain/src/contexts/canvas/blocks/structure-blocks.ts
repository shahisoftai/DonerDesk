/**
 * The blocks that are new in the canvas (Phase 45): a callout, the three AI blocks, the containers and the filter bar. They are
 * small enough to share one table; a block that outgrows it gets its own file. AI blocks only ever show text a person put there
 * or accepted, and say plainly when it is still a draft.
 */
import { defineBlock, type BlockDefinition, type BlockFamily, type BlockProblem } from "../block-definition.js";
import { FILTER_DIMENSIONS, type FilterDimension } from "../filters.js";

export const CALLOUT_TONES = ["info", "good", "warn"] as const;
export interface CalloutProps { text: string; tone: (typeof CALLOUT_TONES)[number] }
export interface AiTextProps { instruction?: string | undefined; language?: string | undefined }
export interface AiData { text?: string | undefined; accepted?: boolean | undefined }
export interface GroupProps { title?: string | undefined }
export interface TabsProps { titles: string[] }
export interface RepeaterProps { over: "PROJECT" | "PLACE" | "SECTOR"; limit: number }
export interface FilterBarProps { dimensions: FilterDimension[] }

const MAX_INSTRUCTION = 300;
type Size = { w: number; h: number; minW?: number; maxH?: number };

/** The one place a structure block is defined. `extra` replaces the parts a family needs differently (slots, how it resolves). */
function make<P, M, D>(kind: string, family: BlockFamily, size: Size, seed: () => P, validate: (p: P) => BlockProblem[], extra: Partial<BlockDefinition<P, M, D>> & Pick<BlockDefinition<P, M, D>, "resolve">): BlockDefinition<P, M, D> {
  return defineBlock<P, M, D>({
    kind, family, labelKey: `canvas.block.${kind}`, defaults: seed, validate, slots: [], lint: [],
    sizes: { min: { w: size.minW ?? 2, h: 1 }, max: { w: 12, h: size.maxH ?? 10 }, default: { w: size.w, h: size.h } },
    ...extra,
  });
}

const aiBlock = (kind: string, size: Size) => make<AiTextProps, { text: string; accepted: boolean }, AiData>(kind, "AI", { ...size, minW: 3, maxH: 8 }, () => ({}),
  (p) => ((p.instruction?.length ?? 0) > MAX_INSTRUCTION ? [{ message: `The instruction is at most ${MAX_INSTRUCTION} characters.` }] : []),
  { slots: [{ slot: "text", accepts: ["AI_DRAFT", "MANUAL"], min: 0, max: 1, honours: ["PERIOD"] }],
    resolve: (_p, d) => (d?.text?.trim() ? { state: "ready", model: { text: d.text, accepted: d.accepted === true }, notes: d.accepted === true ? [] : ["AI-drafted. Not accepted yet."] } : { state: "empty", reason: "No text yet.", authoring: true }) });

const plain = <P>(kind: string, family: BlockFamily, size: Size, seed: () => P, validate: (p: P) => BlockProblem[]) =>
  make<P, P, undefined>(kind, family, size, seed, validate, { resolve: (p) => ({ state: "ready", model: p, notes: [] }) });

export const STRUCTURE_BLOCKS: Readonly<Record<string, BlockDefinition<never, unknown, never>>> = Object.fromEntries([
  plain<CalloutProps>("CALLOUT", "TEXT", { w: 12, h: 2, maxH: 4 }, () => ({ text: "", tone: "info" }), (p) => (!CALLOUT_TONES.includes(p.tone) ? [{ message: "Choose how the callout looks." }] : p.text.length > 400 ? [{ message: "A callout is at most 400 characters." }] : [])),
  aiBlock("AI_SUMMARY", { w: 12, h: 3 }),
  aiBlock("AI_MESSAGES", { w: 6, h: 3 }),
  aiBlock("AI_ASK", { w: 6, h: 4 }),
  plain<GroupProps>("GROUP", "CONTAINERS", { w: 12, h: 4 }, () => ({}), (p) => ((p.title?.length ?? 0) > 80 ? [{ message: "A group's title is at most 80 characters." }] : [])),
  plain<TabsProps>("TABS", "CONTAINERS", { w: 12, h: 6 }, () => ({ titles: ["Tab 1", "Tab 2"] }), (p) => (p.titles.length < 2 || p.titles.length > 6 ? [{ message: "Tabs take 2 to 6 titles." }] : p.titles.some((t) => !t.trim() || t.length > 40) ? [{ message: "A tab title is 1 to 40 characters." }] : [])),
  plain<RepeaterProps>("REPEATER", "CONTAINERS", { w: 12, h: 4 }, () => ({ over: "PROJECT", limit: 6 }), (p) => (!["PROJECT", "PLACE", "SECTOR"].includes(p.over) ? [{ message: "Choose what to repeat over." }] : p.limit < 1 || p.limit > 12 ? [{ message: "A repeater shows 1 to 12 items." }] : [])),
  plain<FilterBarProps>("FILTER_BAR", "CONTROLS", { w: 12, h: 1, maxH: 2 }, () => ({ dimensions: ["PERIOD"] }), (p) => (p.dimensions.length === 0 ? [{ message: "Choose at least one filter." }] : p.dimensions.some((d) => !FILTER_DIMENSIONS.includes(d)) ? [{ message: "That filter is not offered." }] : [])),
].map((d) => [d.kind, d as unknown as BlockDefinition<never, unknown, never>]));
