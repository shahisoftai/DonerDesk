/**
 * A canvas as it is stored (Phase 45.3): the columns hold identity, scope and revision; one JSON document holds everything the person
 * composed. Read defensively: a document that no longer parses is "no canvas", never a crash, so one bad row cannot take a list down.
 */
import { CANVAS_MODES, CANVAS_PROFILES, CANVAS_SCOPES, type Canvas, type CanvasMode, type CanvasOptions, type CanvasPage, type CanvasProfile, type CanvasScope } from "./canvas.js";
import type { CanvasParameter } from "./params.js";
import { DEFAULT_PAGE_FORMAT, pagePresetById } from "./pages.js";

export interface CanvasDocument { profile: CanvasProfile; language: string; themeId: string; pages: CanvasPage[]; options?: CanvasOptions | undefined; params?: CanvasParameter[] | undefined; interactions?: Canvas["interactions"] }

export const documentOf = (c: Canvas): string => JSON.stringify({ profile: c.profile, language: c.language, themeId: c.themeId, pages: c.pages, ...(c.options ? { options: c.options } : {}), ...(c.params && c.params.length > 0 ? { params: c.params } : {}), ...(c.interactions && Object.keys(c.interactions).length > 0 ? { interactions: c.interactions } : {}) } satisfies CanvasDocument);

export interface CanvasColumns { id: string; scope: string; mode: string; title: string; revision: number; docJson: string }

/** The canvas a stored row holds, or `null` when its document cannot be read. */
export function canvasFromColumns(row: CanvasColumns): Canvas | null {
  if (!(CANVAS_SCOPES as readonly string[]).includes(row.scope) || !(CANVAS_MODES as readonly string[]).includes(row.mode)) return null;
  try {
    const d = JSON.parse(row.docJson) as Partial<CanvasDocument>;
    if (!d || !Array.isArray(d.pages)) return null;
    return {
      id: row.id, scope: row.scope as CanvasScope, mode: row.mode as CanvasMode, title: row.title, revision: row.revision,
      profile: (CANVAS_PROFILES as readonly string[]).includes(d.profile ?? "") ? (d.profile as CanvasProfile) : "LIVE_INTERNAL",
      language: typeof d.language === "string" ? d.language : "en", themeId: typeof d.themeId === "string" ? d.themeId : "DEFAULT",
      pages: d.pages, ...(d.options ? { options: d.options } : {}), ...(Array.isArray(d.params) && d.params.length > 0 ? { params: d.params } : {}),
      ...(d.interactions && typeof d.interactions === "object" && !Array.isArray(d.interactions) ? { interactions: d.interactions } : {}),
    };
  } catch {
    return null;
  }
}

export interface NewCanvasInput { id: string; title: string; scope: CanvasScope; mode?: CanvasMode; profile?: CanvasProfile; language?: string; themeId?: string; format?: string }

/** An empty canvas with one page: the starting point for "blank". */
export const blankCanvas = (i: NewCanvasInput): Canvas => {
  // A new canvas is a free page (Phase 61.3): blocks go where they are put and any size is allowed. A grid preset or "WEB_FLUID" still gives a grid page.
  const preset = pagePresetById(i.format ?? DEFAULT_PAGE_FORMAT);
  const page: CanvasPage = preset && preset.mode === "FREE" && preset.size
    ? { id: "page-1", title: "Page 1", format: preset.id, mode: "FREE", size: preset.size, blocks: [] }
    : { id: "page-1", title: "Page 1", format: i.format ?? "WEB_FLUID", blocks: [] };
  return { id: i.id, scope: i.scope, mode: i.mode ?? "LIVE", profile: i.profile ?? "LIVE_INTERNAL", title: i.title, language: i.language ?? "en", themeId: i.themeId ?? "DEFAULT", pages: [page], revision: 1 };
};
