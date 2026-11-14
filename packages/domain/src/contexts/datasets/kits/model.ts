import type { ColumnKindKey } from "../column-kinds.js";
import type { SemanticKey } from "../semantics.js";
import type { CheckSeverity } from "../checks/types.js";
import type { VisualFamily, WellKey } from "../../visual-data/wells.js";
import type { Aggregate } from "../../visual-data/aggregates.js";

/**
 * A kit (Phase 54, §3.8): content, not code. A data file of the columns a sector's table usually has (with header synonyms in four
 * languages), the figures worked out from them, the checks that catch common mistakes, the standards to draw beside them and the pages
 * to build. A sector differs from another only by its kit; nothing in the platform names a sector. Every kit ships UNREVIEWED until an
 * administrator or project manager reviews it (D6).
 */
export interface KitColumn {
  role: string;
  label: string;
  kind: ColumnKindKey;
  semantic: SemanticKey;
  /** Header synonyms (any language, common ministry spellings). Matched folded: case, accents and separators ignored. */
  aliases: readonly string[];
  unit?: string | undefined;
  /** A rate the kit recomputes from two of its roles. */
  rateParts?: { numerator: string; denominator: string; percent: boolean } | undefined;
  /** The heading it is listed under on the confirm screen ("Admissions and exits"). */
  group: string;
  /** A note shown beside the column (a case definition, for example): content, never code. */
  note?: string | undefined;
}

export interface KitFigure { id: string; label: string; op: "RATIO" | "SHARE" | "SUM" | "DIFFERENCE"; terms: readonly string[]; percent?: boolean | undefined }

/** A check whose column params name roles; `matchKit` turns them into column keys. */
export interface KitCheck { id: string; check: string; label: string; severity?: CheckSeverity | undefined; params: Record<string, unknown> }

export interface KitThreshold { id: string; figure: string; value: number; role: "AT_LEAST" | "AT_MOST"; label: string; source: string }

/** A field in a kit block's well: a role (a column) or a kit figure id, with how it is combined. */
export interface KitWellField { role: string; aggregate?: Aggregate | undefined }

export interface KitBlock {
  /** A row of `KIT_BLOCK_BUILDERS` (visual, slicer, completeness, drivers, text). */
  type: string;
  title?: string | undefined;
  w: number;
  h: number;
  family?: VisualFamily | undefined;
  wells?: Partial<Record<WellKey, KitWellField[]>> | undefined;
  /** Kit figures drawn as calculated fields (a rate from its parts). */
  figures?: readonly string[] | undefined;
  thresholds?: readonly string[] | undefined;
  sort?: "VALUE_DESC" | "VALUE_ASC" | "LABEL" | undefined;
  topN?: number | undefined;
  /** For slicers, completeness and drivers: the roles they read. */
  roles?: Record<string, string | readonly string[]> | undefined;
  text?: string | undefined;
}

export interface KitPage { key: string; title: string; blocks: readonly KitBlock[] }

export interface Kit {
  key: string;
  title: string;
  description: string;
  /** Library sector key it suits (shown in the picker); never read as a branch. */
  sector: string;
  reviewState: "UNREVIEWED" | "REVIEWED";
  /** Where the standards come from ("Sphere Handbook 2018"). */
  source: string;
  columns: readonly KitColumn[];
  figures: readonly KitFigure[];
  checks: readonly KitCheck[];
  thresholds: readonly KitThreshold[];
  pages: readonly KitPage[];
  /** The headers of the downloadable template sheet, in order (roles). */
  templateRoles: readonly string[];
}
