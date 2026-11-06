/**
 * A Canvas (Phase 45): a saved set of pages of blocks. A dashboard is a canvas viewed LIVE; an infographic is the same canvas
 * published as a frozen export. It stores composition and words, never data.
 */
import type { Binding } from "./binding.js";

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
}

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
  style?: CanvasBlockStyle | undefined;
  /** Accessible name and long description; required before a web export of a chart or map. */
  alt?: string | undefined;
  description?: string | undefined;
}

export interface CanvasPage {
  id: string;
  title: string;
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
  /** Bumped by every save; a save quotes the one it started from. */
  revision: number;
}
