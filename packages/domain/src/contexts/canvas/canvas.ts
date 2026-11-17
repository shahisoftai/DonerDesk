/**
 * A Canvas (Phase 45): a saved set of pages of blocks. A dashboard is a canvas viewed LIVE; an infographic is the same canvas
 * published as a frozen export. It stores composition and words, never data.
 */
import type { AnimationSpec } from "./motion.js";
import type { Binding } from "./binding.js";
import type { BlockAction } from "./actions.js";
import type { CanvasParameter, ParamBinding } from "./params.js";
import type { BlockFormat } from "./format/types.js";

export const CANVAS_MODES = ["LIVE", "PUBLISHED_ONLY"] as const;
export type CanvasMode = (typeof CANVAS_MODES)[number];
export const CANVAS_SCOPES = ["ORG", "PROJECT", "MINE", "PORTFOLIO"] as const;
export type CanvasScope = (typeof CANVAS_SCOPES)[number];
export const CANVAS_PROFILES = ["LIVE_INTERNAL", "SNAPSHOT", "DONOR_REPORT", "SOCIAL", "INTERNAL"] as const;
export type CanvasProfile = (typeof CANVAS_PROFILES)[number];

export const CANVAS_GRID_COLUMNS = 12;
export const CANVAS_MAX_PAGES = 12;
export const CANVAS_MAX_BLOCKS_PER_PAGE = 60;
export const CANVAS_MAX_TITLE = 120;

export interface CanvasBounds { x: number; y: number; w: number; h: number }

/** Colours are roles (resolved by the theme), never hex; a person's own series colour lives inside a block's props. */
export interface CanvasBlockStyle {
  background?: "none" | "card" | "tint" | "accent" | undefined;
  align?: "start" | "center" | "end" | undefined;
  hidden?: boolean | undefined;
  locked?: boolean | undefined;
  /** A frame preset id (`theme-kit/frame-styles.ts`); the individual tokens below override its parts. */
  frame?: string | undefined;
  border?: "none" | "line" | "accent" | undefined;
  padding?: "none" | "small" | "medium" | "large" | undefined;
  radius?: "none" | "small" | "medium" | "large" | undefined;
  shadow?: "none" | "small" | "medium" | undefined;
  /** A coloured bar behind the block's title (Phase 61.7), named by theme role. */
  titleBar?: "none" | "accent" | "accent2" | "ink" | "neutral" | undefined;
  /** The person chose to keep this block's own colours when a theme is applied (Phase 61.6). Otherwise the theme's colours win. */
  keepOwnColours?: boolean | undefined;
}

/** Marks a block as an instance of a saved component (Phase 48.2): which one, which version it was made from and which of its blocks this is. */
export interface BlockComponentLink { id: string; version: number; key: string }

/** A block drawn inside a container block (group, tabs, repeater) instead of on the page grid; `tab` is the tab it sits in (0-based). One level only. */
export interface BlockContainer { id: string; tab?: number | undefined }

export interface BlockInstance<K extends string = string, P = unknown> {
  id: string;
  kind: K;
  /** Desktop/print position on the 12-column grid. */
  bounds: CanvasBounds;
  /** Optional authored overrides; absent = reflow by reading order. */
  tablet?: CanvasBounds | undefined;
  phone?: CanvasBounds | undefined;
  props: P;
  bindings: Binding[];
  /** Present when the block sits inside a container block of the same page. */
  container?: BlockContainer | undefined;
  style?: CanvasBlockStyle | undefined;
  /** Formatting by capability (Phase 50.2): what the editor's Format tab sets. */
  format?: BlockFormat | undefined;
  /** Accessible name and long description; required before a web export of a chart or map. */
  alt?: string | undefined;
  description?: string | undefined;
  /** Present when the block belongs to an instance of a saved component. */
  component?: BlockComponentLink | undefined;
  /** The block's place on a FREE page (Phase 48.4); `bounds` still holds its grid cells so the page can go back to a grid. */
  free?: FreeFrame | undefined;
  /** The parameters this block reads (Phase 48.3); a block with none is never narrowed by a viewer's choice. */
  paramBindings?: ParamBinding[] | undefined;
  /** What clicking the block (or a label in it) does. */
  action?: BlockAction | undefined;
  /** How the block comes in on a screen (Phase 48.15): never in a file, a print or for a viewer who asked for reduced motion. */
  motion?: AnimationSpec | undefined;
}

/** A block's place on a FREE page: pixels on the page, a rotation in degrees and a stacking order (Phase 48.4). */
export interface FreeFrame { x: number; y: number; w: number; h: number; rot?: number | undefined; z?: number | undefined }

export interface CanvasPage {
  id: string;
  title: string;
  /** GRID (the 12-column dashboard grid, the default) or FREE (pixel positions on a fixed-size page). */
  mode?: "GRID" | "FREE" | undefined;
  /** FREE pages and print presets: the page size in px at 96 dpi. */
  size?: { w: number; h: number } | undefined;
  /** A page background: a colour role, never raw hex. */
  background?: "page" | "card" | "tint" | "accent" | undefined;
  /** A theme for this page only (a cover in a dark tone, say). */
  themeId?: string | undefined;
  /** Page format id (shared with the print formats); "WEB_FLUID" is the dashboard default. */
  format: string;
  blocks: BlockInstance[];
}

/** Design-level settings a converted infographic keeps: the period range, default places and the acknowledgement line. */
export interface CanvasOptions {
  periodFromId?: string | undefined;
  periodToId?: string | undefined;
  locationKeys?: string[] | undefined;
  acknowledgement?: string | undefined;
  subtitle?: string | undefined;
  /** The frame style a block added to this canvas starts with (Phase 61.7); a block can still change its own. */
  blockFrame?: string | undefined;
  /** A theme loaded from a file for this canvas (Phase 50.5); used when `themeId` is "CUSTOM". */
  themeSpec?: import("./theme-kit/build-theme.js").ThemeSpec | undefined;
}

export interface Canvas {
  id: string;
  scope: CanvasScope;
  mode: CanvasMode;
  profile: CanvasProfile;
  title: string;
  language: string;
  themeId: string;
  pages: CanvasPage[];
  options?: CanvasOptions | undefined;
  /** The choices a viewer can make (Phase 48.3). */
  params?: CanvasParameter[] | undefined;
  /** How blocks react to clicks in other blocks (Phase 50.4); absent = every block filters every other. */
  interactions?: Record<string, Record<string, "FILTER" | "HIGHLIGHT" | "NONE">> | undefined;
  /** Bumped by every save; a save quotes the one it started from. */
  revision: number;
}
