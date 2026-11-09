/**
 * A canvas as it is stored (Phase 45.3): the columns hold identity, scope and revision; one JSON document holds everything the person
 * composed. Read defensively: a document that no longer parses is "no canvas", never a crash, so one bad row cannot take a list down.
 */
import { CANVAS_MODES, CANVAS_PROFILES, CANVAS_SCOPES, type Canvas, type CanvasMode, type CanvasOptions, type CanvasPage, type CanvasProfile, type CanvasScope } from "./canvas.js";
import type { CanvasParameter } from "./params.js";

export interface CanvasDocument { profile: CanvasProfile; language: string; themeId: string; pages: CanvasPage[]; options?: CanvasOptions | undefined; params?: CanvasParameter[] | undefined }

export const documentOf = (c: Canvas): string => JSON.stringify({ profile: c.profile, language: c.language, themeId: c.themeId, pages: c.pages, ...(c.options ? { options: c.options } : {}), ...(c.params && c.params.length > 0 ? { params: c.params } : {}) } satisfies CanvasDocument);

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
    };
  } catch {
    return null;
  }
}

export interface NewCanvasInput { id: string; title: string; scope: CanvasScope; mode?: CanvasMode; profile?: CanvasProfile; language?: string; themeId?: string; format?: string }

/** An empty canvas with one page: the starting point for "blank". */
export const blankCanvas = (i: NewCanvasInput): Canvas => ({
  id: i.id, scope: i.scope, mode: i.mode ?? "LIVE", profile: i.profile ?? "LIVE_INTERNAL", title: i.title, language: i.language ?? "en", themeId: i.themeId ?? "DEFAULT",
  pages: [{ id: "page-1", title: "Page 1", format: i.format ?? "WEB_FLUID", blocks: [] }], revision: 1,
});
