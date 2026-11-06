/**
 * The infographic blocks as canvas blocks (Phase 45.2). They keep the section settings the Studio already stores
 * (`Omit<InfographicSectionConfig, "kind">`), validated by the one `sectionProblem` rule, so a design converts without loss
 * and no rule is copied. Each row of `SPECS` makes one definition; a block that needs its own props type later gets its own file.
 */
import { sectionProblem, type InfographicSectionConfig, type InfographicSectionKind } from "../../infographics/composition.js";
import { optionalProjectSlot } from "../binding.js";
import { defineBlock, type BlockDefinition, type BlockFamily, type BlockSizes } from "../block-definition.js";
import type { CanvasFacts } from "../facts.js";
import { INFOGRAPHIC_MODELS } from "../models/index.js";

export type InfographicBlockProps = Omit<InfographicSectionConfig, "kind">;

interface Spec { family: BlockFamily; w: number; h: number; maxH: number; minW?: number; seed?: InfographicBlockProps; needsAlt?: true; headline?: true }

const wide = (family: BlockFamily, h: number, maxH = 10, seed?: InfographicBlockProps): Spec => ({ family, w: 12, h, maxH, ...(seed ? { seed } : {}) });

export const INFOGRAPHIC_BLOCK_SPECS = {
  HERO: { ...wide("TEXT", 3, 5), headline: true },
  BANNER: { ...wide("TEXT", 1, 2), headline: true },
  KEY_MESSAGES: { family: "TEXT", w: 6, h: 3, maxH: 8 },
  QUOTE: { family: "TEXT", w: 6, h: 3, maxH: 6 },
  LEGEND_NOTES: wide("TEXT", 2, 6),
  BIG_NUMBERS: { family: "NUMBERS", w: 12, h: 2, maxH: 4 },
  PROGRESS_RINGS: { family: "NUMBERS", w: 6, h: 3, maxH: 8 },
  SMALL_MULTIPLES: { family: "CHARTS", w: 12, h: 4, maxH: 10, needsAlt: true },
  LOCATION_RESULTS: { family: "MAPS", w: 6, h: 4, maxH: 10 },
  LOCATION_COMPARISON: { family: "MAPS", w: 6, h: 4, maxH: 10 },
  ACTIVITIES_BY_LOCATION: { family: "MAPS", w: 6, h: 4, maxH: 10 },
  REACH: { family: "NUMBERS", w: 6, h: 3, maxH: 8 },
  DEMOGRAPHICS: { family: "CHARTS", w: 6, h: 4, maxH: 10 },
  FUNNEL: { family: "CHARTS", w: 6, h: 4, maxH: 8 },
  FUNDING: { family: "NUMBERS", w: 6, h: 3, maxH: 8 },
  RESULTS_CHAIN: wide("TABLES", 4, 10),
  SECTOR_GRID: wide("TABLES", 4, 10),
  TIMELINE: wide("TABLES", 3, 8),
  THREE_W: wide("TABLES", 4, 10),
  PORTFOLIO_SUMMARY: wide("NUMBERS", 2, 4),
  PORTFOLIO_TABLE: wide("TABLES", 4, 10),
  PORTFOLIO_HEALTH: { family: "CHARTS", w: 6, h: 3, maxH: 8 },
  PORTFOLIO_COUNTRIES: { family: "MAPS", w: 6, h: 4, maxH: 10 },
  IMAGE: { family: "MEDIA", w: 6, h: 4, maxH: 10, needsAlt: true },
} as const satisfies Record<string, Spec>;

export type InfographicBlockKind = keyof typeof INFOGRAPHIC_BLOCK_SPECS;

function makeBlock(kind: InfographicBlockKind): BlockDefinition<InfographicBlockProps, unknown, CanvasFacts | undefined> {
  const spec: Spec = INFOGRAPHIC_BLOCK_SPECS[kind];
  const sizes: BlockSizes = { min: { w: spec.minW ?? 3, h: 1 }, max: { w: 12, h: spec.maxH }, default: { w: spec.w, h: spec.h } };
  return defineBlock<InfographicBlockProps, unknown, CanvasFacts | undefined>({
    kind,
    family: spec.family,
    labelKey: `canvas.block.${kind}`,
    reads: "FACTS",
    ...(spec.needsAlt ? { needsAlt: true } : {}),
    ...(spec.headline ? { headline: true } : {}),
    defaults: () => ({ ...(spec.seed ?? {}) }),
    validate: (props) => { const m = sectionProblem({ ...props, kind: kind as InfographicSectionKind }); return m ? [{ message: m }] : []; },
    slots: [optionalProjectSlot()],
    sizes,
    lint: [],
    // A kind with a model resolves through it (one pure function the screen and the print composer share); the rest (`PENDING_MODEL_KINDS`) still pass their settings through until 45.2.
    resolve: (props, facts) => { const model = INFOGRAPHIC_MODELS[kind]; return model ? model(props, facts) : Object.keys(props).length === 0 ? { state: "empty", reason: "Nothing set up yet." } : { state: "ready", model: props, notes: [] }; },
  });
}

export const INFOGRAPHIC_BLOCKS = Object.fromEntries((Object.keys(INFOGRAPHIC_BLOCK_SPECS) as InfographicBlockKind[]).map((k) => [k, makeBlock(k)])) as Record<InfographicBlockKind, BlockDefinition<InfographicBlockProps, unknown, CanvasFacts | undefined>>;
